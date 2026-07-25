# Slangcart Vendor Billing Software 3.0 — Backend Specification

**Version**: 3.0.0
**Audience**: External FastAPI backend team (`network-pay-1.emergent.host`)
**Frontend build status**: Shells + local-first fallback shipped in this iteration. All UI is wired to the endpoints below and will lift off `localStorage` seamlessly once the API responds with `200`. If the endpoint returns `404`, the UI falls back to per-vendor `localStorage` so demos and pilots keep working.

**Guiding principles**
- **DO NOT** delete or alter any existing endpoints. This spec is additive.
- All money is stored in **paise (INT)** and rendered in **INR (₹)** in the UI.
- All timestamps are **UTC ISO 8601** strings. FE converts to IST for display.
- All rates/thresholds/HSN maps are **Super Admin editable at runtime**. NEVER hard-code Indian tax law numbers.
- Every mutation must write an entry to the ERP audit log (`/erp/audit`) automatically. FE does not send audit rows.
- Owner Security: high-sensitivity endpoints (below) require the caller to include header `X-Owner-Verify: <owner_password_or_pin>` re-verified in that same request (backend hashes+compares, does not create a session). Any missing/invalid header → `HTTP 428 Precondition Required`, body `{"detail":"owner_verification_required"}`. FE opens a password modal automatically.
- All list endpoints support `?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=100&cursor=<opaque>`.

---

## 0. Data model overview

### Collection: `erp_products` (extends existing `products`)
Additive fields on the current product doc. **Do NOT rename existing fields.**

```json
{
  "_id": "ObjectId",
  "vendorId": "str",              // existing
  "name": "str",                  // existing
  "image": "url",                 // existing
  "category": "str",              // existing

  "subCategory": "str",
  "brand": "str",
  "barcode": "str",               // unique per vendor
  "sku": "str",                   // unique per vendor
  "hsnCode": "str",               // 4/6/8 digits, drives GST %
  "unit": "str",                  // pcs, kg, g, ltr, ml, box, dozen, pack

  "mrp_paise": "int",
  "sellingPrice_paise": "int",
  "minSellingPrice_paise": "int",
  "discountPct": "float",
  "profitPerItem_paise": "int",   // derived
  "profitMarginPct": "float",     // derived

  "openingStock": "int",
  "currentStock": "int",          // authoritative; billing decrements
  "reservedStock": "int",         // reserved for pending online orders
  "availableStock": "int",        // derived: currentStock - reservedStock
  "soldQuantity": "int",          // lifetime
  "lowStockAlert": "int",
  "reorderLevel": "int",
  "batchNumber": "str",
  "expiryDate": "YYYY-MM-DD | null",

  "createdAt": "iso",
  "updatedAt": "iso",
  "isDeleted": "bool"
}
```

### Collection: `erp_purchases` (Purchase Book)
Every product purchase = one row. A single supplier invoice with N line items = N rows sharing `invoiceNumber` + `purchaseDate`.

```json
{
  "_id": "ObjectId",
  "vendorId": "str",

  "purchaseDate": "YYYY-MM-DD",
  "invoiceNumber": "str",
  "supplierId": "ObjectId | null",  // ref erp_suppliers
  "supplierName": "str",
  "supplierGstin": "str",
  "supplierMobile": "str",
  "supplierAddress": "str",

  "productId": "ObjectId",
  "productName": "str",
  "barcode": "str",
  "category": "str",
  "hsnCode": "str",

  "quantity": "int",
  "freeQuantity": "int",
  "purchasePriceExGst_paise": "int",   // per unit
  "gstPct": "float",
  "gstType": "CGST_SGST | IGST",
  "gstAmount_paise": "int",             // per unit
  "purchasePriceIncGst_paise": "int",   // per unit
  "totalPurchaseValue_paise": "int",    // quantity * incGst

  "sellingPrice_paise": "int",
  "mrp_paise": "int",
  "profitMarginPct": "float",
  "currentStockAtPurchase": "int",

  "createdAt": "iso"
}
```

### Collection: `erp_suppliers`
```json
{
  "_id": "ObjectId",
  "vendorId": "str",
  "name": "str",
  "gstin": "str",
  "mobile": "str",
  "email": "str",
  "address": "str",
  "state": "str",           // for IGST vs CGST+SGST inference
  "openingBalance_paise": "int",
  "currentBalance_paise": "int",
  "createdAt": "iso"
}
```

