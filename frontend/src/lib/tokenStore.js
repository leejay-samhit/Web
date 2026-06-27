// Token storage helpers.
//
// SECURITY POSTURE (read me before "fixing" this file):
//
// The Slangcart backend (network-pay-1) currently ships JWTs in the JSON body
// of /api/auth/login and expects every request to carry
// `Authorization: Bearer <token>`. It does NOT set an httpOnly cookie. Until
// the backend exposes a cookie-based session there are exactly TWO options for
// surviving a page refresh on the web:
//
//   1. Store the token in `localStorage` (what this module does).
//   2. Store the token in a JS-readable cookie.
//
// Both are equally exposed to XSS — JS can read either one. Encrypting the
// token before putting it in localStorage is *security theatre*: the
// encryption key would have to live in the JS bundle, so any XSS that can
// read the ciphertext can also read the key.
//
// What we DO do to harden it:
//   * Namespace the storage keys (`sc_*`) — defined once in constants/config
//     so other code on the same origin can't accidentally read them.
//   * Single source of truth: only this module reads or writes these keys.
//     All other code goes through `getToken / setTokens / clearTokens`.
//   * Cross-tab logout via the browser `storage` event (handled in
//     AuthContext.jsx) so a logout in one tab kills sessions in all tabs.
//   * The axios interceptor never persists a token returned from a 4xx
//     response.
//
// Action item for the backend team (tracked in PRD.md):
//   Switch /api/auth/login to set a `__Host-sc_session` cookie with
//   httpOnly + Secure + SameSite=Lax, then we can delete this entire file.

import {
  TOKEN_STORAGE_KEY,
  REFRESH_STORAGE_KEY,
  USER_STORAGE_KEY,
} from "@/constants/config";

export const TOKEN_KEY = TOKEN_STORAGE_KEY;
export const REFRESH_KEY = REFRESH_STORAGE_KEY;
export const USER_KEY = USER_STORAGE_KEY;

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
