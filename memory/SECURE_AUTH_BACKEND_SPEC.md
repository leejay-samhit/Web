# Slangcart · Secure Auth (HttpOnly Cookies) — Backend Spec

**Author:** Slangcart web team · 04-Jul-2026
**Status:** DRAFT — awaiting backend implementation
**Priority:** P2 (security hardening — not blocking launch, but should ship before scale)
**Web parity commit:** current auth flow uses `localStorage` (`sc_token`, `sc_refresh`, `sc_user`).

## Problem

The web app currently stores the JWT auth token, refresh token, and cached user
object in `localStorage`. Anything that runs JavaScript in the browser can read
those tokens — one XSS on a product description, admin note, chat message, etc.
and the attacker has a valid session token they can use from anywhere.

The code review flagged this against `src/lib/tokenStore.js`, `vendorSales.js`,
`onboardingTerms.js`, `landingCms.js`, and `hooks/useUserLocation.js`.

The **auth tokens** (`sc_token`, `sc_refresh`) are the only high-risk data — the
CMS/localStorage caches in the other files are non-sensitive UI preferences and
are fine to leave in localStorage. This spec is scoped to **auth tokens only**.

## Solution — HttpOnly, Secure, SameSite=Lax cookies

Move access + refresh tokens off the JS heap and into cookies the browser
attaches automatically. Sensitive tokens become invisible to JS (`document.cookie`
cannot read them), so an XSS on any part of the app cannot exfiltrate the
session.

## Required backend changes

### 1. `POST /api/auth/login` — set cookies, don't return raw tokens in body

**Current response body (approx.):**
```json
{ "token": "eyJhbGciOi...", "refresh": "eyJ...", "user": { ... } }
```

**New response body:**
```json
{ "user": { "id": "...", "name": "...", "role": "user", "admin_role": null } }
```
Plus, on the same response, set these headers:
```
Set-Cookie: sc_token=eyJ...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
Set-Cookie: sc_refresh=eyJ...; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=2592000
```
(Adjust Max-Age to your access-token lifetime and refresh-token lifetime.)

**Notes on flags:**
- `HttpOnly`: JS cannot read. Non-negotiable.
- `Secure`: only sent over HTTPS. Non-negotiable in production.
- `SameSite=Lax` is safe for our top-level nav flow. Do NOT use `SameSite=None`
  unless you actually need cross-site cookies (we don't — the SPA and API are
  same-registrable-domain `slangcart.com` + `api.slangcart.com`).
- Scope refresh cookie to `Path=/api/auth` so it's only sent when needed.

### 2. `POST /api/auth/refresh` — read cookie, rotate, set new cookies

Read `sc_refresh` from the incoming cookies (not from the request body). If valid:
- Issue a new access token, set it as `sc_token` cookie.
- Rotate the refresh token (invalidate old, issue new `sc_refresh` cookie).
- Return `{ "ok": true }` — no token in body.

### 3. `POST /api/auth/logout` — clear cookies

Return a response that clears both cookies:
```
Set-Cookie: sc_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0
Set-Cookie: sc_refresh=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0
```

### 4. Auth dependency reads cookie OR bearer

Backend's `Depends(current_user)` should:
1. First try to read `sc_token` from the incoming request cookies.
2. Fall back to `Authorization: Bearer <token>` header (for mobile clients + backwards compat).

This means **the mobile app doesn't need to change** — it can keep using Bearer
headers. Only the web will switch to cookies.

### 5. CORS — send credentials

The FastAPI CORS middleware must include:
```python
allow_credentials=True
allow_origins=["https://slangcart.com", "https://<preview>.preview.emergentagent.com"]
# NOT allow_origins=["*"] — the browser rejects credentialed requests with a wildcard origin.
```

### 6. CSRF — double-submit cookie pattern

Since cookies are sent automatically, we now need CSRF protection for state-
changing endpoints (POST/PUT/PATCH/DELETE).

Simplest pattern:
- On login, additionally set a **non-HttpOnly** cookie `sc_csrf=<random>`.
- The frontend reads that cookie via JS and mirrors it in an `X-CSRF-Token`
  header on every mutating request.
- Backend rejects any mutating request where cookie ≠ header.

Add a FastAPI dependency `require_csrf` and attach it to all POST/PUT/PATCH/DELETE
routes.

## Required frontend changes (I'll do these once backend is ready)

1. **`src/lib/api.js`** — set `axios.defaults.withCredentials = true`, remove the
   `Authorization: Bearer` interceptor, and add an `X-CSRF-Token` interceptor
   that reads `sc_csrf` from `document.cookie`.
2. **`src/lib/tokenStore.js`** — reduce to a thin cache of the current user
   object only (which is not a secret). Remove all `sc_token`/`sc_refresh`
   reads/writes.
3. **`src/context/AuthContext.jsx`** — on mount, call `GET /api/auth/me`
   (cookie is sent automatically). If 200 → logged in. If 401 → logged out.
   No more reading `localStorage.sc_token` on boot.
4. **Logout button** — POST `/api/auth/logout` then clear the user cache.

Backwards-compat: while backend rolls out, `tokenStore.js` can dual-write both
cookie-mode and localStorage-mode for one release. Then remove the localStorage
branch entirely.

## Rollout plan

- [ ] Backend: implement 6 items above behind a feature flag `AUTH_COOKIE_MODE=1`.
- [ ] Backend: deploy to staging with flag on.
- [ ] Web: ship the frontend changes, gated on `REACT_APP_AUTH_COOKIE_MODE=1`.
- [ ] QA: verify login / refresh / logout / cross-tab session works.
- [ ] QA: verify CSRF header is sent + rejected when missing.
- [ ] Backend: enable flag in production.
- [ ] Web: remove localStorage token fallback in the following release.

## Out of scope for this spec

- Non-auth localStorage caches (`landingCms`, `onboardingTerms`, `vendorSales`,
  `useUserLocation`) — those are non-sensitive UI state and are fine to leave.
- Mobile app auth — mobile keeps Bearer-header auth. The backend supports both
  simultaneously by design.
