import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", referral_code: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await register(form);
      if (data?.token) {
        nav("/dashboard");
      } else {
        nav("/login");
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

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
          <input data-testid="reg-phone" placeholder="Phone (optional)" value={form.phone} onChange={set("phone")} className="sc-input" />
          <input data-testid="reg-password" required type="password" placeholder="Password" value={form.password} onChange={set("password")} className="sc-input" />
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
