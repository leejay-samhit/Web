# Slangcart Web — Product Requirements

## Original problem statement
Build the WEB FRONTEND for an existing Slangcart app (referral + e-commerce + chat platform). The user already has a deployed backend + MongoDB at `https://network-pay-1.emergent.host`. DO NOT build a new backend; this Emergent job only ships a React web frontend that calls the existing `/api/*` endpoints.

Required screens (parity with the mobile app):
- Login (email + password, JWT)
- Dashboard (referrals, wallet, network stats)
- Shop (products, categories, search, product detail, cart, checkout via Razorpay)
- Services (apply, invoices)
- Slang-Connect chat (thread list + chat detail, text + image)
- Wallet (balance, transactions, withdrawals)
- Network (matrix tree)
- Profile (edit, notifications, change password)
- Admin section (`/admin/users|products|orders|broadcast|branding`) — only when `role=admin`

Branding: name "Slangcart", primary `#0F6E4F`, accent `#E8F4ED`, left sidebar (desktop) + bottom tabs (mobile). JWT stored in `localStorage`, sent as `Authorization: Bearer <token>`.

## Architecture
- **Stack:** CRA + craco + Tailwind + react-router 7 + axios + lucide-react
- **State:** lightweight React context (`AuthContext`, `CartContext`)
- **Backend:** EXTERNAL at `https://network-pay-1.emergent.host`. Configured via `REACT_APP_BACKEND_URL` in `/app/frontend/.env`.
- **Auth:** JWT in `localStorage` (`sc_token`, `sc_refresh`, `sc_user`); axios interceptor auto-refreshes via `/api/auth/refresh` and bounces to `/login` on 401.
- **Payments:** Razorpay client-side checkout (`checkout.js` loaded on demand). Order creation + signature verification happen on the external backend.
- **Admin gating:** `ProtectedRoute adminOnly` checks `user.role === "admin"` or any `user.admin_role`.

## User personas
1. **Regular user** — registers, refers friends, shops, books services, chats, withdraws earnings.
2. **Admin** — manages users, products, orders, broadcasts, and branding.

## Core requirements (delivered, 27-Jun-2026)
- Login + register screens with JWT flow.
- Dashboard with referral hero, wallet balance, total earned, direct referrals, payouts, quick actions, recent orders, promo banners.
- Shop with category chips and search; product detail with add-to-cart and buy-now; cart with badge, remove, totals; full checkout flow that opens Razorpay using key from `/api/payment/config` and verifies via `/api/payment/verify`.
- Services list with search + PIN filter, booking modal, my reveals/invoices.
- Slang-Connect chat: threads list + active thread with polling, text + image (≤3MB) messages, sender bubbles.
- Wallet: balance hero, transactions, withdrawals, request withdrawal modal.
- Network: matrix tree (flattened/expandable to keep visual-edits babel plugin happy).
- Profile: avatar upload, address edit, bank/UPI, change password, notifications.
- Admin: users (search, block/unblock, reset password), products (create/delete), orders (filter + status change), broadcast (compose + history), branding (edit text + colors).
- Responsive: desktop sidebar + mobile bottom tabs (4 tabs to clear the platform badge; Profile reachable via header avatar).

## Backlog / Next actions
- **DONE (27-Jun-2026, iter 5)** — Major feature-parity update with the mobile app. Backend coverage jumped from 37/269 endpoints to ~60/269. **13 new pages** and 1 new modal component shipped:
  - **End-user (Tier A):** `Wishlist` (with heart toggle on `ProductDetail`), `KYC` (Aadhar/PAN upload + additional docs), `Tickets` + `TicketDetail` (create/reply/close support tickets), `ServiceBookings` (customer + provider role toggle), `BecomeProvider` (apply / edit service profile), `BecomeVendor` (vendor application), `Legal/:kind` (terms, privacy, refund), plus `WalletTransferModal` (user-to-user wallet send) wired into the Wallet hero. ProductDetail also gained "I'm interested" via `/api/products/{id}/interested`.
  - **Vendor module (Tier B):** `VendorDashboard` with Products/Sales/Q&A tabs (`/api/vendor/me/products`, `/sales`, `/stats`, `/questions`), inline product create + delete.
  - **Admin deep-dive (Tier C):** `AdminAnalytics` (configurable 7/30/90 day window), `AdminApprovals` (pending/approved/rejected + approve/reject actions), `AdminKYC` (review modal with all docs + approve/reject), `AdminWithdrawals` (approve / approve-and-complete / mark-paid / reject + status tabs), `AdminTickets` (status + priority + assignee inline updates, stats dashboard).
  - **Sidebar** expanded with 5 new user nav items (Wishlist, My bookings, My shop, Support, KYC) and 5 new admin nav items. Profile page now has a "More" section linking to KYC / Become Provider / Become Vendor / Support / Terms / Privacy.
  - **Bug fix during this round:** `.env` had been reset to the preview URL, breaking all API calls with "Not Found". Restored to `https://network-pay-1.emergent.host` and restarted.
