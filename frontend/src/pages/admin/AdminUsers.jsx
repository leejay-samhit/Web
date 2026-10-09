import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { initials, formatINR } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { resetCenterWipe } from "@/lib/erp";
import {
  Search, ShieldOff, ShieldCheck, KeyRound, Eye, Settings2, X, Wallet,
  Snowflake, Flame, Trash2, Save, Loader2, AlertTriangle,
} from "lucide-react";
import { log } from "@/lib/log";

const POS_LS_KEYS = (uid) => [
  `sc_vendor_pos_v1_${uid || "anon"}`,
  `sc_vendor_pos_counter_v1_${uid || "anon"}`,
  `sc_vendor_customers_v1_${uid || "anon"}`,
];

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [active, setActive] = useState(null); // user open in the Manage modal
  const [resetOpen, setResetOpen] = useState(false);

  const qRef = useRef(q);
  qRef.current = q;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users", { params: { q: qRef.current, limit: 50 } });
      setUsers(data?.items || data || []);
    } catch (error) {
      log.error("AdminUsers.load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleBlock = async (u) => {
    setActing(u.id);
    try {
      const url = u.is_blocked ? `/admin/users/${u.id}/unblock` : `/admin/users/${u.id}/block`;
      await api.post(url, { reason: "via admin panel" });
      toast.success(u.is_blocked ? "User unblocked" : "User blocked");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Action failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <Layout title="Admin · Users">
      {/* Danger Zone — Reset Center */}
      <div className="sc-card p-4 mb-4 border-l-4" style={{ borderLeftColor: "#B42318" }} data-testid="reset-center-card">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0" style={{ background: "#FDECEC", color: "#B42318" }}>
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1">
            <div className="font-extrabold text-[color:var(--sc-ink)]">Reset Center · One account, one shop</div>
            <div className="text-xs text-[color:var(--sc-ink-muted)] mt-0.5 leading-relaxed">
              Permanently wipes <b>your own shop</b> ({me?.email}) — deletes every product &amp; order on the main
              backend and clears all local billing data (invoices, transfers, customers). PIN-protected and irreversible.
            </div>
          </div>
          <button onClick={() => setResetOpen(true)} data-testid="reset-center-open" className="text-xs font-bold px-3 py-2 rounded-lg text-white shrink-0" style={{ background: "#B42318" }}>
            Open Reset Center
          </button>
        </div>
      </div>

      <div className="sc-card p-3 flex items-center gap-2 mb-4">
        <Search size={16} className="text-[color:var(--sc-ink-muted)] ml-1" />
        <input
          data-testid="admin-users-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search by name, email, code"
          className="flex-1 bg-transparent outline-none text-sm"
        />
        <button onClick={load} className="sc-btn-primary text-sm py-1.5">Search</button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="sc-card overflow-x-auto" data-testid="admin-users-table">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr>
                <th className="text-left px-4 py-2.5">User</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-2.5 hidden lg:table-cell">Phone</th>
                <th className="text-left px-4 py-2.5">Wallet</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-[color:var(--sc-border)]" data-testid={`au-${u.id}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full sc-avatar text-white text-[11px] font-bold grid place-items-center">
                        {initials(u.name)}
                      </div>
                      <div>
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{u.role}{u.admin_role ? ` · ${u.admin_role}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">{u.email}</td>
                  <td className="px-4 py-2.5 hidden lg:table-cell">{u.phone || "—"}</td>
                  <td className="px-4 py-2.5">
                    {formatINR(u.wallet_balance)}
                    {u.wallet_frozen && <span className="ml-1 sc-chip" style={{ background: "#E8F0FE", color: "#1d4ed8" }}>frozen</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.is_blocked ? <span className="sc-chip" style={{ background: "#FBEAEA", color: "#9c2b2b" }}>Blocked</span>
                      : <span className="sc-chip">{u.approval_status || "active"}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-1 whitespace-nowrap">
                    <button
                      data-testid={`au-block-${u.id}`}
                      onClick={() => toggleBlock(u)}
                      disabled={acting === u.id}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] hover:bg-[color:var(--sc-accent-light)]"
                    >
                      {u.is_blocked ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                      {u.is_blocked ? "Unblock" : "Block"}
                    </button>
                    <button
                      data-testid={`au-manage-${u.id}`}
                      onClick={() => setActive(u)}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] hover:bg-[color:var(--sc-accent-light)]"
                    >
                      <Settings2 size={14} /> Manage
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {active && <ManageUserModal u={active} onClose={() => setActive(null)} onChanged={load} />}
      {resetOpen && <ResetCenterModal me={me} onClose={() => setResetOpen(false)} />}
    </Layout>
  );
}

/* ───────────────────────── Manage user modal ───────────────────────── */
function ManageUserModal({ u, onClose, onChanged }) {
  const [name, setName] = useState(u.name || "");
  const [email, setEmail] = useState(u.email || "");
  const [phone, setPhone] = useState(u.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [revealed, setRevealed] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const [frozen, setFrozen] = useState(!!u.wallet_frozen);
  const [amount, setAmount] = useState("");
  const [adjType, setAdjType] = useState("credit");
  const [reason, setReason] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);

  const [busy, setBusy] = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.patch(`/admin/users/${u.id}`, { name, email, phone });
      toast.success("Profile updated");
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Update failed");
    } finally { setSavingProfile(false); }
  };

  const reveal = async () => {
    setPwdBusy(true); setRevealed("");
    try {
      const { data } = await api.get(`/admin/users/${u.id}/password`);
      setRevealed(data?.password || "(empty)");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Cannot reveal — use Reset & reveal");
    } finally { setPwdBusy(false); }
  };

  const resetReveal = async () => {
    const pwd = newPwd.trim();
    if (pwd.length < 4) { toast.error("Enter a new password (min 4 chars)"); return; }
    setPwdBusy(true);
    try {
      const { data } = await api.post(`/admin/users/${u.id}/reset-password`, { new_password: pwd });
      setRevealed(data?.password || pwd);
      toast.success("Password reset — shown below");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Reset failed");
    } finally { setPwdBusy(false); }
  };

  const toggleFreeze = async () => {
    setWalletBusy(true);
    try {
      await api.post(`/admin/users/${u.id}/wallet/freeze`);
      setFrozen((f) => !f);
      toast.success("Wallet freeze toggled");
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally { setWalletBusy(false); }
  };

  const adjustWallet = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter an amount > 0"); return; }
    if (!reason.trim()) { toast.error("A reason is required"); return; }
    setWalletBusy(true);
    try {
      await api.post(`/admin/users/${u.id}/wallet`, { amount: amt, type: adjType, reason: reason.trim() });
      toast.success(`Wallet ${adjType === "credit" ? "credited" : "debited"} ${formatINR(amt)}`);
      setAmount(""); setReason("");
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Adjustment failed");
    } finally { setWalletBusy(false); }
  };

  const del = async () => {
    if (!window.confirm(`Delete ${u.name} (${u.email})? A pre-delete backup is auto-saved and can be restored from Data Backups with your danger PIN.`)) return;
    setBusy(true);
    try {
      await api.delete(`/admin/users/${u.id}`);
      toast.success("User deleted (backup auto-saved)");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Delete failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" data-testid="au-manage-modal">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto sc-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--sc-border)] sticky top-0 bg-white">
          <div className="font-extrabold">Manage · {u.name}</div>
          <button onClick={onClose} aria-label="Close" data-testid="au-manage-close"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-5">
          {/* Profile */}
          <section>
            <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-2">Profile</div>
            <div className="space-y-2">
              <input className="sc-input" data-testid="au-edit-name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="sc-input" data-testid="au-edit-email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="sc-input" data-testid="au-edit-phone" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <button onClick={saveProfile} disabled={savingProfile} data-testid="au-edit-save" className="sc-btn-primary inline-flex items-center gap-1.5 text-sm py-2">
                {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save profile
              </button>
            </div>
          </section>

          {/* Password */}
          <section>
            <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-2">Password</div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={reveal} disabled={pwdBusy} data-testid="au-pwd-reveal" className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[color:var(--sc-border)] hover:bg-[color:var(--sc-accent-light)]">
                <Eye size={14} /> Reveal current
              </button>
              <input className="sc-input flex-1 min-w-[140px]" data-testid="au-pwd-new" placeholder="New password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
              <button onClick={resetReveal} disabled={pwdBusy} data-testid="au-pwd-reset" className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[color:var(--sc-border)] hover:bg-[color:var(--sc-accent-light)]">
                <KeyRound size={14} /> Reset &amp; reveal
              </button>
            </div>
            {revealed && (
              <div className="mt-2 text-sm font-mono bg-[color:var(--sc-accent-light)] rounded-lg px-3 py-2" data-testid="au-pwd-value">
                Password: <b>{revealed}</b>
              </div>
            )}
          </section>

          {/* Wallet */}
          <section>
            <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-2">Wallet · {formatINR(u.wallet_balance)}</div>
            <button onClick={toggleFreeze} disabled={walletBusy} data-testid="au-wallet-freeze" className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[color:var(--sc-border)] hover:bg-[color:var(--sc-accent-light)] mb-2">
              {frozen ? <Flame size={14} /> : <Snowflake size={14} />} {frozen ? "Unfreeze wallet" : "Freeze wallet"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <select className="sc-input" data-testid="au-wallet-type" value={adjType} onChange={(e) => setAdjType(e.target.value)}>
                <option value="credit">Credit (+)</option>
                <option value="debit">Debit (−)</option>
              </select>
              <input className="sc-input" data-testid="au-wallet-amount" type="number" placeholder="Amount ₹" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <input className="sc-input col-span-2" data-testid="au-wallet-reason" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <button onClick={adjustWallet} disabled={walletBusy} data-testid="au-wallet-apply" className="sc-btn-primary inline-flex items-center gap-1.5 text-sm py-2 mt-2">
              {walletBusy ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />} Apply adjustment
            </button>
          </section>

          {/* Danger */}
          <section className="pt-2 border-t border-[color:var(--sc-border)]">
            <button onClick={del} disabled={busy} data-testid="au-delete" className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg text-white" style={{ background: "#B42318" }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete user
            </button>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-1">A full pre-delete backup is auto-saved — recoverable from Data Backups with your danger PIN.</div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Reset Center modal ──────────────────────── */
function ResetCenterModal({ me, onClose }) {
  const [emailConfirm, setEmailConfirm] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const uid = me?.id;
  const email = (me?.email || "").trim();
  const emailOk = emailConfirm.trim().toLowerCase() === email.toLowerCase();

  const run = async () => {
    if (!emailOk) { toast.error("Type your exact email to confirm"); return; }
    if (!pin.trim()) { toast.error("Enter your Owner PIN"); return; }
    setBusy(true);
    try {
      // 1) PIN-gated local wipe FIRST — aborts (401) before any destructive
      //    upstream deletes if the PIN is wrong.
      const wipe = await resetCenterWipe({ pin: pin.trim() });

      // 2) Delete this shop's live products on the main backend (own token).
      let productsDeleted = 0, productErrors = 0;
      try {
        const { data } = await api.get("/vendor/me/products", { params: { limit: 500 } });
        const items = data?.items || data || [];
        for (const p of items) {
          try { await api.delete(`/vendor/me/products/${p.id}`); productsDeleted += 1; }
          catch { productErrors += 1; }
        }
      } catch {
        // not an approved vendor / no products — skip silently
      }

      // 3) Cancel this shop's live orders (best-effort).
      try {
        const { data } = await api.get("/vendor/me/orders", { params: { status: "all" } });
        const orders = data?.items || data || [];
        for (const o of orders) {
          const oid = o.order_id || o.id;
          if (!oid) continue;
          try { await api.patch(`/vendor/orders/${oid}/status`, { status: "cancelled" }); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }

      // 4) Clear local POS/billing storage for this shop.
      try { POS_LS_KEYS(uid).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }

      setResult({ ...wipe.deleted, productsDeleted, productErrors });
      toast.success("Shop reset complete");
    } catch (e) {
      if (e?.response?.status === 401) toast.error("Wrong Owner PIN — nothing was wiped");
      else toast.error(e?.response?.data?.detail || "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" data-testid="reset-center-modal">
      <div className="bg-white rounded-2xl w-full max-w-md sc-fade-in overflow-hidden">
        <div className="p-4 border-b border-[color:var(--sc-border)] flex items-center justify-between" style={{ background: "#FDECEC" }}>
          <div className="font-extrabold flex items-center gap-2" style={{ color: "#B42318" }}>
            <AlertTriangle size={18} /> Reset Center
          </div>
          <button onClick={onClose} aria-label="Close" data-testid="reset-center-close"><X size={18} /></button>
        </div>
        {!result ? (
          <div className="p-4 space-y-3">
            <p className="text-sm text-[color:var(--sc-ink)] leading-relaxed">
              This permanently deletes <b>all products and orders</b> in your shop (<b>{email}</b>) on the main backend
              and clears all local billing data. This cannot be undone.
            </p>
            <label className="block text-xs font-semibold text-[color:var(--sc-ink)]">
              Type your email to confirm
              <input className="sc-input mt-1" data-testid="reset-email-confirm" placeholder={email} value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-[color:var(--sc-ink)]">
              Owner PIN
              <input className="sc-input mt-1 font-mono tracking-widest" data-testid="reset-pin" type="password" inputMode="numeric" placeholder="Owner PIN (default 1234)" value={pin} onChange={(e) => setPin(e.target.value)} />
            </label>
            <button onClick={run} disabled={busy || !emailOk || !pin.trim()} data-testid="reset-confirm" className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold py-2.5 rounded-lg text-white disabled:opacity-50" style={{ background: "#B42318" }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Wipe my shop permanently
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-2" data-testid="reset-result">
            <div className="text-sm font-bold text-[color:var(--sc-ink)]">Reset complete ✓</div>
            <ul className="text-sm text-[color:var(--sc-ink-muted)] list-disc pl-5 space-y-0.5">
              <li>Live products deleted: <b>{result.productsDeleted}</b>{result.productErrors ? ` (${result.productErrors} failed)` : ""}</li>
              <li>Local mirrored orders cleared: <b>{result.orders}</b></li>
              <li>Substore transfers cleared: <b>{result.transfers}</b></li>
              <li>Substore directory cleared: <b>{result.substores}</b></li>
              <li>Local POS invoices &amp; customers cleared</li>
            </ul>
            <button onClick={onClose} className="sc-btn-primary w-full text-sm py-2 mt-1" data-testid="reset-done">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
