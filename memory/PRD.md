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
- **DONE (27-Jun-2026, iter 4)** — Code-quality round 2: `src/constants/config.js`, 3 custom hooks (`useChatThread`, `useDashboardData`, `useRazorpayCheckout`), 17 sub-components extracted across Dashboard/Chat/Shop/Services/Orders/Notifications/Wallet/ProductDetail/Checkout. All nested ternaries replaced with named render helpers. Admin pages' `load` is `useCallback` + `useRef` for stable search. **45/46 regression assertions** pass (1 test-data artifact).
- **DONE (iter 3)** — `tokenStore.js`, dev-only `log.js`, all empty catches eliminated, stable list keys, cross-tab logout via storage event, ProtectedRoute renders from cached user. Zero `console.*` outside `log.js`.
- **DONE (iter 2)** — Admin section validated with super_admin. 8/9 admin flows pass.
- **OPEN — backend** — Migrate auth from `Authorization: Bearer` to `httpOnly + Secure + SameSite=Lax` cookies. Until then `tokenStore.js` is the strongest in-browser mitigation; encryption would be theatre.
- **OPEN — backend** — Intermittent 401 on POST `/api/admin/broadcasts` right after PUT `/api/admin/branding`. Frontend surfaces it.
- **OPEN — backend** — Test user receives 403 when posting into his own Network-Rupay chat thread. Frontend now shows a `chat-send-error` chip via `useChatThread.sendError`.
- **P1** — "Apply as service provider" form (`/api/service/apply`).
- **P2** — WebSocket chat (replace `CHAT_POLL_INTERVAL_MS` polling).
- **P2** — Order detail page with timeline.
- **P2** — Wire change-password endpoint if backend exposes a different path.
- **P3** — i18n + offline cart cache.

## Testing
- Iteration 1 (frontend, external backend): **43/45 assertions** passed. The only failures were mobile bottom-nav tabs overlapping the platform's "Made with Emergent" badge; resolved by reducing mobile tabs to 4 and adding right padding (`pr-44`).
- See `/app/test_reports/iteration_1.json`.

## Credentials
See `/app/memory/test_credentials.md`.
