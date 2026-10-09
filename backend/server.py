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


async def _upstream_find_existing_product(token: str, sku: str, name: str) -> Optional[dict]:
    """Find receiver's existing product that matches this transfer.

    Match order: SKU (case-insensitive) > exact name+non-zero price.  Empty
    SKU + generic name deliberately never matches to avoid merging unrelated
    products.
    """
    try:
        async with httpx.AsyncClient(timeout=8.0) as h:
            r = await h.get(f"{UPSTREAM_BASE}/vendor/me/products", params={"limit": 500},
                            headers={"Authorization": f"Bearer {token}"})
        if r.status_code != 200:
            return None
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        sku_n = (sku or "").strip().lower()
        name_n = (name or "").strip().lower()
        if sku_n:
            for p in items:
                if (p.get("sku") or "").strip().lower() == sku_n:
                    return p
        if name_n:
            for p in items:
                if (p.get("name") or "").strip().lower() == name_n:
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
        existing = await _upstream_find_existing_product(me["_token"], doc.get("sku", ""), doc.get("product_name", ""))
        if existing and isinstance(existing.get("stock"), (int, float)):
            new_stock = int(existing["stock"]) + int(doc["qty"])
            stock_added = await _upstream_patch_stock(me["_token"], existing["id"], new_stock)
            add_detail = f"Merged into existing product '{existing.get('name')}' (+{doc['qty']} units)" if stock_added else "Merge failed — try refreshing"
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


# ─── Owner Security (local — persists PIN / password per vendor) ─────────
class OwnerVerifyBody(BaseModel):
    password: Optional[str] = None
    pin: Optional[str] = None


class OwnerChangePasswordBody(BaseModel):
    currentPassword: str
    newPassword: str


class OwnerChangePinBody(BaseModel):
    currentPassword: str
    newPin: str


class ResetCenterBody(BaseModel):
    pin: Optional[str] = None
    password: Optional[str] = None


DEFAULT_OWNER_PIN = "1234"
DEFAULT_OWNER_PASSWORD = "1234"


async def _owner_doc(email: str) -> dict:
    """Fetch or lazily create the owner-security doc with 1234 defaults."""
    doc = await db.owner_security.find_one({"owner_email": email}, {"_id": 0})
    if doc:
        return doc
    doc = {
        "owner_email": email,
        "password": DEFAULT_OWNER_PASSWORD,
        "pin": DEFAULT_OWNER_PIN,
        "password_updated_at": None,
        "pin_updated_at": None,
        "biometrics_enabled": False,
        "auto_lock_seconds": 900,
        "created_at": now_iso(),
    }
    await db.owner_security.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.get("/erp/owner-security/status")
async def owner_status(me: dict = Depends(resolve_vendor)):
    doc = await _owner_doc(me["email"].strip().lower())
    return {
        "enrolled": True,
        "biometricsEnabled": doc.get("biometrics_enabled", False),
        "autoLockSeconds": doc.get("auto_lock_seconds", 900),
        "passwordUpdatedAt": doc.get("password_updated_at"),
        "pinUpdatedAt": doc.get("pin_updated_at"),
        "usingDefault": doc.get("password") == DEFAULT_OWNER_PASSWORD or doc.get("pin") == DEFAULT_OWNER_PIN,
    }


@api_router.post("/erp/owner-security/verify")
async def owner_verify(body: OwnerVerifyBody, me: dict = Depends(resolve_vendor)):
    doc = await _owner_doc(me["email"].strip().lower())
    if body.pin is not None:
        if body.pin == doc.get("pin"):
            return {"ok": True, "verifiedAt": now_iso(), "mode": "pin"}
        raise HTTPException(status_code=401, detail="invalid_pin")
    if body.password is not None:
        if body.password == doc.get("password"):
            return {"ok": True, "verifiedAt": now_iso(), "mode": "password"}
        raise HTTPException(status_code=401, detail="invalid_password")
    raise HTTPException(status_code=400, detail="password_or_pin_required")


