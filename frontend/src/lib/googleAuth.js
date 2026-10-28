import api, { API_BASE } from "@/lib/api";

// Web Google sign-in, fully synced with the app. Mirrors the mobile flow that
// the external backend already supports:
//   1. Build the Google consent URL with the app's PUBLIC client id and
//      redirect_uri = the backend's already-registered /auth/google/callback,
//      carrying a fresh session_id in `state`.
//   2. Open it in a popup. Google → backend callback stores the tokens under
//      that session_id, then the popup auto-closes.
//   3. The main window polls POST /auth/google/exchange { session_id } until it
//      returns the external JWT, then logs in via the normal external auth.
//
// Enable by setting the PUBLIC client id in frontend/.env:
//   REACT_APP_GOOGLE_CLIENT_ID=<xxxxx.apps.googleusercontent.com>
//   REACT_APP_GOOGLE_REDIRECT_URI=<override>   (optional)

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
export const GOOGLE_LOGIN_ENABLED = !!CLIENT_ID;

const REDIRECT_URI =
  process.env.REACT_APP_GOOGLE_REDIRECT_URI || `${API_BASE}/auth/google/callback`;

function uuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function pollExchange(sessionId, popup) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 120000; // 2 minutes
    let closedGrace = 0;
    const tick = async () => {
      if (Date.now() > deadline) {
        try { popup && popup.close(); } catch { /* ignore */ }
        return reject(new Error("Sign-in timed out. Please try again."));
      }
      try {
        const { data } = await api.post("/auth/google/exchange", { session_id: sessionId });
        const token = data?.token || data?.access_token;
        if (token) {
          try { popup && popup.close(); } catch { /* ignore */ }
          return resolve(data);
        }
      } catch {
        // 400 "Invalid Google session" → login not finished yet; keep polling.
      }
      if (popup && popup.closed) {
        closedGrace += 1;
        if (closedGrace > 3) return reject(new Error("Sign-in was cancelled."));
      }
      setTimeout(tick, 1500);
    };
    setTimeout(tick, 1200);
  });
}

// Opens Google, resolves with { token, refresh_token, user } from the backend.
export async function startGoogleLogin() {
  if (!CLIENT_ID) throw new Error("Google sign-in is not configured yet.");
  const sessionId = uuid();
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state: sessionId,
    prompt: "select_account",
    include_granted_scopes: "true",
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const popup = window.open(authUrl, "slangcart_google", "width=480,height=640,menubar=no,toolbar=no");
  return pollExchange(sessionId, popup);
}