### Collection: `erp_sales` (billing lines)
Extend existing bill/order lines with these fields. If a sales table already exists, this doc represents ONE line item per bill.
```json
{
  "_id": "ObjectId",
  "vendorId": "str",
  "billId": "ObjectId",
  "invoiceNumber": "str",     // sequential per vendor
  "date": "YYYY-MM-DD",
  "timestamp": "iso",

  "productId": "ObjectId",
  "productName": "str",
  "hsnCode": "str",
  "quantity": "int",
  "unitPrice_paise": "int",
  "discount_paise": "int",
  "taxable_paise": "int",
  "gstPct": "float",
  "gstType": "CGST_SGST | IGST | EXEMPT",
  "cgst_paise": "int",
  "sgst_paise": "int",
  "igst_paise": "int",
  "total_paise": "int",

  "profit_paise": "int",       // (sellingPrice - purchaseCost) * qty
  "costOfGoods_paise": "int",  // moving avg or FIFO cost

  "paymentMode": "CASH | UPI | CARD | CREDIT",
  "customerId": "ObjectId | null",
  "customerName": "str",
  "customerGstin": "str"
}
```

### Collection: `erp_customers`
```json
{
  "_id": "ObjectId", "vendorId": "str",
  "name": "str", "mobile": "str", "gstin": "str",
  "state": "str", "address": "str",
  "openingBalance_paise": "int", "currentBalance_paise": "int",
  "lifetimePurchases_paise": "int", "visitCount": "int",
  "lastPurchaseAt": "iso"
}
```

### Collection: `erp_audit`
```json
{
  "_id": "ObjectId", "vendorId": "str",
  "actorUserId": "str", "actorRole": "OWNER | MANAGER | CASHIER | STAFF | SUPER_ADMIN",
  "action": "str",                     // e.g. product.price.update
  "entityType": "str", "entityId": "str",
  "oldValue": "any", "newValue": "any",
  "reason": "str",
  "ip": "str", "device": "str",
  "at": "iso"
}
```

### Collection: `erp_business_profile`
```json
{
  "vendorId": "str",   // primary key
  "businessType": "PROPRIETORSHIP | PARTNERSHIP | LLP | OPC | PVT_LTD | PUB_LTD | TRUST | SOCIETY | OTHER",
  "pan": "str", "gstin": "str",
  "gstRegistered": "bool",
  "gstScheme": "REGULAR | COMPOSITION | UNREGISTERED",
  "state": "str",
  "financialYearStart": "MM-DD",       // default "04-01"
  "updatedAt": "iso"
}
```

### Collection: `erp_owner_security`
Never expose `passwordHash` / `pinHash` in any GET.
```json
{
  "vendorId": "str",
  "ownerUserId": "str",
  "passwordHash": "str",  "passwordUpdatedAt": "iso",
  "pinHash": "str | null", "pinUpdatedAt": "iso | null",
  "biometricsEnabled": "bool",
  "autoLockSeconds": "int",   // default 900
  "loginHistory": [{ "at":"iso","ip":"str","device":"str","ok":"bool" }],
  "resetHistory":  [{ "at":"iso","by":"str","reason":"str" }]
}
```

### Collection: `erp_roles`
Predefined: `OWNER`, `MANAGER`, `CASHIER`, `STAFF`, plus custom.
```json
{
  "_id": "ObjectId", "vendorId": "str",
  "code": "str", "name": "str", "isSystem": "bool",
  "permissions": ["product.create", "product.read", ...]
}
```

Full permission catalogue (send in `/erp/roles/permissions/catalogue`):
```
product.create, product.read, product.update, product.delete, product.priceEdit
purchase.create, purchase.read, purchase.book.view, purchase.cost.view
inventory.read, inventory.adjust
billing.create, billing.void, billing.discount
customer.read, customer.write
supplier.read, supplier.write
gst.read, gst.file, gst.edit
report.read, report.export
accounts.view, profit.view
audit.view, role.manage
settings.read, settings.write
```

