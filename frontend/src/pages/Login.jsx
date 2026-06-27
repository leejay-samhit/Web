import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        <div className="w-full max-w-md sc-fade-in">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[color:var(--sc-primary)] text-white grid place-items-center font-extrabold">
              S
            </div>
            <div>
              <div className="font-extrabold text-[color:var(--sc-ink)]">Slangcart</div>
              <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Shop · Service · Connect</div>
            </div>
          </div>
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
            {error && (
              <div
                data-testid="login-error"
                className="text-sm font-semibold text-[color:var(--sc-error)] bg-red-50 border border-red-100 rounded-xl px-3 py-2"
              >
                {error}
              </div>
            )}
            <button
              data-testid="login-submit"
              disabled={loading}
              className="sc-btn-primary w-full justify-center flex items-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 text-sm text-[color:var(--sc-ink-muted)]">
            New to Slangcart?{" "}
            <Link data-testid="login-go-register" to="/register" className="font-semibold text-[color:var(--sc-primary)]">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
