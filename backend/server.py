"""
Slangcart local backend — cross-vendor Substore Transfer service.

Runs at REACT_APP_BACKEND_URL. Delegates identity to `network-pay-1` via
/auth/me (60s cache).  Also proxies stock mutations to the upstream vendor
product endpoints so accepting a transfer really moves stock.

Endpoints (spec: /app/memory/SUBSTORE_TRANSFER_SPEC.md):
  POST   /api/vendor/me/transfers
  GET    /api/vendor/me/transfers?status=…
  GET    /api/vendor/me/transfers/{id}
  POST   /api/vendor/me/transfers/{id}/accept
  POST   /api/vendor/me/transfers/{id}/cancel
  POST   /api/vendor/me/transfers/{id}/reject
  GET    /api/vendor/me/transfers/stream         (SSE — realtime push)
  GET    /api/vendor/me/substores                (contact directory)
  POST   /api/vendor/me/substores
  DELETE /api/vendor/me/substores/{id}
"""

from fastapi import FastAPI, APIRouter, HTTPException, Header, Query, Depends, Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import time
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Slangcart Transfer Service")
api_router = APIRouter(prefix="/api")

UPSTREAM_BASE = os.environ.get("UPSTREAM_AUTH_URL", "https://network-pay-1.emergent.host/api")

# ─── Identity cache ───────────────────────────────────────────────────────
_identity_cache: dict[str, tuple[float, dict]] = {}
_IDENTITY_TTL_SEC = 60


async def _bearer_from(header: Optional[str]) -> str:
    if not header or not header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    token = header.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    return token


async def resolve_vendor(authorization: Optional[str] = Header(default=None)) -> dict:
    token = await _bearer_from(authorization)
    now = time.time()
    hit = _identity_cache.get(token)
    if hit and hit[0] > now:
        return {**hit[1], "_token": token}
    try:
        async with httpx.AsyncClient(timeout=8.0) as h:
            r = await h.get(f"{UPSTREAM_BASE}/auth/me", headers={"Authorization": f"Bearer {token}"})
    except Exception as e:
        raise HTTPException(status_code=502, detail="upstream_auth_unreachable") from e
    if r.status_code == 401:
        raise HTTPException(status_code=401, detail="invalid_bearer_token")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"upstream_auth_{r.status_code}")
    identity = r.json()
    if not identity.get("id") or not identity.get("email"):
        raise HTTPException(status_code=502, detail="upstream_identity_missing_fields")
    _identity_cache[token] = (now + _IDENTITY_TTL_SEC, identity)
    return {**identity, "_token": token}


# ─── Models ───────────────────────────────────────────────────────────────
class TimelineEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    kind: str                                                  # created | seen | accepted | cancelled | rejected
    at: str
    actor_email: str = ""
    actor_name: str = ""
    detail: str = ""


class Transfer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transfer_order_id: str = ""
    from_email: str
    from_name: str = ""
    to_email: str
    to_name: str = ""
    product_id: Optional[str] = None
    product_name: str
    image_url: str = ""
    sku: str = ""
    serial_number: str = ""
    imei: str = ""
    qty: int
    unit_price: float = 0.0
    total_value: float = 0.0
    note: str = ""
    status: str = "pending"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    accepted_at: Optional[str] = None
    accepted_by: Optional[str] = None
    stock_deducted: bool = False
    stock_added: bool = False
    timeline: List[TimelineEvent] = Field(default_factory=list)


class TransferCreate(BaseModel):
    to_email: str
    to_name: str = ""
    product_id: Optional[str] = None
    product_name: str
    image_url: str = ""
    sku: str = ""
    serial_number: str = ""
    imei: str = ""
    qty: int = Field(gt=0)
    unit_price: float = 0.0
    note: str = ""