### Collection: `erp_settings` (Super Admin editable)
Single doc for whole platform. Every retailer inherits. Vendors can only see, not edit.
```json
{
  "_id": "global",
  "gstSlabs":   [ { "rate": 0 }, { "rate": 5 }, { "rate": 12 }, { "rate": 18 }, { "rate": 28 } ],
  "hsnMap":     [ { "hsn": "1006", "gstPct": 5, "description": "Rice" }, ... ],
  "thresholds": {
    "gstRegistrationTurnover_paise": 4000000000,  // ₹40 lakhs (goods) – editable
    "gstRegistrationTurnoverServices_paise": 2000000000,
    "compositionEligible_paise": 15000000000,
    "qrmpEligible_paise": 50000000000
  },
  "reminders": {
    "gstReturnDay": 20,          // day of month
    "annualReturnDate": "12-31"
  },
  "learningCenter": [
    { "slug": "what-is-gst", "title": "What is GST?", "content": "…" },
    ...
  ],
  "updatedAt": "iso", "updatedBy": "str"
}
```

---

## 1. Product Master  (Module 1)
Note: existing product endpoints stay untouched. These are additive/optional fields.

- `POST /api/erp/products` — create with all fields above. Auto-creates a `erp_purchases` row for the first stock line + updates `erp_suppliers`.
- `PUT  /api/erp/products/:id` — full update. **Requires `X-Owner-Verify` if `sellingPrice_paise`, `purchasePriceExGst_paise`, `gstPct`, or `hsnCode` are changed.**
- `PATCH /api/erp/products/:id/stock` — adjust stock. Requires `X-Owner-Verify`. Body `{delta:int, reason:str}`.
- `DELETE /api/erp/products/:id` — soft delete. Requires `X-Owner-Verify`.
- `GET  /api/erp/products?query=&category=&supplier=&lowStockOnly=bool&expiringDays=30`
- `GET  /api/erp/products/:id`
- `POST /api/erp/products/import` — CSV upload; returns dry-run report or commits.

---

## 2. Purchase Book  (Module 2)
- `POST /api/erp/purchases` — create new purchase entry (single invoice, N line items).
  Body: `{ purchaseDate, invoiceNumber, supplierId?, supplier{...}, items:[{productId, quantity, freeQuantity, purchasePriceExGst_paise, gstPct, gstType, sellingPrice_paise, mrp_paise, batchNumber?, expiryDate?}] }`
  Side effects: increments `currentStock` on each product; recomputes moving-avg cost; writes audit rows.
- `GET  /api/erp/purchases?from&to&supplierId&productId`
- `GET  /api/erp/purchases/summary?from&to` →
  `{ totalPurchaseValue_paise, totalGstPaid_paise, totalProducts, totalSuppliers, avgProfitMarginPct, currentInventoryValue_paise }`
- `GET  /api/erp/purchases/:id`
- **Requires `X-Owner-Verify` for view + all writes** (Purchase Book is Owner-protected per Module 17).

---

## 3. Inventory  (Module 3)
- `GET /api/erp/inventory/summary` →
  `{ currentStock, availableStock, reservedStock, inventoryValue_paise, lowStockCount, outOfStockCount, deadStockCount, fastMoving:[{productId,name,soldQty30d}], slowMoving:[{productId,name,daysSinceLastSale}] }`
- `GET /api/erp/inventory/low-stock`
- `GET /api/erp/inventory/dead-stock?days=60`
- `POST /api/erp/inventory/adjust` — body `{productId, delta, reason}`. Requires `X-Owner-Verify`.

---

## 4. Billing  (Module 4)
This should re-use the existing POS bill endpoint but ALSO write `erp_sales` rows and:
1. Decrement `currentStock` (never below 0; return `409` if oversell).
2. Increment `soldQuantity`.
3. Recalculate GST split (CGST+SGST if same state, else IGST) using `erp_settings.hsnMap`.
4. Write `erp_audit` row (`bill.create`).
5. Return updated dashboard deltas for FE optimistic UI:
   ```json
   { "billId":"...", "todaySalesDelta_paise": 12345, "todayGstDelta_paise": 234, "todayProfitDelta_paise": 456 }
   ```

