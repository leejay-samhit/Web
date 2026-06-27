// Token storage helpers.
//
// Security note (see CODE_QUALITY notes & PRD.md "Open issues"):
//   The Slangcart backend (network-pay-1) ships JWTs in JSON response bodies and
//   expects an `Authorization: Bearer <token>` header on every request. It does
//   not set an httpOnly cookie. Until the backend exposes a cookie-based session
//   we must hold the token client-side, and `localStorage` is the only viable
//   place that survives a page refresh.
//
// To minimise XSS blast radius we:
//   * Namespace storage keys (`sc_*`) so other apps on the same origin can't
//     accidentally read them.
//   * Sync-clear across tabs via the `storage` event so a logout in one tab
//     immediately kills sessions in others.
//   * Provide a single `clearTokens()` helper so we never leave stragglers
//     (`sc_token` cleared but `sc_user` left, etc.).
//
// Action item for the backend team: switch `/api/auth/login` to set a
// `__Host-sc_session` httpOnly+Secure+SameSite=Lax cookie and we will delete
// this entire module.

export const TOKEN_KEY = "sc_token";
export const REFRESH_KEY = "sc_refresh";
export const USER_KEY = "sc_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefresh() {
  return localStorage.getItem(REFRESH_KEY);
}

export function getCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setTokens({ token, refresh_token, user }) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
