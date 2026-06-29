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

## Testing
- Iteration 1 (frontend, external backend): **43/45 assertions** passed. The only failures were mobile bottom-nav tabs overlapping the platform's "Made with Emergent" badge; resolved by reducing mobile tabs to 4 and adding right padding (`pr-44`).
- See `/app/test_reports/iteration_1.json`.

## Credentials
See `/app/memory/test_credentials.md`.