- `POST /api/erp/bills` — create bill (may be identical to existing POS create; return the deltas above)
- `POST /api/erp/bills/:id/void` — void with reason. Requires `X-Owner-Verify`.
- `GET  /api/erp/bills?from&to&paymentMode&customerId`
- `GET  /api/erp/bills/:id`

---

## 5. Price Lock  (Module 5)
Enforced via `X-Owner-Verify` on the four mutation endpoints already flagged above. Additionally:
- `GET /api/erp/price-history/:productId` → `[{ at, field, old, new, actor, reason }]`

---

## 6. Accounts Dashboard  (Module 6)
- `GET /api/erp/accounts/dashboard` →
```json
{
  "today":    { "sales_paise":..., "purchase_paise":..., "orders":..., "profit_paise":..., "gst_paise":..., "expenses_paise":..., "netEarnings_paise":... },
  "month":    { ...same shape... },
  "lifetime": { ...same shape... }
}
```
Owner-protected. Caller must send `X-Owner-Verify`.

---

## 7. Profit Dashboard  (Module 7)
- `GET /api/erp/profit/dashboard?from&to` →
```json
{
  "totalPurchaseValue_paise":..., "totalSalesValue_paise":...,
  "grossProfit_paise":..., "netProfit_paise":..., "profitPct":...,
  "avgMarginPct":...,
  "bestSelling":  { "productId":"", "name":"", "qtySold": 0, "revenue_paise": 0 },
  "lowestSelling":{ ... },
  "highestProfit":{ "productId":"", "name":"", "profit_paise": 0 },
  "lowestProfit": { ... }
}
```
Owner-protected.

---

## 8. GST Dashboard  (Module 8)
- `GET /api/erp/gst/dashboard?period=YYYY-MM` →
```json
{
  "taxableSales_paise":..., "exemptSales_paise":...,
  "inputGst_paise":..., "outputGst_paise":...,
  "cgst_paise":..., "sgst_paise":..., "igst_paise":...,
  "gstPayableEstimate_paise":..., "gstRefundEstimate_paise":...,
  "filingStatus": "PENDING | FILED | OVERDUE",
  "nextReturnDueDate": "YYYY-MM-DD"
}
```
Owner-protected. FE must render a bold "estimates only — verify before filing" banner.

**Timeline sub-endpoint** (Owner-protected):
- `GET /api/erp/gst/timeline?year=YYYY` → returns 12 months of filing status for the given Indian FY (Apr → Mar):
```json
{
  "months": [
    { "month": "2025-04", "status": "FILED|DUE|OVERDUE|UPCOMING",
      "gstPayable_paise": 0, "daysToDue": null, "daysLate": null,
      "lateFee_paise": 0, "filedAt": "iso|null" }
  ]
}
```
`lateFee_paise` uses a configurable daily rate from `erp_settings` (currently ₹50/day placeholder in FE). Frontend renders a colour-coded rail below the GST Dashboard.

---

## 9. Smart GST Assistant  (Module 9)
- `GET /api/erp/gst/assistant?period=YYYY-MM` →
```json
{
  "lines": [
    { "type": "collected",  "text": "You collected ₹12,345 GST from customers." },
    { "type": "paid",       "text": "You paid ₹8,000 GST while purchasing products." },
    { "type": "payable",    "text": "Estimated GST payable is ₹4,345." },
    { "type": "itc",        "text": "You may be eligible to claim Input Tax Credit on eligible purchases." },
    { "type": "disclaimer", "text": "Please verify these figures before filing your GST return." }
  ]
}
```
Backend generates via templated strings using `erp_settings.learningCenter` copy. Owner-protected.

---

## 10. Business Profile  (Module 10)
- `GET /api/erp/business-profile`
- `PUT /api/erp/business-profile`
- **Registration**: Existing vendor onboarding must additionally collect the fields listed in Module 10 (business type, PAN, GSTIN, scheme, state). FE currently posts these to `/api/vendors/apply` — please extend the vendor application payload to include `businessProfile` object.

---

## 11. Business Compliance Guidance  (Module 11)
- `GET /api/erp/compliance/status` →
```json
{
  "annualTurnover_paise": 6543210,
  "flags": [
    { "level":"INFO",    "code":"BELOW_GST_THRESHOLD", "text":"You are currently below the GST registration threshold." },
    { "level":"WARNING", "code":"NEAR_GST_THRESHOLD",  "text":"You are within 10% of the GST registration threshold." }
  ]
}
```
Thresholds come from `erp_settings.thresholds` — NEVER hard-code.

