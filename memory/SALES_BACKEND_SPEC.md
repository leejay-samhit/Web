# Slangcart Vendor Sales / POS — Backend Specification

> **Audience:** the backend developer maintaining `network-pay-1`.
> **Created:** 29-Jun-2026 by the web frontend agent.
> **Status:** ✅ Web UI live in preview. ⏳ All persistence is browser-only until these endpoints exist.

The web frontend (`/vendor/sales`, `/vendor/pos`, `/vendor/invoices`, `/vendor/cash`, `/vendor/analytics`, `/vendor/settings`) is complete and persists POS data to `localStorage`. The **only real backend call** in the new POS module is `PATCH /api/vendor/me/products/{id}` to decrement live stock — that keeps the public Shop, mobile app and Admin in sync today.

To upgrade to multi-device sales records, search across vendors from admin, and stop relying on the browser, add the endpoints below. The frontend's data layer is centralised in `/app/frontend/src/lib/vendorSales.js` — swap localStorage with these endpoints in that one file and the entire module migrates.

---

## 0. Constraints (must keep)

- ⚠️ **No wallet impact.** None of these endpoints may touch `wallet_balance`, payouts, GST ledger, platform_fee ledger, system wallet treasury or settlement balances. This module is strictly vendor business-record + inventory sync.
- 🔒 **Strict tenant isolation.** A vendor can only see/touch their own data. Admins get a read-only fan-out.
- 🔄 **Inventory must remain transactional.** Creating an invoice must atomically decrement stock for every line item OR return 409 with the list of items whose stock changed since the bill was opened.

---

## 1. Collections

### `offline_sales`
| field | type | notes |
|---|---|---|
| `_id` | ObjectId | |
| `id` | str (uuid) | Public id |
| `vendor_id` | str | Owning user |
| `invoice_no` | str | Format `${prefix}-${counter}` per vendor |
| `created_at` | datetime UTC | |
| `status` | enum(`completed`,`cancelled`,`refunded`) | |
| `cancelled_at` / `refunded_at` | datetime\|null | |
| `refund_reason` | str\|null | |
| `customer` | object | `{kind:"walkin"\|"named", name, phone?, gstin?, address?}` |
| `gst_inclusive` | bool | |
| `totals` | object | `{subtotal, gst_total, discount_total, bill_discount, round_off, grand_total, profit}` |
| `notes` | str | |

### `offline_sale_items` (or embedded array on the parent — your call; embedded is fine for v1)
| field | type |
|---|---|
| `sale_id` | str |
| `product_id` | str |
| `name` | str |
| `hsn` | str\|null |
| `unit` | str |
| `qty` | float |
| `price` | float |
| `discount` | str | (`"5%"` or `"50"`) |
| `discount_amount` | float |
| `gst_pct` | float |
| `tax_amount` | float |
| `taxable` | float |
| `line_total` | float |
| `cost` | float | snapshot of `cost_price` at sale time, for profit calc |
| `stock_before` | int |

### `offline_sale_payments`
| field | type |
|---|---|
| `sale_id` | str |
| `mode` | enum(`cash`,`upi`,`debit`,`credit`,`netbank`,`wallet`,`credit_sale`) |
| `amount` | float |
| `reference` | str\|null |

### `vendor_customers`
| field | type |
|---|---|
| `vendor_id` | str |
| `name`, `phone`, `gstin`, `address`, `email` | str |
| `total_spend`, `bills_count`, `last_seen` | float / int / datetime |

### `vendor_cash_sessions` *(optional — used for opening/closing-balance reports)*
| field | type |
|---|---|
| `vendor_id` | str |
| `opened_at`, `closed_at` | datetime |
| `opening_balance`, `expected_close`, `actual_close`, `variance` | float |

### `vendor_invoice_counters`
| field | type |
|---|---|
| `vendor_id` | str (PK) |
| `prefix` | str |
| `pad` | int |
| `last_number` | int |

### `vendor_pos_settings`
| field | type |
|---|---|
| `vendor_id` | str (PK) |
| `invoice_prefix`, `invoice_pad` | str / int |
| `business_name`, `business_address`, `business_phone`, `business_email`, `business_gstin` | str |
| `default_gst_pct` | float |
| `gst_inclusive` | bool |
| `opening_balance` | float |

---

## 2. Endpoints (FastAPI)

All require `HTTPBearer` auth. All non-admin routes derive `vendor_id` from the JWT.

### Settings

```
GET    /api/vendor/me/pos/settings           → VendorPosSettings
PUT    /api/vendor/me/pos/settings           ← partial settings
```

### Invoice counter (atomic next-number issuance)