- **DONE (iter 4)** — Constants/hooks/sub-components refactor; 17 sub-components + 3 custom hooks.
- **DONE (27-Feb-2026, iter 6)** — **Admin parity update.** Restructured the admin sidebar into 3 grouped sections (STORE, OPERATIONS, EXPORT DATA) and shipped **22 new admin pages** to mirror the mobile admin slide-out (~31 admin nav items total). New pages:
- **DONE (27-Feb-2026 evening, iter 9)** — **Massive web↔mobile parity drop:**
  - **Admin · System Wallet (Treasury) rewritten** for full 8-Group Ledger parity: bank-balance tally card (inflow / outflow / net / UTR deposits + formula), Company net worth card with 5-component breakdown, 8 ledger group cards (Revenue / User Liability / GST / Platform Fee / Expense / Pending Withdrawals / Bank / Refund) each with sub-stats, UTR-aware Direct-added Money form (`amount` + `utr` + `bank_ref` + `remarks`), Manual Adjustment / Expense form (`category` from `/admin/expenses/categories`, `amount`, `vendor`, `description`, `utr`, `reference`), Withdraw-for-Account-Tally summary, User Source Accountability grid (`/admin/system-wallet/source-breakdown`), Money-flow drift alerts feed with resolve action (`/admin/ledger-alerts`), 3 CSV exports (Transactions / Expenses / Bank Ledger via `/admin/finance/export/{kind}`), Reconcile, and a Recent Expenses table.
  - **Admin · Shop Layout rewritten** to support all 12 block types — banner_slider, new_banner, announcement, category_circles, brand_slider, product_grid, horizontal_slider, content_box, flash_sale, offer_cards, sub_category_label, free_text. New `BlockEditor` modal at `components/admin/BlockEditor.jsx` shows the right fields per type (items list with sub-item image upload, product picker with manual / auto_latest / auto_category / auto_featured data sources, flash-sale countdown datetime, colors/text-align/font-size/height styling, scope home/category). Block-type registry centralized in `constants/shopBlocks.js`.
  - **User · /shop renders the shop-layout blocks** via a new `components/shop/ShopBlock.jsx` renderer that supports every block type (incl. live flash-sale countdown), placed above the category chips when not filtering. Category filter now does multi-field match across `category_id`, `category`, `category_slug`, `sub_category`, `shop_category_id`, `category_name` so the previous "no products found" bug is fixed.
  - **Location capture** via `useUserLocation` hook (`navigator.geolocation` → POST `/api/users/me/location`) shown as a `LocationBanner` at the top of `/shop` and `/services`.
  - **Header wishlist icon** added next to the cart icon in `Layout.jsx`.
  - **Admin · Products modal extended** with full mobile parity: brand / category / sub_category, primary image + up to 8 additional images, sub_features (one-per-line), what's-in-the-box (one-per-line), specs (`attrs_brand/os/ram/cpu_model/cpu_speed/storage`, `clothing_size`, `extra_attrs` as `key: value` lines), price/protection/warranty/delivery styled summaries. Modal is now `max-w-2xl` with collapsible `<details>` sections.
  - Backend untouched. Testing agent verified all of the above end-to-end against the live backend at **100% (28/28)**.

  - **STORE:** `AdminShopLayout` (blocks CRUD + reorder + seed-default), `AdminShopCategories` (CRUD + seed), `AdminPromoBanners` (legacy, image upload as data URL).
  - **OPERATIONS:** `AdminAdmins` (admin access — create / demote), `AdminApprovedRegistrations`, `AdminRejectedRegistrations`, `AdminPaymentGateway` (Razorpay key/secret/webhook-secret + test connection + clear-db-override; shows masked secret and source), `AdminVendorApplications`, `AdminServiceApplications`, `AdminServiceCategories` (categories + subcategories CRUD), `AdminServiceAnalytics` (availability + by-category), `AdminDistributors` (per-user pincode assignments + bulk unassign), `AdminSystemWallet` (treasury buckets + deposit / tally-withdraw / reconcile + inflow/outflow breakdown + recent txns), `AdminVendors` (suspend/reactivate), `AdminBackups` (snapshot + restore + delete), `AdminChanges` (product roadmap / admin actions feed with defensive object coercion via `safeStr`), `AdminTransactions` (typed tabs + reverse), `AdminAuditLogs` (`safeStr`-hardened against `{id,name}` object drift), `AdminSettings` (full payout structure editor — hides `id`, `*_hash`, `*_at` and `danger_pin_*` from the UI), `AdminUPIPayments`, `AdminLegalPages` (per-kind editor using `content_text`).
  - **EXPORT DATA:** `AdminExports` — one page with 4 CSV download cards (users / transactions / withdrawals / orders).
  - Added `/admin/chat` route as a convenience redirect to the existing `/chat` (admin can chat with team + users from the same surface as the mobile app).
  - Verified end-to-end against the live external backend at `https://network-pay-1.emergent.host`. Real KPIs render on `/admin/analytics` (kpis shape), real Razorpay key shown on `/admin/payment-gateway`, real treasury buckets shown on `/admin/system-wallet`, real CSV download verified on `/admin/exports`. Frontend testing agent: **60/61 assertions PASS (~98%)**; the single bug (AdminChanges crashing on object-valued admin_id/admin_role/target_id) was fixed in-place and the defensive `safeStr` utility was added to `lib/utils.js` and also applied to AdminAuditLogs.

- **DONE (iter 3)** — Logger, empty-catch elimination, list keys, cross-tab logout, ProtectedRoute from cache.
- **DONE (iter 2)** — Admin section validated with super_admin.
- **OPEN — backend** — `https://slangcart.com` (production custom domain) is **not yet in the backend CORS allow-list**. Add it to `ALLOWED_ORIGINS` on the `network-pay-1` job. Login UI now surfaces this clearly.
- **OPEN — backend** — Migrate auth to httpOnly cookies.
- **OPEN — backend** — Intermittent 401 on admin broadcasts after branding write.
- **OPEN — backend** — Chat 403 on Test user's own thread.
- **DONE (29-Jun-2026, post-iter-14)** — **Concurrent web↔app sessions live.** Backend single-session enforcement has been lifted (verified via two parallel POST `/auth/login` calls — both tokens return 200 from `/auth/me`). Softened the `Login.jsx` session-revoked notice to a generic "Your session ended" so the old "single session per account" copy is gone.
- **DONE (29-Jun-2026, post-iter-14)** — **System Wallet Treasury math reconciled & verified.**
  - All 6 backend formulas validated live: Bank Net, Group 1 gross, Group 3 GST payable, Group 5 outflow check, Group 7 balance, Master net worth.
  - Fixed Group 1 sub-stat layout — removed duplicated `platform_fee` row.
  - Added **Σ‑verify chips** to every additive/subtractive card.
  - Added one-line formula caption beneath every group card.
- **DONE (29-Jun-2026, late evening)** — **POS cloud migration wired (zero-downtime auto-promote).**
  - Added `src/lib/posCloud.js` — full async client for the 14 endpoints in `SALES_BACKEND_SPEC.md`, including 60-second cached `probeCloud()` so we don't spam 404s.
  - `createInvoice` now mirror-writes to the cloud (best-effort, never blocks the local write). Successful cloud writes mark the local row with `cloud_id` + `cloud_synced_at`. Same mirroring for cancel & refund.
  - Added `bulkPushToCloud(uid)` and `pullFromCloud(uid)` helpers — used by the new **Cloud sync** panel on `/vendor/settings` that shows: current cloud availability (live probe), local invoice count, synced count, pending push count, manual Push / Pull buttons.
  - As long as backend POS endpoints don't exist → panel says "📴 not deployed yet" and falls back silently. The moment the backend dev ships them, the probe flips to ✅ and the vendor can push their entire localStorage history in one click. From that point every new bill is double-written (local + cloud) and the migration is complete.
  - Updated `SALES_BACKEND_SPEC.md` with the `bulk-import` contract the new code expects.
