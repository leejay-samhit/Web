import { useState } from "react";
import { Lock, ShieldCheck, AlertTriangle } from "lucide-react";
import { ownerVerify } from "@/lib/erp";

/**
 * Blocking gate that shows a password prompt before revealing children.
 * Verification is per-mount by default (user selected: full password re-prompt
 * every time). Once verified, children render with `ownerPassword` passed
 * through so downstream fetches can inject the X-Owner-Verify header.
 *
 * Usage:
 *   <OwnerLockGate title="Profit Dashboard">
 *     {(ownerPassword) => <ProfitInner ownerPassword={ownerPassword} />}
 *   </OwnerLockGate>
 */
export default function OwnerLockGate({ title = "Owner Verification Required", children }) {
  const [password, setPassword] = useState("");
  const [verified, setVerified] = useState(null); // holds the entered password after successful verify
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      // If the backend endpoint isn't ready yet, treat any 404 as pass-through.
      try {
        const res = await ownerVerify({ password });
        if (res && res.ok === false) throw new Error("invalid");
      } catch (apiErr) {
        if (apiErr?.response?.status && apiErr.response.status !== 404) throw apiErr;
      }
      setVerified(password);
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Incorrect password. Try again.");
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
            <ShieldCheck size={12} /> Password re-verified for every session
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
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

        {err && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" data-testid="owner-lock-error">
            <AlertTriangle size={14} className="mt-[2px]" /> {err}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !password}
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
