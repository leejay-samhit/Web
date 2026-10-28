import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Landing route after the backend's Google OAuth completes. The backend has
// already issued its own JWT and sends it back in the URL fragment (or query):
//   /auth/google/return#token=<jwt>&refresh_token=<jwt>
// We persist it through the existing external-JWT auth so the session is
// identical to an email/password login (fully synced with the app).
export default function GoogleReturn() {
  const { loginWithTokens } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const parse = (s) => new URLSearchParams((s || "").replace(/^[#?]/, ""));
    const h = parse(window.location.hash);
    const q = parse(window.location.search);
    const get = (k) => h.get(k) || q.get(k);

    const error = get("error");
    const token = get("token") || get("access_token");
    const refresh = get("refresh_token") || get("refresh");

    if (error) { setErr(decodeURIComponent(error)); return; }
    if (!token) { setErr("No sign-in token was returned. Please try again."); return; }

    (async () => {
      // Strip the sensitive token from the address bar before anything else.
      window.history.replaceState({}, "", "/auth/google/return");
      try {
        const u = await loginWithTokens(token, refresh);
        if (!u) { setErr("Could not verify your account. Please try again."); return; }
        nav("/dashboard", { replace: true });
      } catch {
        setErr("Could not complete sign-in. Please try again.");
      }
    })();
  }, [loginWithTokens, nav]);

  return (
    <div className="min-h-screen grid place-items-center bg-[color:var(--sc-bg)] p-6" data-testid="google-return">
      {err ? (
        <div className="sc-card p-6 max-w-sm text-center">
          <AlertTriangle className="mx-auto mb-2 text-[color:var(--sc-error)]" />
          <div className="font-extrabold text-[color:var(--sc-ink)] mb-1">Sign-in failed</div>
          <div className="text-sm text-[color:var(--sc-ink-muted)] mb-4">{err}</div>
          <Link to="/login" className="sc-btn-primary inline-flex py-2 px-4" data-testid="google-return-retry">Back to sign in</Link>
        </div>
      ) : (
        <div className="text-center text-[color:var(--sc-ink-muted)]">
          <Loader2 className="mx-auto mb-3 animate-spin text-[color:var(--sc-primary)]" />
          Signing you in…
        </div>
      )}
    </div>
  );
}
