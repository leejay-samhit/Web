import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Loader2, CheckCircle2, ShieldCheck, Wallet, Info } from "lucide-react";
import { log } from "@/lib/log";

/**
 * Register flow — mirrors the mobile app:
 *   1. User submits the form → POST /api/auth/register
 *   2. If the backend returns a token AND user.registration_paid is true,
 *      route straight to /dashboard.
 *   3. Otherwise show the "Pay registration fee" step. The user can:
 *        a) pay instantly via /api/payment/register-fee (mock / backward-compat)
 *      After success we refresh /api/auth/me and route to /dashboard.
 */
export default function Register() {
  const { register, refreshMe } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", referral_code: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(null);  // user object after register
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await register(form);
      const u = data?.user || null;
      if (data?.token && u?.registration_paid) {
        nav("/dashboard");
        return;
      }
      // Either token issued without payment OR no token returned at all.
      setRegistered(u);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const payRegistrationFee = async () => {
    setPaying(true);
    setPayError("");
    try {
      await api.post("/payment/register-fee", {});
      await refreshMe();
      nav("/dashboard");
    } catch (e) {
      log.error("Register: pay registration-fee failed", e);
      setPayError(e?.response?.data?.detail || "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  /* ----------------------- After-register pay step ----------------------- */
  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[color:var(--sc-bg)]">
        <div className="w-full max-w-md sc-fade-in" data-testid="reg-pay-step">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[color:var(--sc-primary)] text-white grid place-items-center font-extrabold">S</div>
            <div>
              <div className="font-extrabold text-[color:var(--sc-ink)]">Slangcart</div>
              <div className="text-[11px] text-[color:var(--sc-ink-muted)]">One last step…</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="text-[color:var(--sc-primary)]" size={22} />
            <h1 className="text-2xl font-extrabold text-[color:var(--sc-ink)]">Account created!</h1>
          </div>
          <p className="text-[color:var(--sc-ink-muted)] text-sm">
            Hi <span className="font-semibold text-[color:var(--sc-ink)]">{registered?.name || form.name}</span> — to activate your account and join the referral network,
            please complete the one-time registration fee.
          </p>

          <div className="sc-card p-4 mt-4">
            <div className="flex justify-between text-sm"><span>Registration fee</span><span className="font-semibold">₹100</span></div>
            <div className="flex justify-between text-sm"><span>GST (18%)</span><span className="font-semibold">₹18</span></div>
            <div className="border-t border-[color:var(--sc-border)] mt-1 pt-2 flex justify-between font-extrabold"><span>Total</span><span>₹118</span></div>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-2 flex items-start gap-1.5">
              <Info size={12} className="mt-0.5 shrink-0" />
              <span>
                Your referral commissions and L1–L4 earnings unlock only after this payment is verified and admin approves your account.
              </span>
            </div>
          </div>

          {payError && (
            <div data-testid="reg-pay-error" className="text-sm font-semibold text-[color:var(--sc-error)] bg-red-50 border border-red-100 rounded-xl px-3 py-2 mt-3">
              {payError}
            </div>
          )}

          <button
            data-testid="reg-pay-now"
            onClick={payRegistrationFee}
            disabled={paying}
            className="sc-btn-primary w-full mt-4 justify-center inline-flex items-center gap-2"
          >
            {paying ? <Loader2 className="animate-spin" size={16} /> : <Wallet size={16} />}
            {paying ? "Processing…" : "Pay ₹118 & activate account"}
          </button>

          <div className="flex items-center gap-2 mt-3 text-[11px] text-[color:var(--sc-ink-muted)]">
            <ShieldCheck size={12} /> Secure payment · powered by Slangcart Treasury
          </div>

          <div className="mt-6 text-sm text-[color:var(--sc-ink-muted)]">
            Want to do this later?{" "}
            <Link data-testid="reg-skip-pay" to="/login" className="font-semibold text-[color:var(--sc-primary)]">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------- Sign-up form ----------------------- */
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[color:var(--sc-bg)]">
      <div className="w-full max-w-md sc-fade-in">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[color:var(--sc-primary)] text-white grid place-items-center font-extrabold">
            S
          </div>
          <div>
            <div className="font-extrabold text-[color:var(--sc-ink)]">Slangcart</div>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Shop · Service · Connect</div>
          </div>
        </div>
        <h1 className="text-3xl font-extrabold text-[color:var(--sc-ink)]">Create your account</h1>
        <p className="text-[color:var(--sc-ink-muted)] mt-1">Join the Slangcart network in 30 seconds.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input data-testid="reg-name" required placeholder="Full name" value={form.name} onChange={set("name")} className="sc-input" />
          <input data-testid="reg-email" required type="email" placeholder="Email" value={form.email} onChange={set("email")} className="sc-input" />
          <input data-testid="reg-phone" placeholder="Phone (10-digit)" value={form.phone} onChange={set("phone")} className="sc-input" inputMode="tel" />
          <input data-testid="reg-password" required type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={set("password")} className="sc-input" minLength={6} />
          <input data-testid="reg-referral" placeholder="Referral code (optional)" value={form.referral_code} onChange={set("referral_code")} className="sc-input" />
          {error && (
            <div data-testid="reg-error" className="text-sm font-semibold text-[color:var(--sc-error)] bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          <button data-testid="reg-submit" disabled={loading} className="sc-btn-primary w-full justify-center flex items-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <div className="mt-3 text-[11px] text-[color:var(--sc-ink-muted)] flex items-start gap-1.5">
          <Info size={12} className="mt-0.5 shrink-0" />
          <span>By creating an account you accept Slangcart&apos;s Terms &amp; Privacy. A one-time registration fee of ₹118 (incl. GST) is payable on the next step.</span>
        </div>
        <div className="mt-6 text-sm text-[color:var(--sc-ink-muted)]">
          Have an account?{" "}
          <Link data-testid="reg-go-login" to="/login" className="font-semibold text-[color:var(--sc-primary)]">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