class Substore(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_email: str
    email: str
    name: str = ""
    gstin: str = ""
    phone: str = ""
    note: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SubstoreCreate(BaseModel):
    email: str
    name: str = ""
    gstin: str = ""
    phone: str = ""
    note: str = ""


# ─── Helpers ──────────────────────────────────────────────────────────────
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def next_transfer_order_id(from_email: str) -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"TRF-{today}-"
    count = await db.vendor_transfers.count_documents({
        "from_email": from_email,
        "transfer_order_id": {"$regex": f"^{prefix}"},
    })
    return f"{prefix}{count + 1:04d}"


def _shape(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ─── Upstream stock helpers (best-effort) ─────────────────────────────────
async def _upstream_get_product(token: str, product_id: str) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=8.0) as h:
            r = await h.get(f"{UPSTREAM_BASE}/vendor/me/products/{product_id}",
                            headers={"Authorization": f"Bearer {token}"})
        return r.json() if r.status_code == 200 else None
    except Exception:
        return None


async def _upstream_patch_stock(token: str, product_id: str, new_stock: int) -> bool:
    try:
        async with httpx.AsyncClient(timeout=8.0) as h:
            r = await h.patch(f"{UPSTREAM_BASE}/vendor/me/products/{product_id}",
                              headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                              json={"stock": new_stock})
        return r.status_code in (200, 204)
    except Exception:
        return False


async def _upstream_find_product_by_sku(token: str, sku: str) -> Optional[dict]:
    if not sku:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as h:
            r = await h.get(f"{UPSTREAM_BASE}/vendor/me/products", params={"limit": 500},
                            headers={"Authorization": f"Bearer {token}"})
        if r.status_code != 200:
            return None
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        for p in items:
            if (p.get("sku") or "").strip().lower() == sku.strip().lower():
                return p
    except Exception:
        pass
    return None


async def _upstream_create_product(token: str, payload: dict) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=8.0) as h:
            r = await h.post(f"{UPSTREAM_BASE}/vendor/me/products",
                             headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                             json=payload)
        return r.json() if r.status_code in (200, 201) else None
    except Exception:
        return None


