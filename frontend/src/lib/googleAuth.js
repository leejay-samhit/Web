import { API_BASE } from "@/lib/api";

// Google web sign-in is wired to the EXTERNAL backend so accounts stay fully
// synced with the mobile app (wallet, shop, referrals). It is kept behind a
// flag so no button shows until the backend web endpoint is live.
//
// Enable by setting in frontend/.env:
//   REACT_APP_ENABLE_GOOGLE_LOGIN=true
//   REACT_APP_GOOGLE_WEB_START_URL=<backend web-start URL>   (optional override)
//
// Contract (see /app/memory/google_web_login_spec.md):
//   1. Browser opens  START_URL?redirect_uri=<origin>/auth/google/return
//   2. Backend runs Google OAuth, then 302-redirects the browser to
//      <origin>/auth/google/return#token=<jwt>&refresh_token=<jwt>
//      (query string also accepted; error returned as ?error=...)

export const GOOGLE_LOGIN_ENABLED =
  String(process.env.REACT_APP_ENABLE_GOOGLE_LOGIN || "").toLowerCase() === "true";

const START_URL =
  process.env.REACT_APP_GOOGLE_WEB_START_URL || `${API_BASE}/auth/google/web-start`;

export function startGoogleLogin() {
  const returnUrl = `${window.location.origin}/auth/google/return`;
  const sep = START_URL.includes("?") ? "&" : "?";
  window.location.href = `${START_URL}${sep}redirect_uri=${encodeURIComponent(returnUrl)}`;
}
