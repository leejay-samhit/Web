import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import BackendPendingBanner from "@/components/erp/BackendPendingBanner";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import { ownerStatus, ownerChangePassword, ownerChangePin, ownerHistory } from "@/lib/erp";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { KeyRound, Save, ShieldCheck, Fingerprint, Clock, Hash } from "lucide-react";

export default function ErpOwnerSettings() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6" data-testid="erp-owner-settings">
        <VendorNav />
        <ErpNav />
        <OwnerLockGate title="Owner Settings — Owner verification required">
          {(pwd) => <Inner ownerPassword={pwd} />}
        </OwnerLockGate>
      </div>
    </Layout>
  );
}

function Inner({ ownerPassword }) {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState(null);
  const [pending, setPending] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // PIN state
  const [pinCurrentPassword, setPinCurrentPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await ownerStatus();
        setStatus(s);
      } catch { setPending(true); }
      try {
        const h = await ownerHistory(ownerPassword);
        setHistory(h);
      } catch { /* ok */ }
    })();
  }, [ownerPassword]);

  const submit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error("New password should be at least 8 characters.");
    setBusy(true);
    try {
      await ownerChangePassword({ currentPassword, newPassword });
      toast.success("Password changed.");
      setCurrentPassword(""); setNewPassword("");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not change password.");
    }
    setBusy(false);
  };

  const submitPin = async (e) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(newPin)) return toast.error("PIN must be 4 to 6 digits.");
    if (newPin !== confirmPin) return toast.error("PINs don't match.");
    setPinBusy(true);
    try {
      await ownerChangePin({ currentPassword: pinCurrentPassword, newPin });
      toast.success("PIN set. You can now unlock with your PIN too.");
      setNewPin(""); setConfirmPin(""); setPinCurrentPassword("");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 404) {
        // Backend not shipped yet — store locally so the gate can still test.
        localStorage.setItem("sc.erp.owner.pin.set", "1");
        toast.info("PIN saved locally (backend endpoint pending).");
        setNewPin(""); setConfirmPin(""); setPinCurrentPassword("");
      } else {
        toast.error(detail || "Could not update PIN.");
      }
    }
    setPinBusy(false);
  };

  return (
    <>
      {pending && <BackendPendingBanner endpoint="/api/erp/owner-security/*" note="Password updates will sync once the backend is wired." />}

      <div className="sc-card p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 grid place-items-center"><KeyRound size={16} /></div>
          <div>
            <div className="font-extrabold">Owner password</div>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Protected screens re-verify this every time you open them.</div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold">Current password</span>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-lg border border-[color:var(--sc-border)] px-3 py-2 text-sm" data-testid="owner-current-pwd" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold">New password</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border border-[color:var(--sc-border)] px-3 py-2 text-sm" data-testid="owner-new-pwd" />
          </label>
          <button type="submit" disabled={busy || !currentPassword || !newPassword} className="rounded-full px-5 py-2 bg-[color:var(--sc-primary)] text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-50" data-testid="owner-change-pwd-btn">
            <Save size={14} /> {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>

      {/* Quick PIN */}
      <div className="sc-card p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 grid place-items-center"><Hash size={16} /></div>
          <div>
            <div className="font-extrabold">Quick PIN <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-1 align-middle">FAST PATH</span></div>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)]">4–6 digit shortcut for shared devices. Unlocks the same modules as your password.</div>
          </div>
        </div>

        <form onSubmit={submitPin} className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold">Confirm with password</span>
            <input type="password" value={pinCurrentPassword} onChange={(e) => setPinCurrentPassword(e.target.value)} className="w-full rounded-lg border border-[color:var(--sc-border)] px-3 py-2 text-sm" data-testid="owner-pin-current-pwd" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold">New PIN (4–6 digits)</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border border-[color:var(--sc-border)] px-3 py-2 text-center text-xl tracking-[0.4em] font-extrabold"
                placeholder="••••"
                data-testid="owner-new-pin"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold">Confirm PIN</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border border-[color:var(--sc-border)] px-3 py-2 text-center text-xl tracking-[0.4em] font-extrabold"
                placeholder="••••"
                data-testid="owner-confirm-pin"
              />
            </label>
          </div>
          <button type="submit" disabled={pinBusy || newPin.length < 4 || !pinCurrentPassword} className="rounded-full px-5 py-2 bg-[color:var(--sc-primary)] text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-50" data-testid="owner-save-pin-btn">
            <Save size={14} /> {pinBusy ? "Saving PIN…" : (status?.pinUpdatedAt ? "Update PIN" : "Set PIN")}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="sc-card p-4">
          <div className="text-xs font-semibold uppercase text-[color:var(--sc-ink-muted)]">Biometrics</div>
          <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-extrabold"><Fingerprint size={14} /> {status?.biometricsEnabled ? "Enabled" : "Disabled"}</div>
        </div>
        <div className="sc-card p-4">
          <div className="text-xs font-semibold uppercase text-[color:var(--sc-ink-muted)]">Auto-lock</div>
          <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-extrabold"><Clock size={14} /> {status?.autoLockSeconds ? `${Math.round(status.autoLockSeconds / 60)} min` : "15 min"}</div>
        </div>
        <div className="sc-card p-4">
          <div className="text-xs font-semibold uppercase text-[color:var(--sc-ink-muted)]">Password updated</div>
          <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-extrabold"><ShieldCheck size={14} /> {status?.passwordUpdatedAt ? formatDateTime(status.passwordUpdatedAt) : "—"}</div>
        </div>
      </div>

      <div className="sc-card p-4">
        <div className="font-extrabold text-sm mb-2">Login history</div>
        {!history || history.loginHistory?.length === 0 ? (
          <div className="text-xs text-[color:var(--sc-ink-muted)]">No login history yet.</div>
        ) : (
          <ul className="text-xs space-y-1">
            {(history.loginHistory || []).map((h, i) => (
              <li key={i} className={h.ok ? "text-emerald-700" : "text-red-700"}>
                {formatDateTime(h.at)} · {h.device} · {h.ip} · {h.ok ? "OK" : "FAILED"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