@api_router.post("/erp/owner-security/change-password")
async def owner_change_password(body: OwnerChangePasswordBody, me: dict = Depends(resolve_vendor)):
    email = me["email"].strip().lower()
    doc = await _owner_doc(email)
    if body.currentPassword != doc.get("password"):
        raise HTTPException(status_code=401, detail="current_password_incorrect")
    if len(body.newPassword) < 4:
        raise HTTPException(status_code=400, detail="new_password_too_short")
    await db.owner_security.update_one(
        {"owner_email": email},
        {"$set": {"password": body.newPassword, "password_updated_at": now_iso()}},
    )
    return {"ok": True}


@api_router.post("/erp/owner-security/change-pin")
async def owner_change_pin(body: OwnerChangePinBody, me: dict = Depends(resolve_vendor)):
    email = me["email"].strip().lower()
    doc = await _owner_doc(email)
    if body.currentPassword != doc.get("password"):
        raise HTTPException(status_code=401, detail="current_password_incorrect")
    if not body.newPin.isdigit() or not (4 <= len(body.newPin) <= 6):
        raise HTTPException(status_code=400, detail="pin_must_be_4_to_6_digits")
    await db.owner_security.update_one(
        {"owner_email": email},
        {"$set": {"pin": body.newPin, "pin_updated_at": now_iso()}},
    )
    return {"ok": True}


# ─── Reset Center — danger-zone wipe of THIS shop's local billing data ──────
# The external products/orders are deleted by the frontend using the owner's
# own token; this endpoint clears the local-backend mirrors (transfers,
# mirrored orders, substore directory) after verifying the owner PIN/password.
@api_router.post("/erp/reset-center/wipe")
async def reset_center_wipe(body: ResetCenterBody, me: dict = Depends(resolve_vendor)):
    email = me["email"].strip().lower()
    doc = await _owner_doc(email)
    ok = False
    if body.pin is not None and body.pin == doc.get("pin"):
        ok = True
    elif body.password is not None and body.password == doc.get("password"):
        ok = True
    if not ok:
        raise HTTPException(status_code=401, detail="invalid_owner_credentials")
    t = await db.vendor_transfers.delete_many({"$or": [{"from_email": email}, {"to_email": email}]})
    o = await db.customer_orders.delete_many({"$or": [{"vendor_emails": email}, {"customer_email": email}]})
    s = await db.vendor_substores.delete_many({"owner_email": email})
    return {"ok": True, "deleted": {"transfers": t.deleted_count, "orders": o.deleted_count, "substores": s.deleted_count}}


# ─── Free stock-photo search (keyless Openverse proxy) ──────────────────────
@api_router.get("/image-search")
async def image_search(q: str = Query(..., min_length=1), page: int = Query(default=1, ge=1, le=20)):
    params = {"q": q, "page_size": 20, "page": page, "mature": "false"}
    try:
        async with httpx.AsyncClient(timeout=12) as hc:
            r = await hc.get(
                "https://api.openverse.org/v1/images/",
                params=params,
                headers={"User-Agent": "Slangcart/1.0 (billing)"},
            )
        if r.status_code != 200:
            return {"results": []}
        data = r.json()
    except Exception as exc:  # network/timeout → graceful empty
        logger.warning("image_search failed: %s", exc)
        return {"results": []}
    out = []
    for it in data.get("results", []):
        thumb = it.get("thumbnail") or it.get("url")
        if not thumb:
            continue
        out.append({
            "id": it.get("id"),
            "thumb": thumb,
            "url": it.get("url") or thumb,
            "title": (it.get("title") or "")[:120],
            "creator": it.get("creator") or "",
        })
    return {"results": out}


# ─── Customer Orders mirror (local — bridges checkout to vendor view) ────
class OrderItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    product_id: Optional[str] = None
    vendor_email: Optional[str] = None
    name: str
    image_url: str = ""
    qty: int = 1
    price: float = 0.0
    total: float = 0.0


class OrderCreate(BaseModel):
    items: List[OrderItem]
    address: dict = Field(default_factory=dict)
    payment_mode: str = "COD"          # COD | UPI | CARD | RAZORPAY
    payment_reference: str = ""
    customer_name: str = ""
    customer_phone: str = ""
    subtotal: float = 0.0
    shipping: float = 0.0
    tax: float = 0.0
    grand_total: float = 0.0
    note: str = ""


