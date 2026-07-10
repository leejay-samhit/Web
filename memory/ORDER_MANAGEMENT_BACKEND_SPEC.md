# Slangcart · Order Management (Vendor-owned) — Backend Spec

**Author:** Slangcart web team · 04-Jul-2026
**Status:** ✅ CONFIRMED by backend team (04-Jul-2026) — implementation in progress
**Priority:** P0 for `/vendor/orders`, P1 for `/admin/orders` read-only

## Confirmed backend deliverables (from backend team 04-Jul-2026)

1. **`PATCH /api/vendor/orders/{order_id}/status`** — vendor-scoped equivalent of admin's status endpoint. Permissioned so a vendor can ONLY update orders they own. Mobile currently falls back to `/api/admin/orders/...` as a hack — this dedicated route removes that.
2. **`GET /api/vendor/me/stats`** — extended to include:
   - `today_shop_sales_amount`
   - `today_shop_orders`
   - `lifetime_shop_earnings`
   Sourced from the `vendor_sales` collection.
3. **Q&A router** — new questions on `/products/{id}/questions` should notify the **vendor (product owner)** via `_create_notification`. Admin can READ but should NOT receive the notification.
4. **`GET /api/orders/me`** — response enriched with `vendor_name` on each order so the mobile "My orders" hero card + web `/orders` page can show the vendor per line-item.

