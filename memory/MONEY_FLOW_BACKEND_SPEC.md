# Slangcart · Money-flow Reset — Backend Spec

**Author:** Slangcart web team · 04-Jul-2026
**Status:** DRAFT — awaiting backend implementation

## Business rule

> Slangcart does NOT collect a single rupee from **Shop purchases** or **Service bookings**.
> All shop and service revenue flows **directly to the vendor / provider** (offline or via their own gateway).
> The only revenue the Slangcart platform account collects is:
>
> 1. **Registration fees** (₹100 + 18 % GST per new user)
> 2. **Platform-fee revenue** (already in `group_4_platform_fee`)
>
> User wallet must reflect **referral money only** — no shop-purchase or service-purchase
> auto-credit is permitted.

## What the web frontend already does (implemented 04-Jul-2026)

| Change | File | Effect |
| ------ | ---- | ------ |
| Hide `shop` + `service` from Group 1 Revenue tile | `src/pages/admin/AdminSystemWallet.jsx` | Tile now shows `registration + reversed` only. |
| Subtract shop + service from Bank Tally inflow | same file | Bank tally now equals platform-only bank flow. |
| Drop shop + service from Company Net Worth formula | same file | Frontend-computed net worth ignores off-platform flows. |
| Filter `shop`/`service` rows from User-source accountability | same file | Cards for those two sources are hidden. |
| Split Vendor **My Shop Sales** into UPI vs COD vs "Credit sale pending – Slangcart" | `src/pages/vendor/VendorSales.jsx` | Vendor sees exactly what's due from Slangcart vs what they collected on delivery. |

The web computes these values client-side. **Until the backend changes below ship**, the "Backend
reports X" hint on the Net-Worth card will still show the old (larger) figure.

## Required backend changes

### 1. Order checkout — support COD + return correct amount

**Endpoint:** `POST /api/orders/checkout`

**Current issue:** COD payment shows `₹0` in the order — the backend appears to
create the order but doesn't record `payment_method="cod"` or the cart total.
UPI orders via Razorpay use test-mode keys and the amount mismatches the cart.

**Payload shape web now sends:**
```json
{
  "shipping_address": {
    "name": "Ramesh Kumar",
    "phone": "9876543210",
    "line1": "42, MG Road",
    "line2": "Near HDFC ATM",
    "address": "42, MG Road",        // legacy alias, please read either
    "city": "Chennai",
    "state": "TN",
    "pincode": "600001"
  },
  "address": { /* duplicate, for legacy code paths */ },
  "payment_method": "cod",           // OR "online"
  "cod": true                        // convenience boolean, mirrors payment_method
}
```

**Expected response for COD:**
```json
{
  "order": {
    "id": "<order_uuid>",
    "amount": 4999.00,               // matches cart total in RUPEES
    "payment_method": "cod",
    "payment_status": "pending_cod",
    "status": "confirmed"
  }
}
```

**Expected response for online (Razorpay):**
```json
{
  "razorpay_order": {
    "id": "order_ABC123",            // Razorpay order_id
    "amount": 499900,                // paise
    "currency": "INR"
  },
  "order": { "id": "<order_uuid>", "amount": 4999.00, ... }
}
```

### 2. Do NOT credit user wallet on shop purchase

**Symptom reported:** "user wallet money is adding lower than the product cost"

The backend currently seems to credit the buyer's wallet with some percentage of the
product cost on successful checkout. **Please remove that.** The user wallet may
only be credited by:

- Signup referral bonus
- Direct-referral commission on their own referrals' registrations
- Level/matrix payouts from the referral tree
- Withdrawal reversals

Shop / service transactions **must not** touch `users.{wallet_balance, held_balance, …}`.

### 3. Do NOT credit system wallet on shop / service transactions

Wherever the backend currently increments `group_1_revenue.shop` or
`group_1_revenue.service`, please stop. Those two numeric buckets should always
be zero going forward. Keep the fields in the schema for backwards-compat, but
zero them out.

### 4. Vendor order feed — return `payment_method`

**Endpoint:** `GET /api/vendor/me/sales`

Please include `payment_method` (or a top-level `mode` string) on each row so the
web can split UPI vs COD without heuristics. Suggested shape:

```json
{
  "items": [
    {
      "id": "...",
      "order_id": "...",
      "product_id": "...",
      "product_name": "iPhone 15 Pro",
      "amount": 129999.00,
      "payment_method": "cod",       // or "upi" / "card" / "netbank"
      "payment_status": "collected_on_delivery",
      "created_at": "2026-07-04T18:23:00Z"
    }
  ]
}
```

The web currently falls back to a `payment_method || payment_mode || method || …`
scan and then a status-based heuristic — please just return the field.

### 5. Razorpay live-key switch

**Endpoint:** `GET /api/payment/config`

Currently returns test-mode keys. Once the merchant is live-KYC'd, switch to live
keys **from the same endpoint** (no frontend change needed). Also make sure
`amount` in the Razorpay order matches the cart total (in paise) exactly.

## Migration checklist

- [ ] Stop crediting user wallet on `/orders/checkout` completion.
- [ ] Stop incrementing `group_1_revenue.shop` / `group_1_revenue.service`.
- [ ] Backfill the two fields to 0 for existing data (or keep for audit and
      surface as `off_platform_shop` / `off_platform_service` in the API).
- [ ] Support `payment_method="cod"` on `/orders/checkout`.
- [ ] Return `payment_method` on `/vendor/me/sales` rows.
- [ ] Switch Razorpay config to live keys.
- [ ] Ensure `amount` returned to Razorpay equals the cart total in paise.
- [ ] Notify the web team so the "Backend reports X" hint on the Net-Worth card
      can be removed.