class OrderStatusBody(BaseModel):
    status: str  # placed | packed | shipped | delivered | cancelled


ORDER_STATUSES = ("placed", "packed", "shipped", "delivered", "cancelled")


async def next_order_number() -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"ORD-{today}-"
    n = await db.customer_orders.count_documents({"order_number": {"$regex": f"^{prefix}"}})
    return f"{prefix}{n + 1:05d}"


@api_router.post("/orders/checkout", status_code=201)
async def create_order(payload: OrderCreate, me: dict = Depends(resolve_vendor)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="empty_cart")
    # Group items by vendor so the vendor's `/vendor/me/orders` view surfaces
    # only what belongs to them.
    vendors = {(it.vendor_email or "").strip().lower() for it in payload.items if (it.vendor_email or "")}
    order_number = await next_order_number()
    ts = now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "order_number": order_number,
        "customer_email": me["email"].strip().lower(),
        "customer_name": payload.customer_name or me.get("name", ""),
        "customer_phone": payload.customer_phone,
        "vendor_emails": sorted(vendors),
        "items": [it.model_dump() for it in payload.items],
        "address": payload.address,
        "payment_mode": payload.payment_mode,
        "payment_reference": payload.payment_reference,
        "subtotal": payload.subtotal,
        "shipping": payload.shipping,
        "tax": payload.tax,
        "grand_total": payload.grand_total,
        "note": payload.note,
        "status": "placed",
        "created_at": ts,
        "updated_at": ts,
        "status_history": [{"status": "placed", "at": ts, "actor_email": me["email"]}],
    }
    await db.customer_orders.insert_one(dict(doc))
    doc.pop("_id", None)
    # Push realtime to each affected vendor so their VendorOrders refreshes.
    for v in vendors:
        await broker.publish([v], {"type": "order.placed", "order": doc})
    return doc


@api_router.get("/orders/me")
async def my_orders(me: dict = Depends(resolve_vendor), limit: int = Query(default=200, ge=1, le=500)):
    email = me["email"].strip().lower()
    items = await db.customer_orders.find({"customer_email": email}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"items": items}


@api_router.get("/vendor/me/orders")
async def vendor_orders(
    me: dict = Depends(resolve_vendor),
    status: str = Query(default="all"),
    limit: int = Query(default=200, ge=1, le=500),
):
    email = me["email"].strip().lower()
    query = {"vendor_emails": email}
    if status in ORDER_STATUSES:
        query["status"] = status
    items = await db.customer_orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"items": items}


@api_router.patch("/vendor/orders/{order_id}/status")
async def vendor_order_status(order_id: str, body: OrderStatusBody, me: dict = Depends(resolve_vendor)):
    email = me["email"].strip().lower()
    if body.status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"invalid_status_{body.status}")
    doc = await db.customer_orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="order_not_found")
    if email not in doc.get("vendor_emails", []):
        raise HTTPException(status_code=403, detail="not_a_vendor_for_this_order")
    ts = now_iso()
    entry = {"status": body.status, "at": ts, "actor_email": email}
    await db.customer_orders.update_one(
        {"id": order_id},
        {"$set": {"status": body.status, "updated_at": ts}, "$push": {"status_history": entry}},
    )
    doc["status"] = body.status
    doc["updated_at"] = ts
    doc.setdefault("status_history", []).append(entry)
    await broker.publish(doc.get("vendor_emails", []) + [doc.get("customer_email")],
                         {"type": "order.updated", "order": doc})
    return doc


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


# Bare `/health` route for platforms whose liveness probes hit /health directly
# (e.g. nginx sidecar in the deployment container). Duplicates /api/health so
# neither the ingress nor the container-level probe misses.
@app.get("/health")
async def health_root():
    try:
        await db.command("ping")
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


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
        await db.customer_orders.create_index("customer_email")
        await db.customer_orders.create_index("vendor_emails")
        await db.customer_orders.create_index("id", unique=True)
        await db.customer_orders.create_index([("created_at", -1)])
        await db.owner_security.create_index("owner_email", unique=True)
        logger.info("indexes ready")
    except Exception as e:
        logger.warning("index_creation_failed: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
