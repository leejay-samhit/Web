# Slangcart · Backlog Backend Spec (04-Jul-2026 batch)

**Author:** Slangcart web team · 04-Jul-2026
**Status:** DRAFT — awaiting backend implementation
**Scope:** Features batched with the substore + order-management drop where the frontend UI was intentionally deferred because it needs backend endpoints that don't exist yet.

The frontend is production-ready for every item below. Once you ship the endpoints, ping the web team and we'll flip the pages from "in progress" to live in the next deploy.

---

## 1. Admin Products — PIN code + Vendor filter, filtered stock Excel

**Endpoint:** `GET /api/admin/products` (extend)

Add these query params (all optional, combinable):
- `pincode=600001` — filter to vendors registered in that PIN
- `vendor_id=v456` — filter to a specific vendor
- `stock_status=in_stock|low|out` — optional
- `q=samsung` — full-text on product name / brand / sku

Response must include per row:
- `stock` (int), `low_stock_threshold` (int), `vendor_id`, `vendor_name`, `vendor_email`, `vendor_phone`, `vendor_pincode`.

Once these ship, the web will:
- Add PIN + Vendor dropdowns to `AdminProducts.jsx`.
- Add a "Download Excel (filtered)" button that mirrors the currently applied filters.
- Remove the Delete button from the admin product row (Edit remains).

## 2. Vendor Products — stock Excel download

**Endpoint:** `GET /api/vendor/me/products` (existing)

Just needs to return `stock` + `low_stock_threshold` alongside the product fields. Once available, the frontend will add a "Download stock Excel" button on the Products tab of `VendorDashboard`.

## 3. Vendor POS — search by serial number + IMEI

**Endpoint:** `GET /api/vendor/me/products/search?q=<term>&fields=name,sku,serial,imei`

Backend should query `product.serial_numbers[]` and `product.imei_pool[]` alongside `name` and `sku`. Response identical to the current search shape.

## 4. Vendor POS — CGST/SGST split + GST-inclusive toggle behaviour

Purely frontend once the invoice model has `cgst_pct` + `sgst_pct` fields available in `POST /api/vendor/me/invoices`. Confirm the backend accepts these keys (they may already; ping to verify).

When `gst_inclusive` is toggled ON in the POS UI, the frontend zeroes the GST% before submission and includes the tax in the price. No backend change needed if the field is honoured.

## 5. Vendor POS — Payment popup card capture (manual, no gateway)

Purely frontend. The invoice payload needs to accept a `payments[].card` sub-object:
```json
{ "mode": "card", "amount": 1200, "card": { "last4": "1234", "expiry_mm": "09", "expiry_yy": "28", "reference": "REF-0091" } }
```
Store it verbatim on the invoice. No CVV, no gateway.

## 6. Q&A vendor reply → user chat

**Endpoints:**
- `POST /api/products/{id}/questions/{qid}/reply` — vendor posts a reply.
- On the reply write, backend should ALSO push a chat message into the buyer's Slang-Connect thread with the vendor (create the thread if it doesn't exist).
- Notify the buyer via `_create_notification`.

Frontend: `VendorDashboard.jsx` Q&A tab already fetches `/vendor/me/questions`; add an inline reply textarea + Send button. The user's Slang-Connect page auto-shows the reply via existing polling.

## 7. Vendor Network — downline list

**Endpoint:** `GET /api/users/me/network` (existing) — response probably already returns downline; frontend needs to render it on the vendor `/network` page identical to the user version. **No backend change required** unless vendor's network is stored separately.

## 8. Delivered → auto-Paid (COD collection)

When `PATCH /api/vendor/orders/{id}/status` receives `{ status: "delivered", mark_paid: true }`, backend must:
- If `payment_method == "cod"`: flip `payment_status` from `pending_cod` → `collected_on_delivery` (or `paid`) and record `paid_at` timestamp.
- Tag the invoice with COD/UPI badge so `/vendor/invoices` and admin exports read it.

Frontend already sends `mark_paid: true` from the Delivered confirmation modal.

## 9. Order number sequencing

The web computes order # client-side (per-vendor sequential 1, 2, 3… for vendors; global sequential 1, 2, 3… for admin). Backend enhancement (optional, recommended): add `order_seq` (global) and `vendor_order_seq` (per-vendor) fields to the Order model + return them on `GET /admin/orders`, `GET /vendor/me/orders`, `GET /orders/me`. The frontend prefers those if present, so the switch is transparent.

## 10. Substore transfer ledger

**New endpoints** (currently stored client-side in `localStorage.slangcart_vendor_substore_transfers`):
- `GET /api/vendor/me/substores`
- `POST /api/vendor/me/substores` — add
- `DELETE /api/vendor/me/substores/{id}`
- `GET /api/vendor/me/substore-transfers?q=&status=`
- `POST /api/vendor/me/substore-transfers` — create
- `POST /api/vendor/substore-transfers/{id}/accept` — destination substore acknowledges receipt
- `POST /api/vendor/substore-transfers/{id}/cancel` — initiator cancels

Transfer record schema (already implemented client-side; mirror on backend):
```json
{
  "id": "uuid",
  "transfer_order_id": "TRF-20260704-0001",
  "created_at": "ISO8601",
  "status": "pending|accepted|rejected|cancelled",
  "from_email": "vendor1@example.com",
  "from_name": "Vendor 1 shop",
  "to_substore_id": "ss-uuid",
  "to_email": "vendor2@example.com",
  "to_name": "Vendor 2 shop",
  "product_name": "iPhone 15 Pro 256GB",
  "sku": "SKU-001",
  "serial_number": "SN123",
  "imei": "3567...",
  "qty": 1,
  "unit_price": 129999,
  "total_value": 129999,
  "note": "Loan for demo",
  "accepted_at": null,
  "accepted_by": null
}
```

**Business logic:**
- On `accept`: decrement `qty` from initiator's stock, increment destination's stock. If either vendor is under the SAME GSTIN as the counterparty (matching PAN), skip GST accounting; otherwise treat as an inter-vendor sale (issue a stock-transfer invoice with GST).
- Only the destination substore's owner can accept.
- Only the initiator can cancel (only while status is `pending`).

## Rollout order (recommended)

1. Order model enhancements (§8 Delivered → Paid, §9 sequencing) — unblocks Order Management + Excel.
2. Admin Products filters (§1) + Vendor Products stock (§2) — smallest wins.
3. Substore endpoints (§10) — biggest, but self-contained.
4. Q&A → chat (§6) — nice-to-have.
5. POS search (§3) + payment capture (§4, §5) — internal to POS.
6. Vendor network (§7) — likely a no-op.
