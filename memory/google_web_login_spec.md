# Web Google Sign-In — Backend Spec (for Slangcart main backend team)

The website (slangcart.com) must sign users in with Google and receive the **same external JWT** the mobile app uses, so the session is fully synced (wallet, shop, referrals, orders). The web side is already built and waiting; it just needs the endpoint below.

## What the website already does
- Shows a "Continue with Google" button (currently hidden behind a flag).
- On click it navigates the browser to:
  ```
  {START_URL}?redirect_uri={origin}/auth/google/return
  ```
  where `{origin}` is e.g. `https://slangcart.com`.
- It has a public route `GET {origin}/auth/google/return` that reads the JWT and logs the user in.

## What the backend must provide

### 1. Web start endpoint  (GET)
`GET /api/auth/google/web-start?redirect_uri=<url-encoded return url>`

- Validate `redirect_uri` against an allow-list of trusted origins (e.g. `https://slangcart.com`, the preview domain). Reject others.
- Begin Google OAuth (authorization-code flow) using the backend's own Google `client_id`/`client_secret`, with the backend's own Google redirect URI (your existing `/api/auth/google/callback` is fine). Store the caller's `redirect_uri` in the OAuth `state` (signed).

### 2. Google callback (you already have this)
`GET /api/auth/google/callback?code=...&state=...`

- Exchange `code`, get the Google profile.
- Upsert the user by email (do NOT duplicate): set `google_id`, `auth_provider="google"` if new. Keep existing wallet/referral data for returning users.
- Issue your normal **access JWT + refresh JWT** (same as `/api/auth/login`).
- Read the original `redirect_uri` from `state` and **302-redirect the browser** to:
  ```
  {redirect_uri}#token=<ACCESS_JWT>&refresh_token=<REFRESH_JWT>
  ```
  Use the URL **fragment** (`#`) so the tokens never hit server logs. (Query string `?token=...&refresh_token=...` is also accepted by the web, but the fragment is preferred.)
- On failure redirect to `{redirect_uri}?error=<message>`.

## Token/field contract the website expects
The web return handler reads (fragment first, then query):
- `token` **or** `access_token` → the access JWT
- `refresh_token` **or** `refresh` → the refresh JWT (optional but recommended)
- `error` → human-readable error message

The JWT must be accepted by the existing `GET /api/auth/me` and refreshable via `POST /api/auth/refresh` (identical to email/password login), since the website calls `/auth/me` right after to hydrate the user.

## Turning it on (web side)
Once the endpoint is live, set in `frontend/.env`:
```
REACT_APP_ENABLE_GOOGLE_LOGIN=true
# optional override if the path differs from {API_BASE}/auth/google/web-start:
REACT_APP_GOOGLE_WEB_START_URL=https://<backend>/api/auth/google/web-start
```
then restart the frontend. The main agent will then test the full flow end-to-end.

## Security notes
- Allow-list `redirect_uri` (open redirect risk).
- Short-lived `state`, signed/encrypted.
- Tokens in URL fragment, cleared from the address bar by the web immediately (already implemented).