---

## 12. Return Reminders  (Module 12)
- `GET /api/erp/reminders` → list of upcoming/overdue reminders (GST return, annual return, missing bills, missing GSTINs, incomplete invoices, low stock, out of stock).
```json
[
  { "kind":"GST_RETURN", "dueDate":"2026-03-20", "text":"GSTR-3B for Feb 2026 due in 8 days.", "severity":"WARNING" },
  { "kind":"LOW_STOCK",  "productId":"abc",     "text":"Basmati Rice 5kg is below reorder level (3 left).", "severity":"INFO" }
]
```

---

## 13. Income Tax Dashboard  (Module 13)
- `GET /api/erp/income-tax/dashboard?financialYear=2025-26` →
```json
{
  "annualSales_paise":..., "annualPurchases_paise":...,
  "grossProfit_paise":..., "businessExpenses_paise":...,
  "netBusinessIncome_paise":..., "estimatedTaxableIncome_paise":...,
  "disclaimer": "These are estimates for business accounting and should be verified before filing taxes."
}
```
Owner-protected.

---

## 14. Financial Health  (Module 14)
- `GET /api/erp/financial-health?months=6` →
```json
{
  "salesGrowthPct": 12.3, "purchaseGrowthPct": 8.1,
  "monthlySeries": [ { "month":"2025-09", "sales_paise":..., "purchase_paise":..., "profit_paise":..., "margin":0.14 }, ... ],
  "highestSalesMonth": "2025-11", "lowestSalesMonth": "2025-08",
  "cashSales_paise":..., "upiSales_paise":..., "cardSales_paise":..., "creditSales_paise":...,
  "outstandingPayments_paise":..., "inventoryValue_paise":...
}
```
Owner-protected.

---

## 15. Reports  (Module 15)
- `GET /api/erp/reports/:kind?from&to&format=pdf|excel|csv|json`
  - kinds: `purchase | sales | profit | gst | inventory | supplier | customer | category | product | payment`
  - `format=json` returns rows; `pdf/excel/csv` returns download URL: `{ "url": "https://.../reports/xyz.pdf", "expiresAt":"iso" }`
- Report generation is background-queued for large ranges; FE polls `GET /api/erp/reports/jobs/:jobId` for status.

---

## 16. Search  (Module 16)
- `GET /api/erp/search?q=&type=product|barcode|supplier|invoice|gstin|category|brand|batch`
- `GET /api/erp/search/filters` → returns `{ periods:[...], suppliers:[...], categories:[...], gstSlabs:[...] }` to populate FE filter dropdowns.

---

## 17. Owner Security  (Module 17)
On shop creation, backend must:
1. Force the Owner to POST `/api/erp/owner-security/init` `{ password, pin?, biometricsEnabled? }` before any ERP module is accessible.
2. Return `{ enrolled: true }`.

Endpoints:
- `GET  /api/erp/owner-security/status` → `{ enrolled, biometricsEnabled, autoLockSeconds, passwordUpdatedAt, pinUpdatedAt }`
- `POST /api/erp/owner-security/verify` → body `{ password | pin | webauthnAssertion }` returns `{ ok: true, verifiedAt:"iso" }`. **No session token issued** — verification is per-request via `X-Owner-Verify` header.
- `POST /api/erp/owner-security/change-password` → requires current password
- `POST /api/erp/owner-security/change-pin` → body `{ currentPassword, newPin }` (4–6 digits). Enables the **PIN Fast Path** used by cashiers on shared devices. Frontend `OwnerLockGate` exposes a Password/PIN toggle.
- `PATCH /api/erp/owner-security/settings` → biometricsEnabled, autoLockSeconds
- `GET  /api/erp/owner-security/history` → login + reset history

Selected user preference (this build): **Full password re-prompt every time on protected screens.** No caching. FE opens `<OwnerLockModal/>` before each protected fetch/mutation. The modal posts `password` inside `X-Owner-Verify` on the follow-up call directly (transport it via `_ownerPassword` argument in `lib/erp.js`).

