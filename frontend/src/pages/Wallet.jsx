import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDateTime } from "@/lib/utils";
import { ArrowDownToLine, Wallet as WalletIcon, X, Loader2, Send } from "lucide-react";
import { log } from "@/lib/log";
import WalletTransferModal from "@/components/WalletTransferModal";

function TxnRow({ t }) {
  const positive = (t.type || "").includes("commission") || (t.type || "").includes("credit") || (t.amount > 0 && t.type !== "withdraw");
  return (
    <div key={t.id} className="py-2.5 flex items-center justify-between gap-2" data-testid={`txn-${t.id}`}>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{t.description || t.type}</div>
        <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{formatDateTime(t.created_at || t.paid_at)}</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-extrabold ${positive ? "text-[color:var(--sc-success)]" : "text-[color:var(--sc-ink)]"}`}>
          {positive ? "+" : "-"} {formatINR(Math.abs(t.amount))}
        </div>
        <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{t.status}</div>
      </div>
    </div>
  );
}

function renderTxns(loading, txns) {
  if (loading) return <Spinner />;
  if (txns.length === 0) return <EmptyState icon={WalletIcon} title="No transactions yet" />;
  return (
    <div className="mt-3 divide-y divide-[color:var(--sc-border)]" data-testid="txn-list">
      {txns.slice(0, 12).map((t) => <TxnRow key={t.id} t={t} />)}
    </div>
  );
}

export default function Wallet() {
  const { user, refreshMe } = useAuth();
  const [txns, setTxns] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, w] = await Promise.allSettled([
        api.get("/transactions/me", { params: { limit: 50, include_pending: true } }),
        api.get("/withdrawals/me"),
      ]);
      if (t.status === "fulfilled") setTxns(Array.isArray(t.value.data) ? t.value.data : t.value.data?.items || []);
      else log.error("Wallet.load /transactions/me failed", t.reason);
      if (w.status === "fulfilled") setWithdrawals(Array.isArray(w.value.data) ? w.value.data : w.value.data?.items || []);
      else log.error("Wallet.load /withdrawals/me failed", w.reason);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setErr("");
    const n = Number(amount);
    if (!n || n <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/withdrawals", { amount: n });
      setOpen(false);
      setAmount("");
      await Promise.all([load(), refreshMe()]);
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
            <button
              data-testid="wallet-withdraw"
              onClick={() => setOpen(true)}
              className="mt-4 bg-white text-[color:var(--sc-primary)] font-bold rounded-xl px-4 py-2.5 inline-flex items-center gap-2"
            >
              <ArrowDownToLine size={16} /> Request withdrawal
            </button>
            <button
              data-testid="wallet-transfer"
              onClick={() => setTransferOpen(true)}
              className="mt-4 ml-2 bg-white/10 text-white border border-white/30 font-bold rounded-xl px-4 py-2.5 inline-flex items-center gap-2 hover:bg-white/20"
            >
              <Send size={16} /> Send money
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <div className="sc-card p-5">
            <div className="flex items-center justify-between">
              <div className="font-extrabold">Recent transactions</div>
              <span className="text-xs text-[color:var(--sc-ink-muted)]">{txns.length}</span>
            </div>
            {renderTxns(loading, txns)}
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
                  <div key={w.id} className="py-2.5 flex items-center justify-between" data-testid={`wd-${w.id}`}>
                    <div>
                      <div className="text-sm font-semibold">{formatINR(w.amount)}</div>
                      <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{formatDateTime(w.created_at)}</div>
                    </div>
                    <span className="sc-chip">{w.status}</span>
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
      <WalletTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        balance={user?.wallet_balance}
        onSuccess={async () => {
          await Promise.all([load(), refreshMe()]);
        }}
      />
    </Layout>
  );
}
