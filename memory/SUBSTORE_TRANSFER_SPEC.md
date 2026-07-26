# Substore Transfer — Cross-Vendor Sync Backend Specification

**Priority**: P0 (currently blocked feature)
**Audience**: External FastAPI backend team (`network-pay-1.emergent.host`)
**Frontend behavior today**: All transfer records live in `localStorage` (`slangcart_substore_ledger_global`). Two vendors on two devices/browsers cannot see each other's transfers. The frontend UI (`/app/frontend/src/pages/vendor/VendorSubstore.jsx`) is fully wired and will lift straight off `localStorage` the moment the endpoints below respond with `200`.

## What the frontend needs

### 1. Persist a transfer
```
POST /api/vendor/me/transfers
Headers: Authorization: Bearer <vendorAToken>
Body:
{
  "to_email":       "vendorb@example.com",
  "to_name":        "Vendor B shop name",
  "product_id":     "uuid-from-vendor-me-products (optional)",
  "product_name":   "Basmati Rice 5kg",
  "image_url":      "https://...",           // full snapshot so recipient sees image without re-fetch
  "sku":            "RICE-5KG",
  "serial_number":  "",
  "imei":           "",
  "qty":            10,
  "unit_price":     599,
  "note":           "Consignment stock"
}

Response 201:
{
  "id":                "srv-generated-uuid",
  "transfer_order_id": "TRF-20260725-0001",   // sequential per SENDER vendor
  "status":            "pending",
  "from_email":        "vendora@example.com",  // derived from JWT
  "from_name":         "Vendor A shop name",
  "to_email":          "vendorb@example.com",
  "product_id":        "…",
  "product_name":      "Basmati Rice 5kg",
  "image_url":         "…",
  "sku":               "…",
  "qty":               10,
  "unit_price":        599,
  "total_value":       5990,
  "created_at":        "2026-07-25T10:15:00Z",
  "accepted_at":       null,
  "accepted_by":       null
}

Errors: 400 (missing product_name / qty / to_email), 404 (to_email not a vendor), 403 (sender = receiver).
```

Backend side-effects:
- **Deduct** `qty` from the sender's `/vendor/me/products/{product_id}.stock` if `product_id` is supplied. Reject with `409` if oversell.
- Insert a row into a new collection `vendor_transfers` (schema below).
- Send an in-app notification / mobile push to the receiver so they see the incoming transfer without polling. (Optional — nice-to-have if push infra exists.)

### 2. List transfers where I am sender OR receiver
```
GET /api/vendor/me/transfers?status=pending|accepted|cancelled|all&limit=200&cursor=…
Headers: Authorization: Bearer <vendorToken>

Response 200:
{
  "items": [ Transfer, … ],
  "cursor": "opaque | null"
}
```
Filter must include rows where `from_email == me OR to_email == me`.

### 3. Accept a transfer (recipient only)
```
POST /api/vendor/me/transfers/{id}/accept
Headers: Authorization: Bearer <vendorBToken>

Response 200: the updated Transfer object with status="accepted", accepted_at set.
```
Backend side-effects:
- **Add** `qty` to the recipient's own product list. If `product_id` exists in the receiver's catalog (matched by SKU or barcode), increment the existing row's `stock`. Otherwise **create a new product** on the recipient's catalog copying `name / image_url / sku / hsn / gst / unit_price` from the transfer snapshot with `stock = qty`. This is the "product with same image/spec/price on the receiver side" requirement from the user.
- Write the accepted transfer to the receiver's audit trail.

Errors: 403 (not the recipient), 404 (unknown id), 409 (already accepted/cancelled).

### 4. Cancel a transfer (sender only, only while pending)
```
POST /api/vendor/me/transfers/{id}/cancel
Response 200: updated Transfer with status="cancelled".
```
Backend must return the `qty` to the sender's stock.

### 5. Optional: Substore directory
```
GET  /api/vendor/me/substores               — list my known substore partners
POST /api/vendor/me/substores               — add {email, name, gstin, phone, note}
DELETE /api/vendor/me/substores/{id}
```
If not shipped, the frontend keeps this local (`slangcart_vendor_substores:<email>`). Only the transfers endpoints above are P0.

## Data model — `vendor_transfers`

```json
{
  "_id":               "ObjectId",
  "transfer_order_id": "TRF-YYYYMMDD-####",  // sequential per sender
  "from_email":        "str",
  "from_name":         "str",
  "to_email":          "str",                 // must exist in vendors
  "to_name":           "str",
  "product_id":        "str | null",          // optional link to source product
  "product_name":      "str",
  "image_url":         "str",                 // FULL snapshot url (data-url ok)
  "sku":               "str",
  "serial_number":     "str",
  "imei":              "str",
  "qty":               "int",
  "unit_price":        "float",
  "total_value":       "float",               // qty * unit_price
  "note":              "str",
  "status":            "pending | accepted | cancelled",
  "created_at":        "iso",
  "accepted_at":       "iso | null",
  "accepted_by":       "email | null"
}
```

Indexes: `(from_email, created_at)`, `(to_email, created_at)`, `(id)`.

## Frontend integration surface

Once the endpoints ship, only `/app/frontend/src/lib/vendorSubstore.js` needs a swap-out — all page code is already correct and testid-annotated. The client will:
1. `POST /api/vendor/me/transfers` inside `createTransfer(...)`.
2. `GET /api/vendor/me/transfers` inside `loadTransfers(...)`.
3. `POST /api/vendor/me/transfers/{id}/accept` inside `acceptTransfer(...)`.
4. Merge `image_url / sku / qty / unit_price` into the receiver's `/vendor/me/products` list — no extra work needed if the backend does step "Accept a transfer" above.

## Rollout order

1. Create `vendor_transfers` collection + indexes.
2. Ship `POST /api/vendor/me/transfers` first — this unblocks the sender flow.
3. Ship `GET /api/vendor/me/transfers` — enables the ledger view.
4. Ship the accept/cancel endpoints with stock side-effects — full loop closes.
5. (Optional) `substores` directory endpoints.

Total estimated dev: ~1 day if the vendor product store already exists (it does — `/api/vendor/me/products` is live and returned real data during smoke testing on 2026-07-25).