- **DONE (29-Jun-2026, evening, post-deploy)** — **Vendor Sales / POS module v1 shipped (paths A+B+C combined).**
  - New routes under `/vendor/*`: `sales` (KPI dashboard), `pos` (billing screen), `invoices` (history + filters + cancel/refund/print), `cash` (daily closing + business statement), `analytics` (recharts: daily-trend line + revenue pie + top-products bar + top lists), `settings` (invoice prefix, business name/address/GSTIN, default GST, opening balance).
  - Shared `<VendorNav />` chip strip mounted on every vendor page including the existing `VendorDashboard`.
  - **Data layer:** `src/lib/vendorSales.js` — single file that owns all POS persistence (localStorage today, swappable to backend in one pass when the spec endpoints exist). Includes: `computeTotals` (handles discount %, GST inclusive/exclusive, round-off), `createInvoice` (with inventory pre-flight), `getCashSummary`, `getStatement` (running balance), `getAnalytics` (top-products / daily trend).
  - **Inventory sync IS real-time** via `PATCH /vendor/me/products/{id}` — every completed bill decrements stock in the live catalog, so the public Shop, mobile app and Admin all see new stock counts immediately. Out-of-stock products are disabled in the POS search.
  - **POS billing screen** features: instant product search (name / barcode / SKU / category), live suggestions, qty +/− stepper, per-line manual discount (₹ or %) and GST %, bill-level discount, round-off toggle, GST-inclusive toggle, walk-in vs named customer with GSTIN field, multi-mode split payments (Cash / UPI / Debit / Credit / NetBanking / Wallet / Credit Sale), grand-total balance reconciliation, success modal with Print / Save-as-PDF (browser print dialog).
  - **Invoice prefix** is vendor-editable from `/vendor/settings` (preview shows `${prefix}-${nextNumber}`). Default `SLG-INV-2026-000001`.
  - **Strict isolation:** zero touchpoints with the Slangcart wallet, GST ledger, platform fee ledger or system wallet treasury. The new module never POSTs to any wallet endpoint.
  - **Backend spec doc** written at `/app/memory/SALES_BACKEND_SPEC.md` listing the 14 endpoints + 7 collections + Pydantic models + migration plan needed to move POS persistence from localStorage to the real backend. Migration is a one-file change in `src/lib/vendorSales.js` when the backend ships.