Web already consumes these fields opportunistically (falls back to display-friendly defaults when they're `null`). See the "Frontend already shipped" section below for the exact places.

## Business rule

> Vendors own the order lifecycle. When a user buys a product, the order lands
> in the vendor's inbox and the vendor advances the stage from **Placed** all
> the way to **Delivered** (or **Cancelled** / **Returned**).
> Slangcart admin no longer edits order stage — Admin sees a read-only view
> and can download an Excel of all orders.

## Frontend already shipped (04-Jul-2026)

- `/vendor/orders` — new page, tap-to-advance stage buttons, always-visible
  customer name/phone/address, Excel download.
- `/admin/orders` — rewritten to read-only. All "Update status" controls
  removed. Search + Excel download added.
- Shared helpers in `src/lib/orders.js`:
  - `ORDER_STAGES` canonical list (see §Stage catalogue below).
  - `exportOrdersToExcel(orders, { role, shopName })` — 8-column .xlsx.
- Frontend degrades gracefully when the endpoints below return 404 / 405 /
  501 — shows an amber "Backend not ready" banner with instructions.

## Stage catalogue (canonical, matches the frontend)

Ordered list. Order can progress forward only. `final: true` stages have no
further transitions.

| Stage key         | Label              | Final? |
| ----------------- | ------------------ | ------ |
| `placed`          | Placed             | no     |
| `confirmed`       | Confirmed          | no     |
| `paid`            | Paid               | no     |
| `processing`      | Processing         | no     |
| `packed`          | Packed             | no     |
| `shipped`         | Shipped            | no     |
| `out_for_delivery`| Out for delivery   | no     |
| `delivered`       | Delivered          | yes    |
| `cancelled`       | Cancelled          | yes    |
| `returned`        | Returned           | yes    |

Backend should validate transitions against this catalogue and reject anything
outside it with `422 Unprocessable Entity`. Cancellation is allowed from any
non-final stage.

## Required backend endpoints

### 1. `GET /api/vendor/me/orders`

**Auth:** JWT · role must be `vendor` (or admin acting on behalf — up to you).
**Query params:** `status` (optional stage-key filter), `limit` (default 100), `cursor` (optional).

**Response body:**
```json
{
  "items": [
    {
      "id": "0d9f...",
      "created_at": "2026-07-04T18:23:00Z",
      "status": "packed",
      "amount": 129999.00,
      "user_id": "u123",
      "user_name": "Ramesh Kumar",
      "user_phone": "9876543210",
      "shipping_address": {
        "name": "Ramesh Kumar",
        "phone": "9876543210",
        "line1": "42, MG Road",
        "line2": "Near HDFC ATM",
        "city": "Chennai",
        "state": "TN",
        "pincode": "600001"
      },
      "vendor_id": "v456",
      "vendor_name": "Sri Krishna Traders",
      "vendor_email": "vendor@example.com",
      "vendor_phone": "9123456780",
      "payment_method": "cod",
      "payment_status": "pending_cod",
      "items": [
        {
          "product_id": "p789",
          "product_name": "iPhone 15 Pro 256GB",
          "image_url": "https://.../iphone.jpg",
          "qty": 1,
          "price": 129999.00
        }
      ]
    }
  ],
  "total": 42,
  "next_cursor": null
}
```

Only orders that **contain at least one product owned by the calling vendor**
should be returned. If an order mixes multiple vendors' products, return only
the items belonging to this vendor (or filter server-side). Total should be
recomputed per-vendor slice.

### 2. `PATCH /api/vendor/orders/{order_id}/status`

**Auth:** JWT · role must be `vendor` **and** own at least one product in this order.
**Body:**
```json
{ "status": "packed" }
```
**Response 200:**
```json
{ "ok": true, "order": { /* full order after update */ } }
```
**Response 422:** invalid stage key / illegal backward transition.
**Response 403:** vendor doesn't own any product in this order.

### 3. `GET /api/admin/orders` (already exists — extend the response)

Add the same enriched fields shown in §1 so the Admin table can render user &
vendor details without extra lookups:
```
user_name, user_phone, vendor_id, vendor_name, vendor_email, vendor_phone,
items[].product_name, items[].image_url, items[].qty, items[].price,
shipping_address { line1, line2, city, state, pincode }, status, amount, created_at
```

### 4. Admin `PATCH /api/admin/orders/{id}/status` — optional deprecation

The web no longer calls this. Safe to deprecate. If you keep it around for
mobile / audit reasons, gate it behind `admin_role in {super_admin, finance}`.

## Excel report contract (informational)

The frontend already builds an .xlsx client-side using `xlsx` npm package.
Column order is fixed and matches product spec (04-Jul-2026):

1. User Name · 2. User Mobile · 3. Product Name · 4. Product Amount
5. Order Stage · 6. Vendor Name · 7. Vendor Email · 8. Vendor Mobile

Filename convention:
- Vendor: `slangcart-vendor-{shop-slug}-orders-YYYY-MM-DD.xlsx`
- Admin: `slangcart-admin-orders-YYYY-MM-DD.xlsx`

The frontend does the export — you don't need to build a server-side one.

## Migration checklist

- [ ] Implement `GET /api/vendor/me/orders` (§1).
- [ ] Implement `PATCH /api/vendor/orders/{id}/status` with transition validation (§2).
- [ ] Enrich `GET /api/admin/orders` response with the fields listed in §3.
- [ ] Deprecate or gate `PATCH /api/admin/orders/{id}/status` (§4).
- [ ] Add a per-order stage-history audit log (each transition: from, to, actor, timestamp).
      Not required for MVP but recommended for dispute resolution.
- [ ] Notify web team so we can remove the "Backend not ready" banner.

## Notes & edge cases

- **Multi-vendor orders**: if a single checkout contains products from 2+
  vendors, each vendor should only see their portion. The order stage may
  differ per vendor (Vendor A shipped, Vendor B still packing). Consider
  storing stage per **order_item** rather than per **order** — a v2 concern.
- **COD collection**: when the vendor moves the stage to `delivered` and
  `payment_method="cod"`, mark the order as **collected** and start the
  payout clock so Slangcart doesn't accidentally owe the vendor money for
  a cash-collected order. Related: `MONEY_FLOW_BACKEND_SPEC.md`.
- **Notifications**: on each stage transition, push a notification to the
  buyer (existing `/api/notifications` infra).
- **Return flow**: `returned` needs a reason field (`returned_reason`) and a
  refund trigger. Out of scope for this pass — we'll handle in a follow-up
  spec.