# ─── SSE broker (per-email fan-out) ───────────────────────────────────────
class SseBroker:
    def __init__(self):
        # email -> list[asyncio.Queue]
        self.subs: dict[str, list[asyncio.Queue]] = {}

    def subscribe(self, email: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self.subs.setdefault(email, []).append(q)
        return q

    def unsubscribe(self, email: str, q: asyncio.Queue):
        arr = self.subs.get(email)
        if not arr:
            return
        try:
            arr.remove(q)
        except ValueError:
            pass
        if not arr:
            self.subs.pop(email, None)

    async def publish(self, emails: list[str], event: dict):
        payload = json.dumps(event, default=str)
        for e in {(e or "").strip().lower() for e in emails if e}:
            for q in list(self.subs.get(e, [])):
                if q.full():
                    continue
                await q.put(payload)


broker = SseBroker()


# ─── Routes ───────────────────────────────────────────────────────────────
@api_router.get("/")
async def root():
    return {"service": "slangcart-transfers", "ok": True}


@api_router.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@api_router.post("/vendor/me/transfers", response_model=Transfer, status_code=201)
async def create_transfer(payload: TransferCreate, me: dict = Depends(resolve_vendor)):
    from_email = (me["email"] or "").strip().lower()
    to_email = (payload.to_email or "").strip().lower()
    if to_email == from_email:
        raise HTTPException(status_code=403, detail="cannot_transfer_to_self")

    order_id = await next_transfer_order_id(from_email)
    total_value = round(float(payload.qty) * float(payload.unit_price or 0), 2)

    # Auto-deduct sender's stock (best effort — non-blocking on failure).
    stock_deducted = False
    if payload.product_id:
        p = await _upstream_get_product(me["_token"], payload.product_id)
        if p and isinstance(p.get("stock"), (int, float)):
            cur = int(p["stock"])
            if cur < payload.qty:
                raise HTTPException(status_code=409, detail="insufficient_stock")
            stock_deducted = await _upstream_patch_stock(me["_token"], payload.product_id, cur - payload.qty)

    ts = now_iso()
    doc = Transfer(
        transfer_order_id=order_id,
        from_email=from_email,
        from_name=me.get("name", ""),
        to_email=to_email,
        to_name=payload.to_name,
        product_id=payload.product_id,
        product_name=payload.product_name,
        image_url=payload.image_url,
        sku=payload.sku,
        serial_number=payload.serial_number,
        imei=payload.imei,
        qty=payload.qty,
        unit_price=payload.unit_price,
        total_value=total_value,
        note=payload.note,
        stock_deducted=stock_deducted,
        timeline=[TimelineEvent(
            kind="created", at=ts,
            actor_email=from_email, actor_name=me.get("name", ""),
            detail=("Stock deducted from sender" if stock_deducted else ("Sender stock not linked" if not payload.product_id else "Stock deduction failed — retry later")),
        )],
    ).model_dump()

    await db.vendor_transfers.insert_one(dict(doc))
    shaped = _shape(doc)
    await broker.publish([from_email, to_email], {"type": "transfer.created", "transfer": shaped})
    return shaped


@api_router.get("/vendor/me/transfers")
async def list_transfers(
    me: dict = Depends(resolve_vendor),
    status: str = Query(default="all"),
    limit: int = Query(default=200, ge=1, le=500),
):
    email = me["email"].strip().lower()
    query = {"$or": [{"from_email": email}, {"to_email": email}]}
    if status in ("pending", "accepted", "cancelled", "rejected"):
        query["status"] = status
    cursor = db.vendor_transfers.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return {"items": items, "cursor": None}


@api_router.get("/vendor/me/transfers/stream")
async def stream_transfers(request: Request, authorization: Optional[str] = Header(default=None), access_token: Optional[str] = Query(default=None)):
    # EventSource cannot set Authorization; accept token via query string.
    header = authorization or (f"Bearer {access_token}" if access_token else None)
    me = await resolve_vendor(header)
    email = me["email"].strip().lower()

    async def gen():
        q = broker.subscribe(email)
        # Send a hello event so the client knows the stream is open.
        yield f"event: hello\ndata: {json.dumps({'email': email, 'at': now_iso()})}\n\n"
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(q.get(), timeout=25.0)
                    yield f"event: transfer\ndata: {payload}\n\n"
                except asyncio.TimeoutError:
                    # keepalive comment — nginx/proxies need periodic bytes.
                    yield ": keepalive\n\n"
        finally:
            broker.unsubscribe(email, q)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
    })


@api_router.get("/vendor/me/transfers/{transfer_id}")
async def get_transfer(transfer_id: str, me: dict = Depends(resolve_vendor)):
    email = me["email"].strip().lower()
    doc = await db.vendor_transfers.find_one(
        {"id": transfer_id, "$or": [{"from_email": email}, {"to_email": email}]},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="transfer_not_found")

    # Emit a "seen" timeline event the first time the recipient views a
    # pending transfer, so senders know the receiver has laid eyes on it.
    if doc.get("status") == "pending" and email == doc["to_email"]:
        already_seen = any(ev.get("kind") == "seen" and ev.get("actor_email") == email for ev in (doc.get("timeline") or []))
        if not already_seen:
            ev = TimelineEvent(kind="seen", at=now_iso(), actor_email=email, actor_name=me.get("name", ""),
                               detail="Recipient opened the transfer").model_dump()
            await db.vendor_transfers.update_one({"id": transfer_id}, {"$push": {"timeline": ev}})
            doc.setdefault("timeline", []).append(ev)
            await broker.publish([doc["from_email"], doc["to_email"]],
                                 {"type": "transfer.seen", "transfer_id": transfer_id, "event": ev})
    return doc