```
POST   /api/vendor/me/pos/invoice/peek       → { invoice_no }    # no consume
POST   /api/vendor/me/pos/invoice/consume    → { invoice_no }    # atomic ++
```

### Sales CRUD

```
POST   /api/vendor/me/pos/sales              ← CreateSaleRequest → SaleResponse
GET    /api/vendor/me/pos/sales              ?from&to&q&payment_mode&min_amt&max_amt&status&limit&offset
GET    /api/vendor/me/pos/sales/{id}         → SaleResponse
POST   /api/vendor/me/pos/sales/{id}/cancel  → SaleResponse
POST   /api/vendor/me/pos/sales/{id}/refund  ← {reason} → SaleResponse
GET    /api/vendor/me/pos/sales/{id}/invoice.pdf   → application/pdf
```

**CreateSaleRequest** must:
1. Open a transaction (Mongo session).
2. For each `item`, run `find_one_and_update({id, vendor_id}, {$inc: {stock: -qty}})` with `filter: {stock: {$gte: qty}}`. If any returns null → **409 Conflict** with the list of items that fell short.
3. Insert into `offline_sales` + items + payments.
4. Bump `vendor_invoice_counters.last_number` (also atomically).
5. Commit.

### Dashboard / KPIs / cash summary / statement

```
GET    /api/vendor/me/pos/dashboard          → today + month aggregates
GET    /api/vendor/me/pos/cash-summary       ?date=YYYY-MM-DD
GET    /api/vendor/me/pos/statement          ?from&to → list with running balance
GET    /api/vendor/me/pos/analytics          → daily, top sold, top revenue, top GST, least sold
```

### Customers (optional v1)

```
GET    /api/vendor/me/pos/customers          ?q&limit
POST   /api/vendor/me/pos/customers          ← create / upsert by phone
GET    /api/vendor/me/pos/customers/{id}
PATCH  /api/vendor/me/pos/customers/{id}
```

### Admin read-only (monitoring)

```
GET    /api/admin/vendors/{user_id}/pos/sales       ?from&to (paged)
GET    /api/admin/vendors/{user_id}/pos/dashboard
GET    /api/admin/pos/global-summary                Total bills & turnover across all vendors
```

---

## 3. Pydantic models (suggested)

```python
class SaleItemIn(BaseModel):
    product_id: str
    name: str
    hsn: str | None = None
    unit: str = "pc"
    qty: float
    price: float = Field(ge=0)
    discount: str | None = None
    gst_pct: float = Field(ge=0, le=100)

class SalePaymentIn(BaseModel):
    mode: Literal["cash","upi","debit","credit","netbank","wallet","credit_sale"]
    amount: float = Field(ge=0)
    reference: str | None = None

class CustomerIn(BaseModel):
    kind: Literal["walkin","named"] = "walkin"
    name: str = "Walk-in Customer"
    phone: str | None = None
    gstin: str | None = None
    address: str | None = None

class CreateSaleRequest(BaseModel):
    items: list[SaleItemIn]
    payments: list[SalePaymentIn]
    customer: CustomerIn = CustomerIn()
    gst_inclusive: bool = False
    bill_discount: str | None = None
    round_off: bool = True
    notes: str | None = None
```

The frontend already computes line totals + grand total client-side — the server should recompute them (treat client values as untrusted) and store the canonical numbers.

---

## 4. Migration steps for the web frontend (zero-downtime)

1. Ship these endpoints in production.
2. In `/app/frontend/src/lib/vendorSales.js` replace the localStorage read/write helpers with axios calls (`api.get/post/patch` to the routes above). Every page imports the same functions, so no UI change needed.
3. Optional: on first run, the frontend can call `POST /vendor/me/pos/sales/bulk-import` with the localStorage history so existing offline sales get backed up.

---

## 5. Out of scope (still localStorage when migrated)

- The `invoicePrint.js` HTML print template stays client-side (no PDF microservice needed).
- Analytics charts (`/vendor/analytics`) consume `/pos/analytics` directly — no separate aggregation service required.

---

## 6. Quick acceptance checklist

- [ ] `POST /pos/sales` is transactional and never leaves stock negative.
- [ ] A second concurrent bill for the same product correctly receives **409** when stock would go negative.
- [ ] Cancelling or refunding a bill increments stock back atomically.
- [ ] Invoice numbers are strictly monotonically increasing per vendor (no gaps from racing).
- [ ] The new endpoints do NOT touch the system wallet, GST ledger or platform_fee ledger.
- [ ] Admin endpoints can read but not write any vendor's POS data.
- [ ] CORS allow-list includes `https://slangcart.com` and the preview origin.
