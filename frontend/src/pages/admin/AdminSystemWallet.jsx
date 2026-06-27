import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatINR, formatDateTime } from "@/lib/utils";
import { Loader2, Plus, ArrowDownToLine, RefreshCw } from "lucide-react";
import { log } from "@/lib/log";

function Stat({ label, value, testid }) {
  return (
    <div data-testid={testid} className="sc-card p-4">
      <div className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">{label}</div>
      <div className="text-xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

export default function AdminSystemWallet() {
  const [data, setData] = useState({});
  const [breakdown, setBreakdown] = useState(null);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [acting, setActing] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, b, t] = await Promise.all([
        api.get("/admin/system-wallet"),
        api.get("/admin/system-wallet/breakdown").catch(() => ({ data: null })),
        api.get("/admin/system-wallet/transactions", { params: { limit: 25 } }).catch(() => ({ data: [] })),
      ]);
      setData(w.data || {});
      setBreakdown(b.data || null);
      const txnsArr = Array.isArray(t.data) ? t.data : (t.data?.items || t.data?.transactions || []);
      setTxns(txnsArr);
    } catch (error) { log.error("AdminSystemWallet.load failed", error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const deposit = async () => {
    if (!amount) return;
    setActing("deposit");
    try {
      await api.post("/admin/system-wallet/deposit", { amount: Number(amount), note });
      setAmount(""); setNote("");
      load();
    } catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setActing(""); }
  };

  const tally = async () => {
    setActing("tally");
    try { await api.post("/admin/system-wallet/tally-withdraw"); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setActing(""); }
  };

  const reconcile = async () => {
    setActing("reconcile");
    try { await api.post("/admin/system-wallet/reconcile"); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setActing(""); }
  };

  if (loading) return <Layout title="Admin · System wallet"><Spinner /></Layout>;

  const buckets = data?.buckets || {};
  const total = data?.total ?? data?.balance ?? 0;

  return (
    <Layout title="Admin · System wallet · Treasury">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat testid="sw-total" label="Total treasury" value={formatINR(total)} />
        <Stat testid="sw-deposits-bucket" label="Direct signup" value={formatINR(buckets.direct_signup ?? 0)} />
        <Stat testid="sw-referral" label="Referral commission" value={formatINR(buckets.referral_commission ?? 0)} />
        <Stat testid="sw-residual" label="Fee residual" value={formatINR(buckets.fee_residual ?? 0)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="sc-card p-4" data-testid="sw-deposit-card">
          <div className="font-extrabold mb-3">Deposit funds</div>
          <input className="sc-input mb-2" data-testid="sw-amount" type="number" placeholder="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="sc-input mb-2" data-testid="sw-note" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button data-testid="sw-deposit" disabled={acting === "deposit" || !amount} onClick={deposit} className="sc-btn-primary inline-flex items-center gap-1.5">
              {acting === "deposit" ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Deposit
            </button>
            <button data-testid="sw-tally" disabled={acting === "tally"} onClick={tally} className="sc-btn-outline inline-flex items-center gap-1.5">
              {acting === "tally" ? <Loader2 className="animate-spin" size={14} /> : <ArrowDownToLine size={14} />} Tally withdraw
            </button>
            <button data-testid="sw-reconcile" disabled={acting === "reconcile"} onClick={reconcile} className="sc-btn-outline inline-flex items-center gap-1.5">
              {acting === "reconcile" ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />} Reconcile
            </button>
          </div>
        </div>

        <div className="sc-card p-4" data-testid="sw-buckets">
          <div className="font-extrabold mb-3">All buckets</div>
          <div className="space-y-1.5 text-sm">
            {Object.entries(buckets).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-[color:var(--sc-border)] py-1.5">
                <span className="capitalize">{k.replace(/_/g, " ")}</span>
                <strong>{formatINR(v ?? 0)}</strong>
              </div>
            ))}
            {Object.keys(buckets).length === 0 && <div className="text-[color:var(--sc-ink-muted)]">No buckets.</div>}
          </div>
        </div>
      </div>

      {breakdown && (
        <div className="sc-card mt-4 p-4" data-testid="sw-breakdown">
          <div className="font-extrabold mb-3">Inflow / Outflow breakdown</div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-bold text-[color:var(--sc-primary)] mb-1">Inflow</div>
              {Object.entries(breakdown.inflow || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-[color:var(--sc-border)] py-1">
                  <span className="capitalize text-xs">{k.replace(/_/g, " ")}</span>
                  <strong className="text-xs">{typeof v === "number" ? formatINR(v) : String(v)}</strong>
                </div>
              ))}
            </div>
            <div>
              <div className="font-bold text-[color:var(--sc-error)] mb-1">Outflow</div>
              {Object.entries(breakdown.outflow || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-[color:var(--sc-border)] py-1">
                  <span className="capitalize text-xs">{k.replace(/_/g, " ")}</span>
                  <strong className="text-xs">{typeof v === "number" ? formatINR(v) : String(v)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="sc-card mt-4 overflow-x-auto" data-testid="sw-txns">
        <div className="px-4 pt-4 font-extrabold">Recent treasury transactions</div>
        <table className="w-full text-sm mt-2">
          <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
            <tr><th className="text-left px-4 py-2.5">When</th><th className="text-left px-4 py-2.5">Type</th><th className="text-left px-4 py-2.5">Note</th><th className="text-right px-4 py-2.5">Amount</th></tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id} className="border-t border-[color:var(--sc-border)]">
                <td className="px-4 py-2 text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(t.created_at)}</td>
                <td className="px-4 py-2"><span className="sc-chip capitalize">{t.type || t.kind}</span></td>
                <td className="px-4 py-2 text-xs">{t.note || t.description || t.remarks || "—"}</td>
                <td className="px-4 py-2 text-right font-semibold">{formatINR(t.amount ?? 0)}</td>
              </tr>
            ))}
            {txns.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No transactions.</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
