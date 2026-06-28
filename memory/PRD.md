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
