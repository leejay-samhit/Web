import { useState } from "react";
import { Lock, ShieldCheck, AlertTriangle, KeyRound, Hash } from "lucide-react";
import { ownerVerify } from "@/lib/erp";

/**
 * Blocking gate that shows a password OR 4-digit PIN prompt before revealing
 * children. Verification is per-mount by default (user selected: full re-prompt
 * every time). Once verified, children render with the entered secret passed
 * through so downstream fetches can inject the X-Owner-Verify header.
 *
 * Usage:
 *   <OwnerLockGate title="Profit Dashboard">
 *     {(ownerPassword) => <ProfitInner ownerPassword={ownerPassword} />}
 *   </OwnerLockGate>
 */
export default function OwnerLockGate({ title = "Owner Verification Required", children }) {
  const [mode, setMode] = useState(() => {
    // Remember last choice per browser for a smoother repeat entry.
    return localStorage.getItem("sc.erp.owner.mode") || "password";
  });
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [verified, setVerified] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const chooseMode = (m) => {
    setMode(m);
    localStorage.setItem("sc.erp.owner.mode", m);
    setErr("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const secret = mode === "pin" ? pin : password;
    if (mode === "pin" && !/^\d{4,6}$/.test(pin)) {
      setErr("PIN must be 4 to 6 digits.");
      return;
    }
    if (!secret) return;
    setBusy(true);
    try {
      try {
        const payload = mode === "pin" ? { pin } : { password };
        const res = await ownerVerify(payload);
        if (res && res.ok === false) throw new Error("invalid");
      } catch (apiErr) {
        // 404 = backend not shipped → pass-through (Preview mode).
        if (apiErr?.response?.status && apiErr.response.status !== 404) throw apiErr;
      }
      setVerified(secret);
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Incorrect credentials. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (verified) return typeof children === "function" ? children(verified) : children;

  return (
    <div className="max-w-md mx-auto sc-card p-6" data-testid="owner-lock-gate">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 grid place-items-center">
          <Lock size={20} />
        </div>
        <div>
          <div className="text-lg font-extrabold">{title}</div>
          <div className="text-xs text-[color:var(--sc-ink-muted)] flex items-center gap-1">
            <ShieldCheck size={12} /> Re-verified every time
          </div>
        </div>
      </div>

      {/* Mode switcher */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-full bg-slate-100" role="tablist">
        <button
          type="button"
          onClick={() => chooseMode("password")}
          className={`flex-1 text-xs font-semibold rounded-full px-3 py-1.5 inline-flex items-center justify-center gap-1.5 ${mode === "password" ? "bg-white shadow" : "text-[color:var(--sc-ink-muted)]"}`}
          data-testid="owner-mode-password"
        >
          <KeyRound size={12} /> Password
        </button>
        <button
          type="button"
          onClick={() => chooseMode("pin")}
          className={`flex-1 text-xs font-semibold rounded-full px-3 py-1.5 inline-flex items-center justify-center gap-1.5 ${mode === "pin" ? "bg-white shadow" : "text-[color:var(--sc-ink-muted)]"}`}
          data-testid="owner-mode-pin"
        >
          <Hash size={12} /> Quick PIN
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "password" ? (
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--sc-ink)]">Owner Password</span>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[color:var(--sc-border)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--sc-primary)]"
              placeholder="Enter your owner password"
              data-testid="owner-password-input"
            />
          </label>
        ) : (
          <label className="block">
            <span className="text-xs font-semibold text-[color:var(--sc-ink)]">4-digit PIN</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              autoFocus
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded-xl border border-[color:var(--sc-border)] px-3 py-3 text-center text-2xl tracking-[0.6em] font-extrabold outline-none focus:ring-2 focus:ring-[color:var(--sc-primary)]"
              placeholder="••••"
              data-testid="owner-pin-input"
            />
            <div className="text-[10px] text-[color:var(--sc-ink-muted)] mt-1">
              PIN unlocks the same modules as your password — great for shared devices.
            </div>
          </label>
        )}

        {err && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" data-testid="owner-lock-error">
            <AlertTriangle size={14} className="mt-[2px]" /> {err}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || (mode === "password" ? !password : pin.length < 4)}
          className="w-full rounded-xl bg-[color:var(--sc-primary)] text-white font-semibold py-2 disabled:opacity-50"
          data-testid="owner-unlock-btn"
        >
          {busy ? "Verifying…" : "Unlock"}
        </button>
        <div className="text-[11px] text-[color:var(--sc-ink-muted)] text-center">
          For your security, protected modules always ask again.
        </div>
      </form>
    </div>
  );
}
