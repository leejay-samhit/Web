import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDateTime } from "@/lib/utils";
import { ArrowDownToLine, Wallet as WalletIcon, X, Loader2, Printer, RefreshCw } from "lucide-react";
import { log } from "@/lib/log";

/* -------------------------------------------------------------------------- */
/*  Receipt template — printed via window.print()                              */
/* -------------------------------------------------------------------------- */
function openReceiptPrint({ user, txn }) {
  const positive =
    (txn.type || "").toLowerCase().includes("commission") ||
    (txn.type || "").toLowerCase().includes("credit") ||
    (Number(txn.amount) > 0 && txn.type !== "withdraw");
  const sign = positive ? "+" : "-";
  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>Slangcart · Receipt · ${txn.id || ""}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; color: #0F172A; margin: 0; padding: 32px; background: #fff; }
  .brand { display:flex; align-items:center; gap:12px; }
  .brand .logo { width:44px; height:44px; border-radius:12px; background:#0F6E4F; color:#fff; font-weight:800; display:grid; place-items:center; font-size:22px; }
  .brand .name { font-size:20px; font-weight:800; }
  .brand .tag { font-size:11px; color:#64748B; }
  h1 { font-size:22px; margin: 20px 0 6px; }
  .muted { color:#64748B; font-size:12px; }
  .card { border:1px solid #E2E8F0; border-radius:16px; padding:20px; margin-top:20px; }
  .row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed #E2E8F0; }
  .row:last-child { border-bottom:0; }
  .row .k { color:#64748B; font-size:13px; }
  .row .v { font-weight:600; font-size:13px; }
  .amt { font-size:34px; font-weight:800; color:${positive ? "#0F6E4F" : "#0F172A"}; margin-top:6px; }
  .chip { display:inline-block; font-size:11px; font-weight:700; padding:2px 10px; border-radius:999px; background:#E8F4ED; color:#0F6E4F; text-transform:uppercase; letter-spacing:.06em; }
  .footer { margin-top:28px; font-size:11px; color:#94A3B8; text-align:center; }
  @media print { body { padding: 0; } .noprint { display:none; } }
</style></head>
<body>
  <div class="brand">
    <div class="logo">S</div>
    <div>
      <div class="name">Slangcart</div>
      <div class="tag">Shop · Service · Connect</div>
    </div>
  </div>
  <h1>Transaction receipt</h1>
  <div class="muted">${formatDateTime(txn.created_at || txn.paid_at) || ""}</div>

  <div class="card">
    <div class="chip">${(txn.status || "posted").toUpperCase()}</div>
    <div class="amt">${sign} ${formatINR(Math.abs(Number(txn.amount) || 0)).replace(/[^\d.,₹\-\+ ]/g, "")}</div>
    <div class="muted">${(txn.description || txn.type || "Transaction")}</div>
  </div>

  <div class="card">
    <div class="row"><span class="k">Receipt ID</span><span class="v">${txn.id || "—"}</span></div>
    <div class="row"><span class="k">Type</span><span class="v">${txn.type || "—"}</span></div>
    <div class="row"><span class="k">Reference</span><span class="v">${txn.reference || txn.order_id || txn.withdrawal_id || "—"}</span></div>
    <div class="row"><span class="k">Account holder</span><span class="v">${user?.name || "—"}</span></div>
    <div class="row"><span class="k">Referral code</span><span class="v">${user?.referral_code || "—"}</span></div>
    <div class="row"><span class="k">Contact</span><span class="v">${user?.email || user?.phone || "—"}</span></div>
    <div class="row"><span class="k">Status</span><span class="v">${txn.status || "posted"}</span></div>
  </div>

  <div class="footer">This is a system-generated receipt from Slangcart. Keep it for your records.</div>

  <div class="noprint" style="text-align:center; margin-top:24px;">
    <button onclick="window.print()" style="background:#0F6E4F;color:#fff;border:0;border-radius:10px;padding:10px 20px;font-weight:700;cursor:pointer;">Print now</button>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 250);</script>
</body></html>`;
  const win = window.open("", "_blank", "noopener,noreferrer,width=780,height=900");
  if (!win) {
    alert("Please allow pop-ups to open the receipt.");
    return;
  }
  win.document.write(html);
  win.document.close();
}

/* -------------------------------------------------------------------------- */
/*  Transaction row — with Receipt button on every row                         */
/* -------------------------------------------------------------------------- */
function TxnRow({ t, user }) {
  const type = (t.type || "").toLowerCase();
  const positive = type.includes("commission") || type.includes("credit") || (Number(t.amount) > 0 && type !== "withdraw");
  return (
    <div className="py-2.5 flex items-center justify-between gap-2" data-testid={`txn-${t.id}`}>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{t.description || t.type}</div>
        <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{formatDateTime(t.created_at || t.paid_at)}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-extrabold ${positive ? "text-[color:var(--sc-success)]" : "text-[color:var(--sc-ink)]"}`}>
          {positive ? "+" : "-"} {formatINR(Math.abs(t.amount))}
        </div>
        <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{t.status}</div>
      </div>
      <button
        onClick={() => openReceiptPrint({ user, txn: t })}
        data-testid={`txn-receipt-${t.id}`}
        title="Print receipt"
        className="ml-1 w-9 h-9 rounded-lg border border-[color:var(--sc-border)] grid place-items-center text-[color:var(--sc-ink-muted)] hover:text-[color:var(--sc-primary)] hover:bg-[color:var(--sc-accent-light)] transition"
      >
        <Printer size={14} />
      </button>
    </div>
  );
}

function renderTxns(loading, txns, user) {
  if (loading) return <Spinner />;
  if (txns.length === 0) return <EmptyState icon={WalletIcon} title="No transactions yet" />;
  return (
    <div className="mt-3 divide-y divide-[color:var(--sc-border)]" data-testid="txn-list">
      {txns.slice(0, 24).map((t) => <TxnRow key={t.id} t={t} user={user} />)}
    </div>
  );
}

export default function Wallet() {
  const { user, refreshMe } = useAuth();
  const [txns, setTxns] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true); else setSyncing(true);
    try {
      const [t, w] = await Promise.allSettled([
        api.get("/transactions/me", { params: { limit: 50, include_pending: true } }),
        api.get("/withdrawals/me"),
      ]);
      if (t.status === "fulfilled") setTxns(Array.isArray(t.value.data) ? t.value.data : t.value.data?.items || []);
      else log.error("Wallet.load /transactions/me failed", t.reason);
      if (w.status === "fulfilled") setWithdrawals(Array.isArray(w.value.data) ? w.value.data : w.value.data?.items || []);
      else log.error("Wallet.load /withdrawals/me failed", w.reason);
      // Keep the wallet balance / vendor earnings in lockstep with the app.
      refreshMe?.();
      setLastSynced(new Date());
    } finally {
      if (!silent) setLoading(false); else setSyncing(false);
    }
  }, [refreshMe]);

  useEffect(() => { load(); }, [load]);

  // Sync every 30s so wallet stays in lockstep with the mobile app.
  useEffect(() => {
    const POLL_MS = 30000;
    const tick = () => document.visibilityState === "visible" && load({ silent: true });
    const timer = setInterval(tick, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && load({ silent: true });
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const submit = async () => {
    setErr("");
    const n = Number(amount);
    if (!n || n <= 0) { setErr("Enter a valid amount."); return; }
    setBusy(true);
    try {
      await api.post("/withdrawals", { amount: n });
      setOpen(false);
      setAmount("");
      await Promise.all([load({ silent: true }), refreshMe()]);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not request withdrawal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Wallet">
      <div className="space-y-5 sc-fade-in">
        <div
          data-testid="wallet-hero"
          className="rounded-3xl p-6 bg-gradient-to-br from-[color:var(--sc-primary)] to-[color:var(--sc-primary-700)] text-white relative overflow-hidden"
        >
          <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="relative z-10">
            <div className="text-sm text-white/75 font-semibold">Available balance</div>
            <div data-testid="wallet-balance" className="text-4xl font-extrabold mt-1">{formatINR(user?.wallet_balance)}</div>
            <div className="text-sm text-white/85 mt-2">Total earned: <b>{formatINR(user?.total_earned)}</b></div>
            {user?.is_vendor && (
              <div data-testid="wallet-vendor-earnings" className="text-sm text-white/85 mt-1">
                Vendor earnings (paid on delivery): <b>{formatINR(user?.vendor_earnings)}</b>
              </div>
            )}
            <button
              data-testid="wallet-withdraw"
              onClick={() => setOpen(true)}
              className="mt-4 bg-white text-[color:var(--sc-primary)] font-bold rounded-xl px-4 py-2.5 inline-flex items-center gap-2"
            >
              <ArrowDownToLine size={16} /> Request withdrawal
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <div className="sc-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-extrabold">Recent transactions</div>
                {lastSynced && (
                  <div className="text-[11px] text-[color:var(--sc-ink-muted)] flex items-center gap-1.5 mt-0.5" data-testid="wallet-last-synced">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Auto-syncs every 30s · last {lastSynced.toLocaleTimeString()}
                  </div>
                )}
              </div>
              <button
                onClick={() => load({ silent: true })}
                disabled={syncing}
                data-testid="wallet-sync"
                className="w-9 h-9 rounded-lg border border-[color:var(--sc-border)] grid place-items-center text-[color:var(--sc-ink-muted)] hover:text-[color:var(--sc-primary)] hover:bg-[color:var(--sc-accent-light)] disabled:opacity-60"
                title="Sync now"
              >
                <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              </button>
            </div>
            {renderTxns(loading, txns, user)}
          </div>

          <div className="sc-card p-5">
            <div className="flex items-center justify-between">
              <div className="font-extrabold">Withdrawals</div>
              <span className="text-xs text-[color:var(--sc-ink-muted)]">{withdrawals.length}</span>
            </div>
            {withdrawals.length === 0 ? (
              <EmptyState icon={ArrowDownToLine} title="No withdrawals yet" />
            ) : (
              <div className="mt-3 divide-y divide-[color:var(--sc-border)]">
                {withdrawals.slice(0, 12).map((w) => (
                  <div key={w.id} className="py-2.5 flex items-center justify-between gap-2" data-testid={`wd-${w.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{formatINR(w.amount)}</div>
                      <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{formatDateTime(w.created_at)}</div>
                    </div>
                    <span className="sc-chip">{w.status}</span>
                    <button
                      onClick={() => openReceiptPrint({ user, txn: { ...w, type: "withdrawal", description: `Withdrawal · ${w.status}`, amount: -Math.abs(w.amount) } })}
                      data-testid={`wd-receipt-${w.id}`}
                      title="Print receipt"
                      className="w-8 h-8 rounded-lg border border-[color:var(--sc-border)] grid place-items-center text-[color:var(--sc-ink-muted)] hover:text-[color:var(--sc-primary)] hover:bg-[color:var(--sc-accent-light)]"
                    >
                      <Printer size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 sc-fade-in" data-testid="wd-modal">
            <div className="flex items-center justify-between mb-2">
              <div className="font-extrabold">Request withdrawal</div>
              <button onClick={() => setOpen(false)} className="text-[color:var(--sc-ink-muted)]"><X size={18} /></button>
            </div>
            <div className="text-xs text-[color:var(--sc-ink-muted)]">Available: <b>{formatINR(user?.wallet_balance)}</b></div>
            <input
              data-testid="wd-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount in ₹"
              className="sc-input mt-3"
            />
            {err && <div className="text-sm font-semibold text-[color:var(--sc-error)] mt-2">{err}</div>}
            <button data-testid="wd-submit" onClick={submit} disabled={busy} className="sc-btn-primary w-full mt-4 flex items-center justify-center gap-2">
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? "Submitting…" : "Request"}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