- **DONE (29-Jun-2026, evening, post-deploy)** — **Service parity polish (4 user-requested tweaks):**
  1. **Editable "Service money" (phone-reveal) fee** in Admin Settings. New top-of-page card with editable `phone_reveal_fee` (₹) + `phone_reveal_gst_pct` (%) inputs, a live "user pays" preview (default ₹1 + 18% = ₹1.18), and dedicated save button. The backend's current `SettingsUpdate` Pydantic schema does NOT yet accept these two fields → the save surfaces a clear inline remediation note instructing the admin to add `phone_reveal_fee: float | None = Field(default=None, ge=0)` and `phone_reveal_gst_pct: float | None = Field(default=None, ge=0, le=100)` to `SettingsUpdate` on `network-pay-1` and redeploy.
  2. **Book CTA removed** from `/services` everywhere on web: gone from the ServiceCard list tile and from the ProviderProfileModal. Phone-reveal stays as the single conversion action. (Mobile app needs the same change made by the mobile team.)
  3. **Admin Service Applications — Edit + Active/Inactive.** New per-row "Edit details" modal that PATCHes user-level fields (name, email, phone, UPI ID, account holder, bank account, IFSC) via `PATCH /admin/users/{user_id}`. New "Inactivate" / "Activate" toggle that calls `POST /admin/users/{user_id}/block` and `POST /admin/users/{user_id}/unblock` respectively. Each approved card now shows an Active/Inactive status chip alongside the existing Approved chip. Status fetched lazily via `q=email` (backend `q` doesn't match UUIDs, so we search by the application email).
  4. **Sub-categories now showing** in `/services`. New chip strip appears under the Category strip whenever a category is selected, populated from `GET /service-subcategories?parent_id={category_id}`. Selecting a sub-category appends `subcategory_id` to `/services` and re-filters the list.
- **DONE (29-Jun-2026, post-iter-14, evening)** — **Off-bank service receipts re-shaped per user directive.**
  - User clarified that "Service Received" amounts are paid offline/direct to provider and never touch the platform bank, so they MUST be excluded from Bank Tally Net.
  - Bank Tally card now shows: Inflow = `inflow − service`, Net (bank) = `(inflow − service) − outflow`, plus a new **"Service margin (off-bank)"** row that highlights the offline service amount with the caption "Paid offline/direct to provider — not in bank tally".
  - Company Net Worth now decomposes as `bank_net + service_margin + pending − user_wallet − pending_withdrawals − gst_payable` — service margin is re-added so total net worth is unchanged in value but properly attributed across the right buckets.
  - Σ‑verify chips updated to use the new client-side recompute and both chips still render green on live data.
- **DONE (29-Jun-2026, iter 14)** — **P0 parity batch (4/4 PASS).**
  - **A · Services rewritten** — Browse-by-Category chip strip (fetches `/services/categories`, filters via `?category_id=`). ServiceCard now opens a full **ProviderProfileModal** (`/services/{id}/profile` + `/services/reveal-config`) with KYC/languages/PIN/rating chips, charge card, and a **GST-aware Reveal-contact card**: shows fee + GST + total + wallet balance, a non-negotiable "I agree" terms checkbox, insufficient-balance gating, and `POST /services/{id}/reveal-phone` to debit wallet & reveal. Profile modal also has a Book-now CTA wired to the existing booking modal.
  - **B · Register parity** — After successful `/auth/register`, if `registration_paid` is falsy the page transitions to a `reg-pay-step` UI with the ₹100 + ₹18 GST = ₹118 breakdown and a `Pay & activate` button calling `POST /payment/register-fee` → `refreshMe()` → `/dashboard`. Added a defensive `formatApiError` helper that coerces FastAPI 422 detail arrays into a readable string (fixes a HIGH-priority silent-failure bug surfaced by the testing agent). Form is now `noValidate` so the client-side guard surfaces an in-page `reg-error` on empty submit.
  - **C · AdminProducts** — Added a new **Spec tabs (advanced)** textarea (`ap-spec-tabs`) with `name | label:value; …` parser feeding the backend's `SpecTab[]` shape. Fixed `whats_in_box` payload from the legacy `{label}` → the correct `{name, image_data_url}` schema. All 25 expected `ap-*` testids are present.
  - **D · AdminSystemWallet** — `GroupCard` is now a `<button>` with hover-lift, "Tap to view transactions →" hint. Added **GroupTxnsModal** that fetches `/admin/finance/groups/{group_id}/transactions?limit=100` and renders a When/Type/Description/Status/Amount table (`g-txns-table`) with proper close-button.
  - Restored `REACT_APP_BACKEND_URL` from the preview URL drift back to `https://network-pay-1.emergent.host`.
  - **Test report:** `/app/test_reports/iteration_14.json` — Task A 12/12, Task B 5/5 happy path (+ the 422 fix self-verified), Task C 25/25 testids, Task D modal/table/close 100%. Regression 100%.
- **P1** — Add product Questions & Reviews UI on `ProductDetail` (endpoints already exist: `/products/{pid}/questions`, `/products/{pid}/reviews`).
- **P2** — Shop layout from `/shop-layout`; brand/vendor "search-as-you-type" using `/brands/suggest`, `/vendors/suggest`.
- **P2** — WebSocket chat replacing polling.
- **P2** — Order detail page with timeline + invoice download (`/transactions/{id}/invoice.pdf`).
- **P2** — Web push registration (`/register-push`).
- **P3** — i18n, offline cart cache.

## Latest updates (04-Jul-2026 — batch drop)
- **DONE — Order-management polish.** Excel exports (Admin + Vendor) now include **Order Number** (per-vendor sequential for vendors, global sequential for admin), **Date `DD-MM-YYYY`**, **Time `hh:mm AM/PM`** — new helpers `formatOrderDate`, `formatOrderTime`, `assignOrderNumbers` in `src/lib/orders.js`. Excel column count grew from 8 → 11 with the same fixed contract.
- **DONE — Vendor Orders UX cleanup.** Replaced the amber "Backend not ready" error with a friendlier neutral empty state ("You manage every order · Admin sees this data as read-only"). Added a **Delivered confirmation modal** ("Cash of ₹X collected?" for COD or "Handed over?" for UPI) that also sends `mark_paid: true` to the backend to flip the invoice's payment status. Modal is one-tap Yes / Not-yet.
- **DONE — Invoices CSV upgrade** (`VendorInvoices.jsx`): CSV now has 17 columns including **CGST / SGST split**, **Customer GSTIN**, **Order Number**, **Date `DD-MM-YYYY`**, **Time `hh:mm AM/PM`** — the format your CA needs for GSTR-1 reconciliation.
- **DONE — Cash Summary fix**: "Bills generated" row no longer shows a ₹ symbol (it's a count). Uses `Intl.NumberFormat` for thousand separators.
- **NEW MODULE — Vendor → Substore transfers.**
  - New page `/vendor/substore` (`VendorSubstore.jsx`): 4 KPI cards (Total, Pending, Accepted, Total value), search, CSV download, new-transfer modal.
  - Substore management panel added to `/vendor/settings`: add email/name/GSTIN/phone/note, list, remove. Substores are picked from a dropdown in the transfer modal.
  - Transfer record: `TRF-YYYYMMDD-####` sequential ID, product name, SKU, **serial number**, **IMEI**, qty, unit price, from/to emails, status (pending/accepted/rejected/cancelled).
  - Accept / Cancel actions from the ledger table.
  - CSV export with 18 columns including transfer #, date, time, initiator, acceptor, product, serial, IMEI, qty, value, note.
  - Currently `localStorage`-backed per-browser; will swap to backend endpoints once shipped (spec below).
  - Vendor nav updated with "Vendor → Substore" tab.
- **DOC — `/app/memory/BACKLOG_BACKEND_SPEC.md`** — 10-section spec covering everything the backend team needs to unlock the deferred features:
  1. Admin Products PIN + Vendor filter + stock enrichment
  2. Vendor Products stock Excel
  3. Vendor POS search by serial + IMEI
  4. CGST/SGST split + GST-inclusive
  5. POS Payment popup card capture (manual, no gateway)
  6. Q&A vendor reply → user chat auto-thread
  7. Vendor network downline
  8. Delivered → auto-Paid flow
  9. `order_seq` + `vendor_order_seq` DB fields
  10. Substore transfer endpoints
- CI build green, zero warnings.

### Deferred to next drop (blocked on backend)
- Admin Products PIN + Vendor filter dropdowns + filtered Stock Excel + delete-button removal (§1)
- Vendor Products Stock Excel download (§2)
- Vendor POS search by serial / IMEI + CGST/SGST split UI + Payment popup card capture (§3, §4, §5)
- Q&A vendor reply → user chat (§6)
- Vendor Network downline visualization (§7)
- Sales Dashboard drill-through / clickable KPI cards folding online + offline into single view (needs backend `/vendor/me/stats` fields — already speced in the CONFIRMED backend drop)

## Verification status
- 04-Jul-2026: iter-15 E2E confirmed login, shop, PDP, cart hydration, COD checkout, admin Treasury, onboarding-terms, T&C gates. Post-substore-drop screenshots pending vendor-account access — Substore page loads for vendor-role only per `userGuard`.
  - **New `/vendor/orders` page** (`src/pages/vendor/VendorOrders.jsx`): vendor's inbox of orders that contain their products. Each order card shows customer name/phone/address (always visible per business rule), item list with thumbnails, and tap-to-advance stage buttons. Filters by stage (Placed → Confirmed → Paid → Processing → Packed → Shipped → Out for delivery → Delivered / Cancelled / Returned), search, Excel download.
  - **`/admin/orders` rewritten to READ-ONLY**: removed the "Update status" dropdown; added search, stage chip filter, `View` detail modal (shows customer + vendor + address + items + timeline), and Excel download. A "Read-only · vendors own order stages" chip explains the change.
  - **Shared helpers `src/lib/orders.js`**: `ORDER_STAGES`, `stageChipClass`, `nextStages`, order-field extractors (`orderCustomerName/Phone`, `orderVendorName/Email/Mobile`, `orderAmount`, `orderProductName`), and `exportOrdersToExcel()` using the newly-added `xlsx` npm package. Excel columns fixed to product spec: **User Name · User Mobile · Product Name · Product Amount · Order Stage · Vendor Name · Vendor Email · Vendor Mobile**. Filenames: `slangcart-vendor-{shop-slug}-orders-YYYY-MM-DD.xlsx` and `slangcart-admin-orders-YYYY-MM-DD.xlsx`.
  - **Vendor nav** updated with a new "Orders" tab between Products and Sales dashboard.
  - **Route registration** added at `/vendor/orders`.
  - **Backend spec at `/app/memory/ORDER_MANAGEMENT_BACKEND_SPEC.md`** for the backend team: `GET /vendor/me/orders`, `PATCH /vendor/orders/{id}/status`, enriched `GET /admin/orders`, transition catalogue, deprecation of admin edit. Frontend degrades gracefully when endpoints return 404/405/501.
- **DONE — Checkout "Review your order" product-detail panel.** Big card at the top of `/checkout` above the address form: large product thumbnail (80×80), name, price (with optional MRP strike + % off if backend supplies mrp), Qty pill, per-line Subtotal, plus an "Items subtotal" highlight band. Sticky compact sidebar summary retained as a secondary view.
- **DONE — Web ↔ mobile sync verified.** Both apps share the same backend. iter-15 E2E validated login, shop, PDP, cart, COD checkout, admin Treasury, onboarding-terms, T&C gates. Cart line hydration bug fixed via per-product `/products/{id}` lookup in CartContext with a persistent Map cache.
- **DONE — Code-review batch.** Stable UIDs (`AdminOnboardingTerms`, `AdminLanding`), `TermsAcceptancePanel` refactor, `useRazorpayCheckout` refactor (8 pure helpers). HttpOnly-cookie spec at `/app/memory/SECURE_AUTH_BACKEND_SPEC.md`.
- **DONE — Onboarding T&C compliance flow.** Scroll-to-bottom gate, admin CMS at `/admin/onboarding-terms`, mobile-app spec at `/app/memory/MOBILE_ONBOARDING_TERMS_SPEC.md`.
- **DONE — Admin System Wallet / Treasury cleanup** (shop + service excluded per business rule).
- **DONE — Vendor "My Shop" Sales dashboard v2** (Online Shop Sales block with COD/UPI/Credit-pending KPI cards + donut chart + orders table).
- **DOC — `/app/memory/MONEY_FLOW_BACKEND_SPEC.md`** for backend team.
- **DONE — ProductDetail rich fields**, social/meta assets, DRY refactor.
- CI build green, zero warnings.

## Verification status
- 04-Jul-2026: iter-15 E2E validated admin+user login, shop, PDP, cart hydration, COD checkout, admin Treasury Group 1 exclusion, admin onboarding-terms stable-UID reorder, become-vendor + become-provider T&C gates. Post-hydration-fix screenshot confirms Cart + Checkout Order Summary + new "Review your order" panel all render product name/image/price correctly. Vendor Orders page will populate once backend ships `/vendor/me/orders`.

## Bug batch #3 — Duplicate stock · Web Orders · Owner PIN 1234 (26-Jul-2026)

### Fix #1 — Duplicate stock on accept
- **Root cause**: `VendorDashboard.jsx` was merging `loadReceivedProducts()` into the product list on top of the auto-created upstream product, resulting in one card per source. Additionally, `accept_transfer` used SKU-only matching so accepts with empty SKU created a new upstream product every time instead of merging.
- **Fix**: (a) removed the `loadReceivedProducts` merge in `VendorDashboard.jsx` — backend is now the single source of truth for the receiver's catalog. (b) upgraded `_upstream_find_existing_product` in `server.py` to match by SKU first, then by exact case-insensitive product name, so future accepts always dedupe correctly.

### Fix #2 — Vendor Orders on the web
Web `/vendor/orders` was blank because production backend on `network-pay-1` never shipped `/vendor/me/orders`. Added a local **orders mirror service** so checkout on the web/app also lands orders that the vendor can see and progress from the web.
- New endpoints (local backend):
  - `POST /api/orders/checkout` — cart items grouped by `vendor_email`, assigns `ORD-YYYYMMDD-#####`, initial status `placed`, SSE broadcast to each vendor.
  - `GET  /api/orders/me` — buyer's orders.
  - `GET  /api/vendor/me/orders?status=all|placed|packed|shipped|delivered|cancelled` — vendor sees orders where they appear in `vendor_emails`.
  - `PATCH /api/vendor/orders/{id}/status` — vendor advances status (403 if not one of the assigned vendors, 400 on invalid status). Appends to `status_history` and broadcasts `order.updated` SSE.
- Frontend:
  - `Checkout.jsx` now fire-and-forgets a mirror `POST /api/orders/checkout` alongside the upstream call.
  - `Orders.jsx` (buyer) merges upstream + local results by `id` so nothing is lost.
  - `VendorOrders.jsx` (vendor) does the same dual-source merge on load and falls back to the local `PATCH` when upstream doesn't have the endpoint.

### Fix #3 — Owner password now works with default 1234
- New local-backend endpoints `GET/POST /api/erp/owner-security/{status|verify|change-password|change-pin}` persisted per-vendor in `owner_security` collection. Lazily creates with defaults **password=1234, pin=1234, autoLockSeconds=900**.
- Endpoints return proper `200 / 401 / 400` (no more 404 pass-through in `OwnerLockGate`). The gate now genuinely verifies against the server; the "any password unlocks" behaviour is over.
- Frontend `lib/erp.js` swapped the owner endpoints from the upstream `api` client to the new `apiLocal` client so PIN/password changes persist across devices.
- The Quick PIN card on `/vendor/erp/security` (already built earlier) now actually saves PINs; the "Update password" card actually rotates the password.

### Testing
- Backend: **11/11 pass** including two new tests (`test_owner_security_defaults_and_update`, `test_customer_orders_flow`) that cover: defaults, verify 200/401, PIN update round-trip, order creation with vendor grouping, cross-vendor visibility, invalid status 400, unauthorised status change 403.
- Frontend: `CI=true yarn build` clean. Smoke-tested vendor dashboard shows real products from upstream without duplication of newly accepted transfers (historical duplicates from before the SKU/name matcher landed remain until the vendor deletes them).

## Substore Transfer — Realtime · Auto-stock · Directory sync · Timeline (26-Jul-2026)

Four follow-ups to the initial substore backend, all shipped in one pass.

### 1. Realtime Push (Server-Sent Events)
- `GET /api/vendor/me/transfers/stream` — SSE endpoint scoped to the authenticated vendor. Accepts token via `Authorization: Bearer` header OR `?access_token=` query (EventSource can't send headers). Sends `transfer` events on create / seen / accepted / cancelled / rejected, plus 25s keepalives.
- New `SseBroker` publishes each event to both the sender's and receiver's connected clients.
- Frontend `subscribeTransfers(token, onEvent)` in `lib/vendorSubstore.js` opens the stream; `VendorSubstore.jsx` refreshes the ledger and fires a sonner toast with a contextual message (e.g. `"New transfer received: Test Rice 5kg (qty 10) from Slangcart"`).

### 2. Stock Auto-Deduction
- On `POST /transfers`: if the sender attached a `product_id`, the backend uses the caller's Bearer to `GET`+`PATCH /vendor/me/products/{id}` on `network-pay-1`, decrementing stock by `qty`. Returns `409 insufficient_stock` if the sender oversells.
- On `POST /transfers/{id}/accept`: the backend looks up the receiver's product by SKU and either `PATCH`es (`stock += qty`) if found, or `POST /vendor/me/products` to create a new product carrying the original name / image / price / description with `stock = qty`.
- On cancel/reject: refunds the sender's stock via the same PATCH.
- Every step is best-effort — if upstream misbehaves, the transfer still lands with `stock_deducted / stock_added` flags recorded and a friendly timeline entry.

### 3. Substore Directory Sync
- Server-persisted `vendor_substores` collection keyed by `owner_email`. New endpoints:
  - `GET /api/vendor/me/substores` — my directory
  - `POST /api/vendor/me/substores` — add {email, name, gstin, phone, note}. Rejects self-adds and duplicates.
  - `DELETE /api/vendor/me/substores/{id}` — remove.
- Frontend `vendorSubstore.js` now exposes both a synchronous `loadSubstores(vendor)` (reads local cache for first paint) and async `fetchSubstores(vendor)` (authoritative). `addSubstore / removeSubstore` are async. Local cache stays in sync for offline / snappy loads.

### 4. Transfer Timeline
- New embedded `timeline: TimelineEvent[]` on every transfer doc, populated automatically:
  - `created` — sender · with a note about stock deduction
  - `seen` — recipient · first time they open the transfer via `GET /{id}`
  - `accepted / cancelled / rejected` — actor + stock-side-effect note
- New `TransferTimeline` component renders a chip strip inline under each row when clicked (data-testid `transfer-timeline`, `timeline-{kind}`, `vst-toggle-{id}`).

### Testing
- Backend: `/app/backend/tests/test_transfers.py` — **9/9 pass** including `test_timeline_events_created` and `test_substore_directory_crud` covering ownership isolation, duplicate rejection, and 404 on missing.
- Live browser: `brightkittu@gmail.com` sees all 15 transfers from support@slangcart.com, timeline expands under each row showing actor + timestamp + detail, "Received via substore transfer" shows 6 auto-added products with image/price/qty, sonner toast fires on new create events pushed via SSE.

## Substore Transfer — Cross-vendor sync SHIPPED (26-Jul-2026)

**Trigger**: user asked for the implementation of `GET /api/vendor/me/transfers` and all backend pieces so Vendor A on device X and Vendor B on device Y see each other's transfers in real time.

### Architecture
- Frontend `api` client stays on **network-pay-1.emergent.host** (external, read-only) for products/POS/auth.
- New Emergent-local backend `/app/backend/server.py` (served at `REACT_APP_BACKEND_URL`) now hosts the transfer service. Data lives in Mongo collection `vendor_transfers`.
- **Identity delegation**: local backend forwards each request's Bearer token to `network-pay-1/api/auth/me`, caches identity 60s, and trusts the returned `{id,email,name}`. No signing key needed. Auth-failure at upstream → 401.
- Frontend uses a new **second axios instance** `@/lib/apiLocal.js` targeting `process.env.REACT_APP_BACKEND_URL` only for transfer endpoints. All other calls remain unchanged.

### Backend endpoints (all under `/api/vendor/me/transfers`)
- `POST /` — create pending transfer. Assigns `TRF-YYYYMMDD-####` per sender, computes `total_value`, rejects self-transfer with 403.
- `GET /?status=pending|accepted|cancelled|rejected|all&limit=1..500` — returns items where caller is sender OR receiver, sorted newest first. Isolation via `$or` on `from_email/to_email`.
- `GET /{id}` — 404 unless caller is sender or receiver.
- `POST /{id}/accept` — recipient only; 403/409 otherwise.
- `POST /{id}/cancel` — sender only; 403/409 otherwise.
- `POST /{id}/reject` — recipient only; 403/409 otherwise.
- `GET /api/health` — Mongo ping smoke.
- Indexes ensured on startup: `from_email`, `to_email`, `id` (unique), `created_at desc`.

### Frontend changes
- `src/lib/apiLocal.js` — new axios pointing at `REACT_APP_BACKEND_URL`.
- `src/lib/vendorSubstore.js` — completely rewritten. `loadTransfers/createTransfer/acceptTransfer/cancelTransfer/rejectTransfer` are now `async` and hit the backend. `loadReceivedProducts` derives from the same fetched list. Substore *directory* (contact list) stays in localStorage.
- `src/pages/vendor/VendorSubstore.jsx` — async `refresh()`, loading/error states, replaced amber "backend pending" banner with green **"Live cross-device sync"** confirmation, all button handlers made async.
- `src/pages/VendorDashboard.jsx` — `loadReceivedProducts` awaited so "My Shop" list still surfaces accepted transfers.

### Testing
- `/app/backend/tests/test_transfers.py` — 7 integration tests, **all pass**. Covers: health, missing/invalid bearer → 401, create+dual-visibility+accept+duplicate accept→409+wrong-cancel→409, cancel flow with sender check, self-transfer blocked, reject flow with recipient check. Run via `pytest tests/test_transfers.py`.
- **Live browser proof**: signed in as brightkittu@gmail.com in a fresh session and immediately saw 4 transfers created by support@slangcart.com — 2 accepted (Test Rice 5kg qty 10, Pytest Test Rice qty 5), 1 cancelled, 1 rejected. "Received via substore transfer" shows the accepted items with image/price/qty as required.

### Backward compatibility
- Same-account substores (same GSTIN, one email) still work — the backend treats them as any other cross-vendor transfer (their emails differ per Slangcart's model). No pre-existing flow removed.
- CSV export, KPI aggregates, transfer status chips — unchanged.
- Local per-vendor substore contact directory is untouched.

## ERP 3.0 — Pivot to real backend data (25-Jul-2026)

**Trigger**: user report — every ERP page was showing yellow "Preview mode / running on local data" banners and none of the vendor's 4 real products (Banana, Potato, Onions, Tomato) were visible. Also: substore transfers between two different vendor accounts on different browsers were not syncing.

### What changed
1. `/app/frontend/src/lib/erp.js` **completely rewritten** to pull live data from existing production endpoints:
   - `listProducts / saveProduct / deleteProduct` → `GET/POST/PATCH/DELETE /vendor/me/products` (Product Master + CSV import + Inventory now show real 4 products with correct stock/prices).
   - `accountsDashboard` → `/vendor/me/pos/dashboard` (today/month) + `/vendor/me/stats` (lifetime).
   - `profitDashboard` → `/vendor/me/pos/analytics` (top revenue, top gst, least sold).
   - `gstDashboard / gstAssistant` → derived from `/vendor/me/pos/dashboard` monthly bucket; CGST/SGST split, next-return-due, filing status.
   - `incomeTaxDashboard` → `/vendor/me/stats` (annual sales, gross profit, estimated taxable).
   - `financialHealth` → monthly buckets over analytics.daily.
   - `complianceStatus / listReminders` → live turnover + live product stock.
   - `runReport` → sales/profit from `/vendor/me/pos/sales`, product/inventory from live products.
   - `erpSearch` → real-product text search.
2. Removed the "Preview mode" `BackendPendingBanner` from every page that now has live data — kept it only on the 4 modules that truly still need a backend endpoint: Purchase Book, Audit Log, Roles & Staff, Business Profile, Owner Settings.
3. Added an amber cross-vendor warning banner on `/vendor/substore` (data-testid `vst-cross-vendor-warning`) explaining that cross-device transfers require `POST /api/vendor/me/transfers`.
4. New backend spec `/app/memory/SUBSTORE_TRANSFER_SPEC.md` — full endpoint contract, collection schema, side-effects and rollout order for the substore team.

### Verification (iteration_21) — 100 % pass
- Product Master: 4 real vendor products (₹50/100, ₹15/98, ₹40/100, ₹10/94).
- Inventory: 392 units, ₹11,410 value.
- Accounts: today ₹0 / month ₹10 · 1 order / lifetime ₹80 · 6 orders / ₹56 profit.
- Profit: top product = Tomato 1Kg with real numbers.
- Search: `tomato` returns the real product.
- Substore amber warning banner renders.
- Purchase Book / Audit / Roles / Business Profile still show "Preview mode" (expected).

## Slangcart Vendor Billing 3.0 — Next-Action Batch (25-Jul-2026)

Four polish features shipped in a single pass, all frontend-first with graceful backend fallback:

### 1. Product CSV Import  (`src/components/erp/ProductCsvImport.jsx`)
- Drag-and-drop + file picker + paste textarea. Client-side CSV parser (`src/lib/csvImport.js`) handles quoted fields, escaped quotes and CRLF.
- Header auto-mapping via aliases (`Product Name` → `name`, `GST%` → `gstPct`, `HSN` → `hsnCode`, etc.).
- Dry-run preview table with per-row **Ready / Errors**, individual row checkboxes, and column mapping chips (`green` = mapped, `grey` = ignored).
- Template CSV download (`csv-download-template`) with two sample products.
- Commit calls `saveProduct()` for each valid row — falls back to localStorage on 404.

### 2. Cashier Onboarding Tour  (`src/components/erp/OnboardingTour.jsx` + `src/context/TourContext.jsx`)
- 5 steps (~3 min): Product Master → Billing → Inventory → Reports → Learn.
- Auto-opens on the vendor's first visit to `/vendor/erp`; manual replay via `3-min tour` button in the ERP Hub header (data-testid `tour-start-btn`).
- **Route-persistent lifecycle** — `<TourProvider/>` wraps `<Routes/>` at App root so the overlay survives navigation between steps. Uses `useLocation()` so in-app `<Link/>` clicks also trigger auto-open.
- Spotlight overlay: 4 dark scrim boxes around the target rect + animated ring; card auto-scrolls the target into view.
- Persistence via `localStorage.sc.erp.tour.completed.v1`; `restart()` clears the key.

### 3. Owner PIN Fast Path  (`src/components/erp/OwnerLockGate.jsx`)
- Segmented switch inside the lock gate: **Password** or **Quick PIN (4–6 digits)**. Last-used mode remembered in `localStorage.sc.erp.owner.mode`.
- New Quick PIN card in `/vendor/erp/security` (data-testids `owner-new-pin`, `owner-confirm-pin`, `owner-save-pin-btn`). Requires current password to confirm; posts to `POST /api/erp/owner-security/change-pin` (spec added).
- Falls back to `localStorage` with an informational toast when the backend endpoint is 404.

### 4. GST Filing Timeline  (`src/components/erp/GstFilingTimeline.jsx`)
- Horizontal 12-month rail rendered directly below the GST dashboard on `/vendor/erp/gst`.
- Colour-coded states: FILED (green), DUE (amber), OVERDUE (red), UPCOMING (grey). Each cell shows GST payable ₹, days-to-due / days-late, and filed date.
- 5-chip summary strip: Filed / Due / Overdue / Upcoming / **Late fee (est.)** — computed at ₹50/day placeholder rate.
- Financial-year picker (`timeline-year`) — 3 FYs. Backend endpoint `GET /api/erp/gst/timeline?year=YYYY` documented in the spec. When 404, we synthesise 12 months of realistic sample data that guarantees all 4 states are visible.

### Backend spec updates (`/app/memory/ERP_BILLING_3.0_SPEC.md`)
- Added `POST /api/erp/owner-security/change-pin` — body `{ currentPassword, newPin }`, 4-6 digits.
- Added `GET /api/erp/gst/timeline?year=YYYY` — 12-month array with status, GST payable, days to/from due, filed date, late fee.

### Testing
- **iteration_18**: base ERP suite — 100% pass.
- **iteration_19**: 4 new features — 80% pass; onboarding tour broke at step 2 (unmount bug).
- **iteration_20**: primary regression FIX verified — tour survives all 5 steps in both auto-open and manual-replay flows; PIN/CSV/timeline stable. Two cosmetic LOWs (FILED cell early in FY, in-app Link auto-open) fixed post-report.

## Testing
- Iteration 1 (frontend, external backend): **43/45 assertions** passed. The only failures were mobile bottom-nav tabs overlapping the platform's "Made with Emergent" badge; resolved by reducing mobile tabs to 4 and adding right padding (`pr-44`).
- Iteration 18 (frontend, ERP 3.0): **100% frontend pass**. All 21 vendor ERP pages + admin ERP settings verified: navigation, forms, Owner Lock Gate, localStorage fallback, empty states, banners, 5-tab admin config all work. Only a benign `<span>-inside-<option>` hydration warning was flagged and fixed post-report.
- See `/app/test_reports/iteration_18.json`.

## Slangcart Vendor Billing 3.0 — ERP Suite (25-Jul-2026)
23 modules delivered as spec-first (backend) + frontend shells with localStorage fallback.

### Backend contract
- **`/app/memory/ERP_BILLING_3.0_SPEC.md`** — Full spec covering data model (`erp_products`, `erp_purchases`, `erp_suppliers`, `erp_sales`, `erp_customers`, `erp_audit`, `erp_business_profile`, `erp_owner_security`, `erp_roles`, `erp_settings`), 45+ endpoints, error contract (`428 owner_verification_required`), per-request Owner-Verify header (no session), Super Admin `/api/admin/erp-settings`, and phased rollout order.

### Frontend routes (21 vendor + 1 admin)
- **Vendor Hub**: `/vendor/erp` — 20 tiles, colour-coded per Module 23 (green sales/profit/stock, blue purchase/orders, orange gst, red danger).
- **Module 1** `/vendor/erp/products` — full Product Master form (Info + Purchase + Selling + Inventory sections), search, edit/delete.
- **Module 2** `/vendor/erp/purchase-book` — Owner-gated. Summary KPIs, multi-line purchase form with GST split, historical table.
- **Module 3** `/vendor/erp/inventory` — 6 KPIs + low/OOS lists + fast/slow-moving panels.
- **Module 4** `/vendor/erp/billing` — informational page linking to existing POS with auto-sync explanation.
- **Module 5** `/vendor/erp/price-lock` — explainer of what's locked & audited.
- **Modules 6-9, 13, 14** `/vendor/erp/{accounts,profit,gst,gst-assistant,income-tax,financial-health}` — all Owner-gated. Estimates-only banners. Recharts monthly trend for Financial Health.
- **Module 10** `/vendor/erp/business-profile` — Business type, PAN, GSTIN, scheme, state, FY start.
- **Module 11** `/vendor/erp/compliance` — turnover flags (thresholds from `erp_settings`).
- **Module 12** `/vendor/erp/reminders` — severity-coloured list (GST return, low stock, missing bills…).
- **Module 15** `/vendor/erp/reports` — Owner-gated. 10 report kinds × 6 ranges, PDF/Excel/CSV/Print.
- **Module 16** `/vendor/erp/search` — Product/Barcode/Supplier/Invoice/GSTIN/Category/Brand/Batch.
- **Modules 17-19** `/vendor/erp/security` — Owner Lock Gate = full password re-prompt every time (per user choice). Password change form + biometrics/auto-lock cards + login history.
- **Module 20** `/vendor/erp/roles` — 4 system role templates (Owner/Manager/Cashier/Staff) + permission catalogue + custom-role editor.
- **Module 21** `/vendor/erp/audit` — Owner-gated table (when/actor/action/entity/old→new/reason).
- **Module 22** `/vendor/erp/learn` — 13 plain-English topics bundled in `lib/learningContent.js` (GST, ITC, profit types, HSN, GSTR, turnover, taxable value, etc.). Super Admin can override.
- **Module 23** — UI colour-coding, dashboard cards, sub-nav, hub tiles all follow spec.
- **Super Admin** `/admin/erp-settings` — 5 tabs (GST slabs, HSN mapping, turnover thresholds, reminders, learning content).

### Design decisions locked in this iteration
1. **Spec-first** — no backend code shipped. All backend changes documented as Markdown.
2. **Owner Lock Gate = full password every time** (no session caching, per user choice).
3. **`X-Owner-Verify` request-scoped header** for backend to consume (already coded on FE).
4. **Preview mode banner** on every page hitting a pending endpoint (yellow with `Preview mode` label).
5. **Learning Content** = 13 topics I authored with ₹ examples for Indian retailers.

### Wiring
- `src/App.js` — 21 routes under `userGuard`.
- `src/AdminRoutes.jsx` — `/admin/erp-settings`.
- `src/components/vendor/VendorNav.jsx` — added `ERP 3.0` tab (Rocket icon).
- `src/constants/adminNav.js` — added ERP settings under `Operations`.

### Known follow-ups (waiting on backend)
- Real numbers on all Owner-gated dashboards once billing lift-off writes `erp_sales`.
- Server-side Owner verification (currently gate accepts any password locally on 404 pass-through).
- Report generation output (PDF/Excel/CSV).
- Admin ERP settings save round-trip.

## Vendor · Orders — Auto-Sync (26-Feb-2026)
- `/vendor/orders` polls upstream + local mirror every 30s (paused when tab hidden).
- Auto-refetches on tab-focus return.
- Toasts: "N new orders received" for arrivals; per-order "status: old → new" (throttled to 3 + overflow line) for stage transitions.
- Visible "Auto-syncing every 30s · last checked HH:MM:SS" indicator + manual **Sync** button (spinner while syncing).
- Test IDs: `vo-refresh`, `vo-last-synced`.
- File: `src/pages/vendor/VendorOrders.jsx`.

## Big UX Sweep (05-Feb-2026)

### Dashboard (`src/pages/Dashboard.jsx`)
- Removed "Users" and "Network" stat cards + Network quick-action tile.
- New emphasis-piece hero: "Welcome back, {name}" + prominent referral code chip (copy + native share).
- Wallet + lifetime-earned snapshot moved into hero's right pane.
- Compact 2-tile stat strip (Wallet · Total earned).
- **Referral tree** rendered directly on Dashboard as an iterative-flatten expandable tree (recursion avoided due to CRA visual-editor babel plugin). Auto-expands root. Uses `/users/me/network`.

### Chat / Slang-Connect (`src/pages/Chat.jsx`)
- **Search bar** to filter threads by name / email / referral code / last message.
- **New Chat modal** (`+` button) — search users via `/users/search` (fallback `/chat/users/search`), POST `/chat/threads` to start.
- Sync fixes: 20s thread-list polling, unread badges, ISO-sorted list (newest first), avatar fallback via initials, last-seen line in header when provided.

### Wallet (`src/pages/Wallet.jsx`)
- Removed "Send money" transfer button and modal.
- Every transaction + withdrawal row now has a **Print Receipt** button that opens a new-window printable Slangcart receipt (auto-invokes `window.print`).
- 30s auto-sync of `/transactions/me` + `/withdrawals/me` with pulse indicator + manual **Sync** button.

### Layout (`src/components/Layout.jsx`)
- **Desktop hamburger** in the top bar collapses/expands the left sidebar (16px icon rail ↔ 64px full). State persisted to `localStorage.sc_sidebar_collapsed_v1`. Test IDs: `topbar-sidebar-toggle`, `sidebar[data-collapsed]`.

### Vendor Dashboard (`src/pages/VendorDashboard.jsx`)
- Added **NewOrdersAlert** widget above the stats grid. Polls upstream `/vendor/me/orders?status=placed` + local mirror every 30s, pulses toast on new arrivals, links to `/vendor/orders`. Matches the mobile-app "New Order" behaviour.

### Vendor Sales dashboard (`src/pages/vendor/VendorSales.jsx`)
Full refactor:
- Only **3 clickable KPI tiles**: Today's Sales · This Month Sales · Lifetime Sales — each opens a full-screen **drilldown modal** with search, channel filter (POS · Web/App), payment filter, and (for This Month) a **date-range calendar picker**.
- **Payment method tiles restricted to CASH · UPI · DEBIT CARD · CREDIT CARD · WALLET** (Net-banking + credit-sale + GST + profit + bills cards removed per user's decision). Scope toggle (Today / Month / All time). Each tile is clickable → drilldown pre-filtered to that mode.
- Unified sale rows combine **POS invoices (localStorage)** + **upstream `/vendor/me/sales`** + **local mirror `/vendor/me/orders`** with normalised payment-mode classification.
- 30s auto-sync between web + app, tap-to-print thermal receipt on every row.

## Deployment Fixes (05-Feb-2026)

### Frontend build failure (blocker → fixed)
- Root cause: `isomorphic-dompurify@3.20.0+` requires Node ^22.22.2, but cloud build image is Node 20.19.5. `yarn.lock` isn't tracked in git, so build regenerated it and picked the latest incompatible version.
- Fix: pinned `isomorphic-dompurify` to exact `3.19.0` (last Node-20-compatible version) in both `dependencies` and `resolutions` in `frontend/package.json`. Fresh `yarn install --prefer-offline` + `CI=true yarn build` verified green.

### Nginx `/health` upstream refused (blocker → fixed)
- Root cause: backend only exposed `/api/health` under the `APIRouter(prefix="/api")`. Container-level nginx liveness probes hit `/health` (no /api) and got "connection refused" (interpreted as backend crash).
- Fix: added a bare `/health` route on the FastAPI `app` in `backend/server.py`, mirroring `/api/health` (both `await db.command("ping")` and return `{"ok": true}`).

### Frontend external-backend URL now env-configurable
- `frontend/src/lib/api.js`: `BACKEND_URL` reads `process.env.REACT_APP_SLANGCART_API_URL` with a documented fallback default. Local backend (`apiLocal.js`) still uses `REACT_APP_BACKEND_URL` — dual-backend architecture preserved.

## Credentials
See `/app/memory/test_credentials.md`.