@api_router.post("/vendor/me/transfers/{transfer_id}/accept")
async def accept_transfer(transfer_id: str, me: dict = Depends(resolve_vendor)):
    email = me["email"].strip().lower()
    doc = await db.vendor_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="transfer_not_found")
    if doc["to_email"] != email:
        raise HTTPException(status_code=403, detail="only_recipient_can_accept")
    if doc["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"transfer_already_{doc['status']}")

    # Auto-add to receiver's catalog (best effort).
    stock_added = False
    add_detail = "Receiver product not touched (upstream unavailable)"
    try:
        existing = await _upstream_find_product_by_sku(me["_token"], doc.get("sku", ""))
        if existing and isinstance(existing.get("stock"), (int, float)):
            new_stock = int(existing["stock"]) + int(doc["qty"])
            stock_added = await _upstream_patch_stock(me["_token"], existing["id"], new_stock)
            add_detail = f"Merged into existing SKU {doc.get('sku')} (+{doc['qty']} units)" if stock_added else "Merge failed — try refreshing"
        else:
            created = await _upstream_create_product(me["_token"], {
                "name": doc["product_name"],
                "price": doc.get("unit_price") or 0,
                "mrp": doc.get("unit_price") or 0,
                "stock": doc["qty"],
                "image_url": doc.get("image_url") or "",
                "sku": doc.get("sku") or "",
                "description": f"Received via transfer {doc.get('transfer_order_id')} from {doc.get('from_name') or doc['from_email']}",
            })
            if created:
                stock_added = True
                add_detail = "New product created in receiver's catalog"
    except Exception:
        pass

    ts = now_iso()
    ev = TimelineEvent(kind="accepted", at=ts, actor_email=email, actor_name=me.get("name", ""), detail=add_detail).model_dump()
    await db.vendor_transfers.update_one(
        {"id": transfer_id},
        {"$set": {"status": "accepted", "accepted_at": ts, "accepted_by": email, "stock_added": stock_added},
         "$push": {"timeline": ev}},
    )
    doc.update({"status": "accepted", "accepted_at": ts, "accepted_by": email, "stock_added": stock_added})
    doc.setdefault("timeline", []).append(ev)
    await broker.publish([doc["from_email"], doc["to_email"]], {"type": "transfer.accepted", "transfer": doc})
    return doc


@api_router.post("/vendor/me/transfers/{transfer_id}/cancel")
async def cancel_transfer(transfer_id: str, me: dict = Depends(resolve_vendor)):
    email = me["email"].strip().lower()
    doc = await db.vendor_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="transfer_not_found")
    if doc["from_email"] != email:
        raise HTTPException(status_code=403, detail="only_sender_can_cancel")
    if doc["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"transfer_already_{doc['status']}")

    # Refund sender stock if we deducted on create.
    refunded = False
    refund_detail = "No stock refund needed"
    if doc.get("stock_deducted") and doc.get("product_id"):
        p = await _upstream_get_product(me["_token"], doc["product_id"])
        if p and isinstance(p.get("stock"), (int, float)):
            refunded = await _upstream_patch_stock(me["_token"], doc["product_id"], int(p["stock"]) + int(doc["qty"]))
            refund_detail = f"Refunded {doc['qty']} units to sender" if refunded else "Refund failed"

    ts = now_iso()
    ev = TimelineEvent(kind="cancelled", at=ts, actor_email=email, actor_name=me.get("name", ""), detail=refund_detail).model_dump()
    await db.vendor_transfers.update_one(
        {"id": transfer_id},
        {"$set": {"status": "cancelled", "cancelled_at": ts}, "$push": {"timeline": ev}},
    )
    doc["status"] = "cancelled"
    doc.setdefault("timeline", []).append(ev)
    await broker.publish([doc["from_email"], doc["to_email"]], {"type": "transfer.cancelled", "transfer": doc})
    return doc


@api_router.post("/vendor/me/transfers/{transfer_id}/reject")
async def reject_transfer(transfer_id: str, me: dict = Depends(resolve_vendor)):
    email = me["email"].strip().lower()
    doc = await db.vendor_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="transfer_not_found")
    if doc["to_email"] != email:
        raise HTTPException(status_code=403, detail="only_recipient_can_reject")
    if doc["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"transfer_already_{doc['status']}")

    # Refund sender stock — the transfer never lands.
    refund_detail = "No stock refund needed"
    if doc.get("stock_deducted") and doc.get("product_id"):
        p = await _upstream_get_product(me["_token"], doc["product_id"])
        if p and isinstance(p.get("stock"), (int, float)):
            ok = await _upstream_patch_stock(me["_token"], doc["product_id"], int(p["stock"]) + int(doc["qty"]))
            refund_detail = f"Refunded {doc['qty']} units to sender" if ok else "Refund failed"

    ts = now_iso()
    ev = TimelineEvent(kind="rejected", at=ts, actor_email=email, actor_name=me.get("name", ""), detail=refund_detail).model_dump()
    await db.vendor_transfers.update_one(
        {"id": transfer_id},
        {"$set": {"status": "rejected", "rejected_at": ts}, "$push": {"timeline": ev}},
    )
    doc["status"] = "rejected"
    doc.setdefault("timeline", []).append(ev)
    await broker.publish([doc["from_email"], doc["to_email"]], {"type": "transfer.rejected", "transfer": doc})
    return doc


# ─── Substore directory (server-persisted contact list) ──────────────────
@api_router.get("/vendor/me/substores")
async def list_substores(me: dict = Depends(resolve_vendor)):
    email = me["email"].strip().lower()
    items = await db.vendor_substores.find({"owner_email": email}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"items": items}


@api_router.post("/vendor/me/substores", response_model=Substore, status_code=201)
async def add_substore_route(payload: SubstoreCreate, me: dict = Depends(resolve_vendor)):
    owner = me["email"].strip().lower()
    target = (payload.email or "").strip().lower()
    if not target:
        raise HTTPException(status_code=400, detail="substore_email_required")
    if target == owner:
        raise HTTPException(status_code=400, detail="cannot_add_self_as_substore")
    dup = await db.vendor_substores.find_one({"owner_email": owner, "email": target})
    if dup:
        raise HTTPException(status_code=409, detail="substore_already_exists")
    doc = Substore(owner_email=owner, email=target, name=payload.name or target,
                   gstin=payload.gstin, phone=payload.phone, note=payload.note).model_dump()
    await db.vendor_substores.insert_one(dict(doc))
    return _shape(doc)


@api_router.delete("/vendor/me/substores/{substore_id}")
async def delete_substore_route(substore_id: str, me: dict = Depends(resolve_vendor)):
    owner = me["email"].strip().lower()
    res = await db.vendor_substores.delete_one({"id": substore_id, "owner_email": owner})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="substore_not_found")
    return {"ok": True}


# Legacy stub
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(payload: StatusCheckCreate):
    obj = StatusCheck(**payload.model_dump())
    doc = obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    rows = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for c in rows:
        if isinstance(c['timestamp'], str):
            c['timestamp'] = datetime.fromisoformat(c['timestamp'])
    return rows


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("slangcart-transfers")


@app.on_event("startup")
async def ensure_indexes():
    try:
        await db.vendor_transfers.create_index("from_email")
        await db.vendor_transfers.create_index("to_email")
        await db.vendor_transfers.create_index("id", unique=True)
        await db.vendor_transfers.create_index([("created_at", -1)])
        await db.vendor_substores.create_index([("owner_email", 1), ("email", 1)], unique=True)
        await db.vendor_substores.create_index("id", unique=True)
        logger.info("indexes ready")
    except Exception as e:
        logger.warning("index_creation_failed: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
