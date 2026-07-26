"""
Slangcart local backend — cross-vendor Substore Transfer service.

Runs at REACT_APP_BACKEND_URL (this Emergent container). The main product
backend (auth, products, POS) lives on `network-pay-1.emergent.host`. Since
we don't have the main backend's JWT signing key, this service **delegates
identity verification** by forwarding each request's Bearer token to
`network-pay-1`'s `/api/auth/me` and trusting the returned identity.

Endpoints exposed here (spec: /app/memory/SUBSTORE_TRANSFER_SPEC.md):
    POST   /api/vendor/me/transfers
    GET    /api/vendor/me/transfers
    POST   /api/vendor/me/transfers/{id}/accept
    POST   /api/vendor/me/transfers/{id}/cancel
    GET    /api/vendor/me/transfers/{id}
"""

from fastapi import FastAPI, APIRouter, HTTPException, Header, Query, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import time
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ─── MongoDB ──────────────────────────────────────────────────────────────
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ─── FastAPI app ──────────────────────────────────────────────────────────
app = FastAPI(title="Slangcart Transfer Service")
api_router = APIRouter(prefix="/api")

# Upstream identity provider (production auth backend)
UPSTREAM_BASE = os.environ.get("UPSTREAM_AUTH_URL", "https://network-pay-1.emergent.host/api")

# Simple 60-second in-memory identity cache to avoid a network hop per request.
_identity_cache: dict[str, tuple[float, dict]] = {}
_IDENTITY_TTL_SEC = 60


async def resolve_vendor(authorization: Optional[str] = Header(default=None)) -> dict:
    """Extract Bearer token, forward to network-pay-1's /auth/me, cache 60s."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="missing_bearer_token")

    now = time.time()
    hit = _identity_cache.get(token)
    if hit and hit[0] > now:
        return hit[1]

    try:
        async with httpx.AsyncClient(timeout=8.0) as h:
            r = await h.get(f"{UPSTREAM_BASE}/auth/me", headers={"Authorization": f"Bearer {token}"})
    except Exception as e:  # network hiccup
        raise HTTPException(status_code=502, detail="upstream_auth_unreachable") from e

    if r.status_code == 401:
        raise HTTPException(status_code=401, detail="invalid_bearer_token")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"upstream_auth_{r.status_code}")
    identity = r.json()
    if not identity.get("id") or not identity.get("email"):
        raise HTTPException(status_code=502, detail="upstream_identity_missing_fields")

    _identity_cache[token] = (now + _IDENTITY_TTL_SEC, identity)
    return identity


# ─── Data models ──────────────────────────────────────────────────────────
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
    status: str = "pending"  # pending | accepted | cancelled | rejected
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    accepted_at: Optional[str] = None
    accepted_by: Optional[str] = None


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


# ─── Helpers ──────────────────────────────────────────────────────────────
async def next_transfer_order_id(from_email: str) -> str:
    """TRF-YYYYMMDD-#### sequential per sender per day."""
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
    from_email = me["email"]
    if payload.to_email.strip().lower() == from_email.strip().lower():
        raise HTTPException(status_code=403, detail="cannot_transfer_to_self")

    order_id = await next_transfer_order_id(from_email)
    total_value = round(float(payload.qty) * float(payload.unit_price or 0), 2)

    doc = Transfer(
        transfer_order_id=order_id,
        from_email=from_email,
        from_name=me.get("name", ""),
        to_email=payload.to_email.strip().lower(),
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
    ).model_dump()

    await db.vendor_transfers.insert_one(dict(doc))
    return _shape(doc)


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


@api_router.get("/vendor/me/transfers/{transfer_id}")
async def get_transfer(transfer_id: str, me: dict = Depends(resolve_vendor)):
    email = me["email"].strip().lower()
    doc = await db.vendor_transfers.find_one(
        {"id": transfer_id, "$or": [{"from_email": email}, {"to_email": email}]},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="transfer_not_found")
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

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.vendor_transfers.update_one(
        {"id": transfer_id},
        {"$set": {"status": "accepted", "accepted_at": now_iso, "accepted_by": email}},
    )
    doc.update({"status": "accepted", "accepted_at": now_iso, "accepted_by": email})
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

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.vendor_transfers.update_one(
        {"id": transfer_id},
        {"$set": {"status": "cancelled", "cancelled_at": now_iso}},
    )
    doc["status"] = "cancelled"
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

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.vendor_transfers.update_one(
        {"id": transfer_id},
        {"$set": {"status": "rejected", "rejected_at": now_iso}},
    )
    doc["status"] = "rejected"
    return doc


# Legacy stub kept for existing platform health probes.
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


# ─── App wiring ───────────────────────────────────────────────────────────
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("slangcart-transfers")


@app.on_event("startup")
async def ensure_indexes():
    try:
        await db.vendor_transfers.create_index("from_email")
        await db.vendor_transfers.create_index("to_email")
        await db.vendor_transfers.create_index("id", unique=True)
        await db.vendor_transfers.create_index([("created_at", -1)])
        logger.info("vendor_transfers indexes ready")
    except Exception as e:
        logger.warning("index_creation_failed: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
