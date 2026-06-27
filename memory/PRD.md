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