Owner-protected screens (FE will guard these routes with `<OwnerLockGate/>`):
- Purchase Book, Purchase Cost columns, Accounts Dashboard, Profit Dashboard, GST Dashboard, Inventory Value, Reports (any), Supplier Details, Financial Settings, Owner Settings.

---

## 18. Owner Settings  (Module 18)
Handled by the endpoints in Module 17.

---

## 19. Super Admin Reset  (Module 19)
- `POST /api/admin/erp/owner-security/reset` — body `{ vendorId, reason, verificationDoc }`.
  - Callable only by roles that include `SUPER_ADMIN`.
  - Never returns the existing password.
  - Sends a one-time reset token to the vendor's registered mobile/email.
  - Forces new password creation at next login; sets `mustResetPassword: true` on `erp_owner_security`.
  - Writes an entry to `erp_audit` with actor = super admin id.

---

## 20. Role Permissions  (Module 20)
- `GET  /api/erp/roles` — list roles for the vendor
- `POST /api/erp/roles` — create custom role
- `PUT  /api/erp/roles/:id` — update permissions
- `DELETE /api/erp/roles/:id` — delete (system roles cannot be deleted)
- `GET  /api/erp/roles/permissions/catalogue` — full permission list (see collection doc above)
- `POST /api/erp/staff` — add staff `{ name, mobile, roleCode }` → returns invite link
- `GET  /api/erp/staff`
- `PATCH /api/erp/staff/:id` — reassign role / disable
- Owner-protected.

FE enforces UI-level guards using `useHasPermission("product.priceEdit")`. Backend MUST also enforce on every endpoint.

---

## 21. Audit Log  (Module 21)
- `GET /api/erp/audit?from&to&actorId&entityType&action&limit=200&cursor=`
- All ERP writes automatically create audit rows — FE never sends them directly.
- Owner-protected.

---

## 22. Smart Retail Learning Center  (Module 22)
Content is Super Admin editable. Stored in `erp_settings.learningCenter`.

- `GET /api/erp/learn` — public (no auth) list of `{ slug, title, excerpt }`
- `GET /api/erp/learn/:slug` — full content (markdown)

Frontend ships default English content (see `/app/frontend/src/lib/learningContent.js`) that the backend can seed once. Super Admin can edit any topic in `/admin/erp-settings` → Learning Center tab.

Topics:
`what-is-gst`, `input-gst`, `output-gst`, `itc`, `profit`, `gross-profit`, `net-profit`, `turnover`, `taxable-value`, `hsn-sac`, `gst-return`, `purchase-records`, `why-invoices-matter`.

---

## 23. UI Contract  (Module 23)
No backend work. FE responsibility. Documented here so backend can preview mock responses to test bandwidth.

---

## Super Admin ERP Settings

- `GET  /api/admin/erp-settings`
- `PUT  /api/admin/erp-settings` — full replace
- `PATCH /api/admin/erp-settings/gst-slabs`
- `PATCH /api/admin/erp-settings/hsn-map`
- `PATCH /api/admin/erp-settings/thresholds`
- `PATCH /api/admin/erp-settings/reminders`
- `PATCH /api/admin/erp-settings/learning-center`

All require role `SUPER_ADMIN`.

---

## Error contract

- `400` — validation
- `401` — token missing / expired
- `403` — role missing permission
- `404` — endpoint not implemented (FE falls back to local storage silently)
- `409` — business conflict (oversell, duplicate barcode, etc.)
- `428` — owner verification required → FE opens password modal

All errors: `{ "detail": "human_readable_snake_case" }`.

---

## Rollout order (recommended for backend team)

1. `erp_products` (extend), `erp_purchases`, `erp_suppliers`, `erp_customers` — data layer
2. `POST/GET /erp/products`, `POST/GET /erp/purchases`
3. Wire billing → `erp_sales` + stock decrement
4. Dashboard aggregates (accounts, profit, GST, inventory summary)
5. Owner security + audit log
6. Roles + staff
7. Reports (json first, PDF/Excel last)
8. Compliance + reminders
9. Super Admin `erp_settings`
10. Learning center

Every phase can go live independently — FE will lift off local storage automatically.
