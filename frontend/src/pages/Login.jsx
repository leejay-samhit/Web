import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Loader2, Info, Download } from "lucide-react";
import { GOOGLE_LOGIN_ENABLED, startGoogleLogin } from "@/lib/googleAuth";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // If a previous request was rejected because the backend revoked our
  // session, surface that here. (After the 29-Jun-2026 backend patch, the
  // backend now allows concurrent web↔app sessions, so this only ever
  // fires when the user manually signs out elsewhere or the token expires.)
  useEffect(() => {
    let timeoutId;
    try {
      const reason = localStorage.getItem("sc_logout_reason");
      if (reason === "session_revoked") {
        setNotice("Your session ended. Please sign in again to continue.");
        timeoutId = setTimeout(() => {
          try { localStorage.removeItem("sc_logout_reason"); } catch { /* ignore */ }
        }, 2500);
      }
    } catch { /* ignore storage errors */ }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      const to = loc.state?.from?.pathname || "/dashboard";
      nav(to, { replace: true });
    } catch (err) {
      // Distinguish: invalid credentials vs network/CORS/server outage.
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.response?.data?.message;
      if (status === 400 || status === 401 || status === 403) {
        setError(detail || "Incorrect email or password.");
      } else if (status >= 500) {
        setError("Server error. Please try again in a moment.");
      } else if (!err?.response) {
        // No response = CORS block, DNS fail, offline, or backend down
        setError(
          "Can't reach the server. If you're on slangcart.com and this just deployed, the backend may need to whitelist this domain (CORS)."
        );
      } else {
        setError(detail || `Login failed (HTTP ${status}).`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[color:var(--sc-bg)]">
      {/* Left brand panel */}
      <div className="hidden lg:flex w-1/2 bg-[color:var(--sc-primary)] text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white text-[color:var(--sc-primary)] grid place-items-center font-extrabold text-lg">
            S
          </div>
          <div>
            <div className="font-extrabold text-xl">Slangcart</div>
            <div className="text-[12px] text-white/70">Shop · Service · Connect</div>
          </div>
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-extrabold leading-tight">
            Earn together.
            <br />
            <span className="text-[color:var(--sc-accent-light)]">Shop together.</span>
          </h2>
          <p className="mt-4 text-white/85 max-w-md">
            One account for your referrals, wallet, shop, services, and Slang-Connect chats.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            {["Referrals", "Wallet", "Shop", "Services", "Chat", "Network"].map((f) => (
              <div key={f} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs font-semibold">
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -right-32 -bottom-32 w-[420px] h-[420px] rounded-full bg-white/5" />
        <div className="absolute -right-10 top-20 w-[200px] h-[200px] rounded-full bg-white/5" />
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-lg sc-fade-in">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <Link to="/" className="w-10 h-10 rounded-xl bg-[color:var(--sc-primary)] text-white grid place-items-center font-extrabold">
              S
            </Link>
            <div>
              <div className="font-extrabold text-[color:var(--sc-ink)]">Slangcart</div>
              <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Shop · Service · Connect</div>
            </div>
          </div>
          {/* Glass login card — increased padding and softer shadow. */}
          <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-[0_30px_80px_-30px_rgba(15,110,79,0.35)] p-8 sm:p-10">
          <h1 className="text-3xl font-extrabold text-[color:var(--sc-ink)]">Welcome back</h1>
          <p className="text-[color:var(--sc-ink-muted)] mt-1">Sign in to your Slangcart account.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-semibold text-[color:var(--sc-ink)]">Email</label>
              <input
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="sc-input mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[color:var(--sc-ink)]">Password</label>
              <div className="relative mt-1.5">
                <input
                  data-testid="login-password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="sc-input pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  data-testid="login-toggle-password"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--sc-ink-muted)]"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {notice && (
              <div
                data-testid="login-notice"
                className="text-xs font-semibold text-[color:var(--sc-primary-700)] bg-[color:var(--sc-accent-light)] border border-[color:var(--sc-accent-light)] rounded-xl px-3 py-2 flex items-start gap-2"
              >
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>{notice}</span>
              </div>
            )}
            {error && (
              <div
                data-testid="login-error"
                className="text-sm font-semibold text-[color:var(--sc-error)] bg-red-50 border border-red-100 rounded-xl px-3 py-2"
              >
                {error}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div />
              <Link
                to="/legal/forgot-password"
                data-testid="login-forgot"
                className="text-xs font-semibold text-[color:var(--sc-primary)] hover:text-[color:var(--sc-primary-700)]"
              >
                Forgot password?
              </Link>
            </div>
            <button
              data-testid="login-submit"
              disabled={loading}
              className="sc-btn-primary w-full justify-center flex items-center gap-2 py-3"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {GOOGLE_LOGIN_ENABLED && (
            <div className="mt-4">
              <div className="flex items-center gap-3 text-[11px] text-[color:var(--sc-ink-muted)] mb-4">
                <span className="h-px flex-1 bg-[color:var(--sc-border)]" /> or <span className="h-px flex-1 bg-[color:var(--sc-border)]" />
              </div>
              <button
                type="button"
                onClick={startGoogleLogin}
                data-testid="login-google"
                className="sc-btn-outline w-full justify-center flex items-center gap-2 py-3 bg-white"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C39.8 36.6 44 31 44 24c0-1.3-.1-2.3-.4-3.5z" />
                </svg>
                Continue with Google
              </button>
            </div>
          )}

          {/* Register / Create Account link intentionally removed —
              new users must download the app to register. */}
          <div className="mt-6 pt-6 border-t border-[color:var(--sc-border)]">
            <div className="text-xs text-[color:var(--sc-ink-muted)] mb-2 text-center">
              New to Slangcart? Register through the app.
            </div>
            <a
              href="https://play.google.com/store/apps/details?id=com.slangcart.app"
              target="_blank"
              rel="noreferrer"
              data-testid="login-download-app"
              className="sc-btn-outline w-full justify-center flex items-center gap-2 py-3 bg-white"
            >
              <Download size={16} /> Download App
            </a>
          </div>
          </div>
          <div className="mt-6 text-center text-xs text-[color:var(--sc-ink-muted)]">
            <Link to="/" className="hover:text-[color:var(--sc-primary)] font-semibold" data-testid="login-back-home">
              ← Back to slangcart.com
            </Link>
          </div>
          {/* Legal & info links — synced with the app via /legal/{kind} */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-[color:var(--sc-ink-muted)]" data-testid="login-legal-links">
            <Link to="/legal/terms" className="hover:text-[color:var(--sc-primary)] font-semibold" data-testid="login-legal-terms">Terms</Link>
            <span className="opacity-40">·</span>
            <Link to="/legal/privacy" className="hover:text-[color:var(--sc-primary)] font-semibold" data-testid="login-legal-privacy">Privacy</Link>
            <span className="opacity-40">·</span>
            <Link to="/legal/refund" className="hover:text-[color:var(--sc-primary)] font-semibold" data-testid="login-legal-refund">Refund</Link>
            <span className="opacity-40">·</span>
            <Link to="/legal/contact_us" className="hover:text-[color:var(--sc-primary)] font-semibold" data-testid="login-legal-contact">Contact</Link>
            <span className="opacity-40">·</span>
            <Link to="/legal/about" className="hover:text-[color:var(--sc-primary)] font-semibold" data-testid="login-legal-about">About</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
