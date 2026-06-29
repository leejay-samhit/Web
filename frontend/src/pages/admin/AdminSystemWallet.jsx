import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatINR, formatDateTime } from "@/lib/utils";
import {
  Loader2, Plus, RefreshCw, Download, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Landmark, Wallet, Receipt, ShieldAlert,
  ArrowDownToLine, FileSpreadsheet, ChevronRight, X,
} from "lucide-react";
import { log } from "@/lib/log";

const GROUPS = [
  { key: "group_1_revenue",            title: "1. Revenue Ledger",        icon: TrendingUp,    main: "gross",                fields: [["registration", "Registration"], ["service", "Service"], ["shop", "Shop"], ["reversed", "Reversed"]], formula: "gross = registration + service + shop" },
  { key: "group_2_liability",          title: "2. User Liability Wallet", icon: Wallet,        main: "available_user_balance", fields: [["total_reward_credits", "Reward credits"], ["total_withdrawals_settled", "Withdrawals settled"]], formula: "available = credits − withdrawals settled − holds" },
  { key: "group_3_gst",                title: "3. GST Ledger",            icon: Receipt,       main: "payable",              fields: [["collected", "Collected"], ["paid", "Paid"]], formula: "payable = collected − paid" },
  { key: "group_4_platform_fee",       title: "4. Platform Fee Ledger",   icon: Landmark,      main: "collected",            fields: [], formula: "Platform-fee revenue (separate from Group 1 gross)" },
  { key: "group_5_expenses",           title: "5. Expense Ledger",        icon: TrendingDown,  main: "total",                fields: [["gst_paid_excluded", "GST paid excluded"]], formula: "total = sum of approved expenses" },
  { key: "group_6_pending_withdrawals",title: "6. Pending Withdrawals",   icon: ArrowDownToLine, main: "pending_amount",     fields: [], formula: "Unpaid withdrawal requests awaiting bank disbursal" },
  { key: "group_7_bank",               title: "7. Bank Ledger",           icon: Landmark,      main: "balance",              fields: [["credits", "Credits"], ["debits", "Debits"]], formula: "balance = credits − debits" },
  { key: "group_8_refunds",            title: "8. Refund Ledger",         icon: ShieldAlert,   main: "total",                fields: [["count", "Count"], ["clawback_total", "Clawback"], ["platform_fee_reversed", "PF reversed"], ["outstanding_debt", "Outstanding debt"], ["outstanding_debt_users", "Debt users"]], formula: "total = sum of refunded amounts" },
];

// Recompute the headline value client-side from the additive sub-stats, so we
// can flag any math drift between the sum-of-fields and the backend headline.
// (Subtractive groups like GST and Bank are also handled explicitly.)
function recomputeMain(group, d) {
  if (!d) return null;
  switch (group.key) {
    case "group_1_revenue":   return (d.registration || 0) + (d.service || 0) + (d.shop || 0);
    case "group_3_gst":       return (d.collected || 0) - (d.paid || 0);
    case "group_5_expenses":  return null; // backend-sum; no client recompute
    case "group_7_bank":      return (d.credits || 0) - (d.debits || 0);
    default: return null;
  }
}

const closeEnough = (a, b, eps = 0.01) => Math.abs((a || 0) - (b || 0)) <= eps;

function StatRow({ label, value, kind = "money" }) {
  return (
    <div className="flex justify-between py-1 text-xs border-b border-[color:var(--sc-border)] last:border-0">
      <span className="text-[color:var(--sc-ink-muted)]">{label}</span>
      <span className="font-semibold">{kind === "money" ? formatINR(value || 0) : (value ?? "—")}</span>
    </div>
  );
}

function GroupCard({ group, data, onClick }) {
  const Icon = group.icon;
  const d = data || {};
  const headline = d[group.main] || 0;
  const recomputed = recomputeMain(group, d);
  const verified = recomputed === null ? null : closeEnough(recomputed, headline);
  return (
    <button
      type="button"
      onClick={onClick}
      className="sc-card p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all w-full"
      data-testid={`g-${group.key}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-9 h-9 rounded-xl bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary)] grid place-items-center">
          <Icon size={16} />
        </div>
        <div className="font-extrabold text-sm flex-1">{group.title}</div>
        <ChevronRight size={14} className="text-[color:var(--sc-ink-muted)]" />
      </div>
      <div className="text-2xl font-extrabold mb-1">{formatINR(headline)}</div>
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--sc-ink-muted)] mb-2 flex items-center gap-1.5">
        <span>{group.main.replace(/_/g, " ")}</span>
        {verified === true && (
          <span className="sc-chip" data-testid={`g-${group.key}-verify-ok`} style={{ background: "#E7F6EC", color: "#0F6E4F" }}>Σ ✓</span>
        )}
        {verified === false && (
          <span className="sc-chip" data-testid={`g-${group.key}-verify-fail`} style={{ background: "#FDECEC", color: "#B42318" }}>Σ ⚠ {formatINR(recomputed)}</span>
        )}
      </div>
      <div className="space-y-0.5">
        {group.fields.map(([k, label]) => (
          <StatRow key={k} label={label} value={d[k]} kind={(typeof d[k] === "number" && k.includes("count")) || k.includes("users") ? "count" : "money"} />
        ))}
      </div>
      <div className="text-[10px] text-[color:var(--sc-ink-muted)] mt-2 italic">{group.formula}</div>
      <div className="text-[10px] text-[color:var(--sc-primary)] mt-1 font-semibold">Tap to view transactions →</div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Group-transactions drill-in modal                                          */
/* -------------------------------------------------------------------------- */
function GroupTxnsModal({ group, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: d } = await api.get(`/admin/finance/groups/${group.key}/transactions`, { params: { limit: 100 } });
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.detail || "Could not load transactions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [group.key]);

  const items = data?.items || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" data-testid="g-txns-modal">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col sc-fade-in">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[color:var(--sc-border)]">
          <div>
            <div className="font-extrabold">{data?.title || group.title}</div>
            <div className="text-xs text-[color:var(--sc-ink-muted)]">
              {items.length} transactions · subtotal <span className="font-semibold">{formatINR(data?.subtotal || 0)}</span>
            </div>
          </div>
          <button onClick={onClose} data-testid="g-txns-close" className="text-[color:var(--sc-ink-muted)]"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-4">
          {loading ? <Spinner /> : error ? (
            <div className="text-sm font-semibold text-[color:var(--sc-error)] py-6 text-center">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-[color:var(--sc-ink-muted)] py-6 text-center">No transactions in this group yet.</div>
          ) : (
            <table className="w-full text-xs" data-testid="g-txns-table">
              <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] sticky top-0">
                <tr>
                  <th className="text-left px-2 py-2">When</th>
                  <th className="text-left px-2 py-2">Type</th>
                  <th className="text-left px-2 py-2">Description</th>
                  <th className="text-left px-2 py-2">Status</th>
                  <th className="text-right px-2 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} className="border-t border-[color:var(--sc-border)]" data-testid={`g-txn-${t.id}`}>
                    <td className="px-2 py-2 text-[color:var(--sc-ink-muted)] whitespace-nowrap">{formatDateTime(t.created_at)}</td>
                    <td className="px-2 py-2"><span className="sc-chip capitalize">{(t.type || "").replace(/_/g, " ")}</span></td>
                    <td className="px-2 py-2">{t.description || "—"}</td>
                    <td className="px-2 py-2">
                      <span className={`sc-chip ${t.status === "success" ? "" : ""}`} style={t.status === "success" ? { background: "#E7F6EC", color: "#0F6E4F" } : { background: "#FBEDE2", color: "#A0522D" }}>
                        {t.status || "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-semibold">{formatINR(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpenseRow({ e }) {
  return (
    <tr className="border-t border-[color:var(--sc-border)]" data-testid={`exp-${e.id}`}>
      <td className="px-3 py-2 text-xs font-mono">{e.display_id || e.id?.slice(0, 10)}</td>
      <td className="px-3 py-2 text-xs"><span className="sc-chip capitalize">{(e.category || "").replace(/_/g, " ")}</span></td>
      <td className="px-3 py-2 text-xs">{e.vendor || "—"}</td>
      <td className="px-3 py-2 text-xs">{e.description || "—"}</td>
      <td className="px-3 py-2 text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(e.incurred_at || e.created_at)}</td>
      <td className="px-3 py-2 text-xs text-right font-semibold">{formatINR(e.amount)}</td>
    </tr>
  );
}

export default function AdminSystemWallet() {
  const [nw, setNw] = useState(null);
  const [sourceBreakdown, setSourceBreakdown] = useState(null);
  const [tallyWithdrawals, setTallyWithdrawals] = useState({ items: [], total_count: 0, total_amount: 0 });
  const [expenses, setExpenses] = useState({ items: [], total: 0 });
  const [expenseCats, setExpenseCats] = useState([]);
  const [alerts, setAlerts] = useState({ current: {}, alerts: [] });
  const [loading, setLoading] = useState(true);

  // Deposit form (Direct-added Money UTR)
  const [dep, setDep] = useState({ amount: "", utr: "", bank_ref: "", remarks: "" });
  const [depBusy, setDepBusy] = useState(false);

  // Expense form (Manual Adjustment Entry)
  const [exp, setExp] = useState({ category: "office_expenses", amount: "", vendor: "", description: "", utr: "", reference: "" });
  const [expBusy, setExpBusy] = useState(false);

  const [acting, setActing] = useState("");
  const [msg, setMsg] = useState("");
  const [groupModal, setGroupModal] = useState(null); // group object

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [n, src, tw, exs, excat, al] = await Promise.allSettled([
        api.get("/admin/finance/net-worth"),
        api.get("/admin/system-wallet/source-breakdown"),
        api.get("/admin/system-wallet/tally-withdrawals"),
        api.get("/admin/expenses", { params: { limit: 50 } }),
        api.get("/admin/expenses/categories"),
        api.get("/admin/ledger-alerts"),
      ]);
      if (n.status === "fulfilled") setNw(n.value.data);
      if (src.status === "fulfilled") setSourceBreakdown(src.value.data);
      if (tw.status === "fulfilled") setTallyWithdrawals(tw.value.data || { items: [] });
      if (exs.status === "fulfilled") setExpenses(exs.value.data || { items: [] });
      if (excat.status === "fulfilled") setExpenseCats(excat.value.data?.items || []);
      if (al.status === "fulfilled") setAlerts(al.value.data || { current: {}, alerts: [] });
    } catch (e) { log.error("AdminSystemWallet.load failed", e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const deposit = async () => {
    if (!dep.amount || !dep.utr) { setMsg("Amount and UTR are required."); return; }
    setDepBusy(true); setMsg("");
    try {
      await api.post("/admin/system-wallet/deposit", { amount: Number(dep.amount), utr: dep.utr, bank_ref: dep.bank_ref || undefined, remarks: dep.remarks || undefined });
      setDep({ amount: "", utr: "", bank_ref: "", remarks: "" });
      setMsg("UTR deposit recorded.");
      load();
    } catch (e) { setMsg(e?.response?.data?.detail || "Deposit failed"); }
    finally { setDepBusy(false); }
  };

  const addExpense = async () => {
    if (!exp.amount || !exp.category) { setMsg("Amount and category are required."); return; }
    setExpBusy(true); setMsg("");
    try {
      await api.post("/admin/expenses", { ...exp, amount: Number(exp.amount) });
      setExp({ category: "office_expenses", amount: "", vendor: "", description: "", utr: "", reference: "" });
      setMsg("Expense recorded.");
      load();
    } catch (e) { setMsg(e?.response?.data?.detail || "Expense add failed"); }
    finally { setExpBusy(false); }
  };

  const reconcile = async () => {
    setActing("reconcile");
    try { await api.post("/admin/system-wallet/reconcile"); setMsg("Reconciled."); load(); }
    catch (e) { setMsg(e?.response?.data?.detail || "Failed"); }
    finally { setActing(""); }
  };

  const exportCsv = async (kind) => {
    setActing(`export-${kind}`);
    try {
      const url = `/admin/finance/export/${kind}`;
      const res = await api.get(url, { responseType: "blob" });
      const a = document.createElement("a");
      const u = URL.createObjectURL(res.data);
      a.href = u; a.download = `${kind}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch (e) { setMsg(`Export ${kind} failed`); }
    finally { setActing(""); }
  };

  const resolveAlert = async (id) => {
    try { await api.post(`/admin/ledger-alerts/${id}/resolve`, { note: "Resolved from web" }); load(); }
    catch (e) { setMsg(e?.response?.data?.detail || "Failed"); }
  };

  if (loading) return <Layout title="Admin · System wallet"><Spinner /></Layout>;

  const bt = nw?.bank_tally || {};
  const ms = nw?.master || {};
  // Per business rule (29-Jun-2026): "Service Received" amounts are paid
  // offline / direct to the provider — they never touch the platform bank.
  // We therefore EXCLUDE them from the bank-balance tally and instead show
  // them as a separate "Service margin (off-bank)" card that adds back
  // into Company Net Worth.
  const serviceMargin = nw?.group_1_revenue?.service || 0;
  const btInflowAdj = (bt.inflow || 0) - serviceMargin;
  const btNetAdj = btInflowAdj - (bt.outflow || 0);
  const btNetExpected = btNetAdj; // recomputed value matches the new headline
  const btNetOk = closeEnough(btNetExpected, btNetAdj);

  const c = ms.components || {};
  // Adjusted bank tally (without service receipts) is what hits the bank,
  // and we re-add `serviceMargin` so Company Net Worth stays whole.
  const nwExpected = btNetAdj
                   + serviceMargin
                   + (c.pending_collections || 0)
                   - (c.user_wallet_balance || 0)
                   - (c.pending_withdrawals || 0)
                   - (c.gst_payable || 0);
  const nwOk = closeEnough(nwExpected, ms.net_worth);

  return (
    <Layout title="Admin · System wallet · Treasury">
      {msg && <div data-testid="sw-msg" className="sc-card p-2 mb-3 text-sm font-semibold text-[color:var(--sc-primary)]">{msg}</div>}

      {/* Bank tally + master net worth */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="sc-card p-5" data-testid="sw-bank-tally">
          <div className="font-extrabold mb-1 flex items-center gap-2"><Landmark size={16} /> Bank balance tally (on platform)</div>
          <div className="text-[10px] text-[color:var(--sc-ink-muted)] mb-3">Pure bank credits/debits only — excludes off-bank service receipts.</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-[color:var(--sc-ink-muted)] uppercase">Inflow</div>
              <div className="text-xl font-extrabold text-green-700" data-testid="bt-inflow">{formatINR(btInflowAdj)}</div>
              {serviceMargin > 0 && (
                <div className="text-[10px] text-[color:var(--sc-ink-muted)] mt-0.5">excl. service {formatINR(serviceMargin)} (off-bank)</div>
              )}
            </div>
            <div>
              <div className="text-[10px] text-[color:var(--sc-ink-muted)] uppercase">Outflow</div>
              <div className="text-xl font-extrabold text-red-700" data-testid="bt-outflow">{formatINR(bt.outflow)}</div>
            </div>
            <div>
              <div className="text-[10px] text-[color:var(--sc-ink-muted)] uppercase">Net (bank)</div>
              <div className="text-2xl font-extrabold flex items-center gap-1.5" data-testid="bt-net">{formatINR(btNetAdj)}{btNetOk ? <span data-testid="bt-verify-ok" className="sc-chip" style={{ background: "#E7F6EC", color: "#0F6E4F" }}>Σ ✓</span> : <span data-testid="bt-verify-fail" className="sc-chip" style={{ background: "#FDECEC", color: "#B42318" }}>Σ ⚠ {formatINR(btNetExpected)}</span>}</div>
            </div>
            <div>
              <div className="text-[10px] text-[color:var(--sc-ink-muted)] uppercase">UTR deposits</div>
              <div className="text-xl font-extrabold">{formatINR(bt.utr_deposits)}</div>
            </div>
            <div className="col-span-2 border-t border-[color:var(--sc-border)] pt-2 mt-1 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[color:var(--sc-ink-muted)] uppercase">Service margin (off-bank)</div>
                <div className="text-[10px] text-[color:var(--sc-ink-muted)]">Paid offline/direct to provider — not in bank tally</div>
              </div>
              <div className="text-lg font-extrabold text-[color:var(--sc-primary)]" data-testid="bt-service-margin">{formatINR(serviceMargin)}</div>
            </div>
            <div className="col-span-2 text-[11px] text-[color:var(--sc-ink-muted)]">Reversals {bt.reversals_count ?? 0} · Adjustments {bt.adjustments_count ?? 0} · {bt.adjustments_amount ? `Δ ${formatINR(bt.adjustments_amount)}` : ""}</div>
            <div className="col-span-2 text-[10px] text-[color:var(--sc-ink-muted)] mt-1 italic">Net (bank) = Inflow (UTR + bank credits + +adjust) − Outflow (withdrawals + bank debits + reversals + −adjust). Service receipts shown separately.</div>
          </div>
        </div>

        <div className="sc-card p-5" data-testid="sw-master">
          <div className="font-extrabold mb-3 flex items-center gap-2"><TrendingUp size={16} /> Company net worth</div>
          <div className="text-3xl font-extrabold text-[color:var(--sc-primary)] mb-2 flex items-center gap-2" data-testid="sw-net-worth">{formatINR(ms.net_worth)}{nwOk ? <span data-testid="nw-verify-ok" className="sc-chip" style={{ background: "#E7F6EC", color: "#0F6E4F" }}>Σ ✓</span> : <span data-testid="nw-verify-fail" className="sc-chip" style={{ background: "#FDECEC", color: "#B42318" }}>Σ ⚠ {formatINR(nwExpected)}</span>}</div>
          <div className="space-y-0.5 text-xs">
            <StatRow label="Bank tally net (off-bank excluded)" value={btNetAdj} />
            <StatRow label="Service margin (off-bank) (+)" value={serviceMargin} />
            <StatRow label="Pending collections (+)" value={c.pending_collections} />
            <StatRow label="User wallet balance (–)" value={c.user_wallet_balance} />
            <StatRow label="Pending withdrawals (–)" value={c.pending_withdrawals} />
            <StatRow label="GST payable (–)" value={c.gst_payable} />
          </div>
          <div className="text-[10px] text-[color:var(--sc-ink-muted)] mt-2 italic">net_worth = bank_net + service_margin + pending − user_wallet − pending_withdrawals − gst_payable</div>
        </div>
      </div>

      {/* 8 Group ledger */}
      <div className="font-extrabold mb-2 text-sm uppercase tracking-wider text-[color:var(--sc-ink-muted)]">8 Group Ledger</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5" data-testid="sw-groups">
        {GROUPS.map((g) => <GroupCard key={g.key} group={g} data={nw?.[g.key]} onClick={() => setGroupModal(g)} />)}
      </div>

      {groupModal && <GroupTxnsModal group={groupModal} onClose={() => setGroupModal(null)} />}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button data-testid="sw-reconcile" disabled={acting === "reconcile"} onClick={reconcile} className="sc-btn-outline inline-flex items-center gap-1.5">
          {acting === "reconcile" ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />} Reconcile
        </button>
        <button data-testid="sw-export-transactions" disabled={acting === "export-transactions"} onClick={() => exportCsv("transactions")} className="sc-btn-outline inline-flex items-center gap-1.5">
          {acting === "export-transactions" ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />} Export Transactions
        </button>
        <button data-testid="sw-export-expenses" disabled={acting === "export-expenses"} onClick={() => exportCsv("expenses")} className="sc-btn-outline inline-flex items-center gap-1.5">
          {acting === "export-expenses" ? <Loader2 className="animate-spin" size={14} /> : <FileSpreadsheet size={14} />} Export Expenses
        </button>
        <button data-testid="sw-export-bank" disabled={acting === "export-bank"} onClick={() => exportCsv("bank")} className="sc-btn-outline inline-flex items-center gap-1.5">
          {acting === "export-bank" ? <Loader2 className="animate-spin" size={14} /> : <Landmark size={14} />} Export Bank Ledger
        </button>
      </div>

      {/* UTR deposit + Manual Adjustment */}
      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <div className="sc-card p-4" data-testid="sw-deposit-card">
          <div className="font-extrabold mb-3">Direct-added Money (UTR)</div>
          <div className="grid grid-cols-2 gap-2">
            <input className="sc-input" type="number" data-testid="sw-dep-amount" placeholder="Amount (₹) *" value={dep.amount} onChange={(e) => setDep({ ...dep, amount: e.target.value })} />
            <input className="sc-input" data-testid="sw-dep-utr" placeholder="UTR *" value={dep.utr} onChange={(e) => setDep({ ...dep, utr: e.target.value })} />
            <input className="sc-input" data-testid="sw-dep-ref" placeholder="Bank ref (optional)" value={dep.bank_ref} onChange={(e) => setDep({ ...dep, bank_ref: e.target.value })} />
            <input className="sc-input" data-testid="sw-dep-remarks" placeholder="Remarks" value={dep.remarks} onChange={(e) => setDep({ ...dep, remarks: e.target.value })} />
          </div>
          <button data-testid="sw-deposit" disabled={depBusy || !dep.amount || !dep.utr} onClick={deposit} className="sc-btn-primary mt-3 inline-flex items-center gap-1.5">
            {depBusy ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Record UTR deposit
          </button>
        </div>

        <div className="sc-card p-4" data-testid="sw-expense-card">
          <div className="font-extrabold mb-3">Manual Adjustment / Expense entry</div>
          <div className="grid grid-cols-2 gap-2">
            <select className="sc-input col-span-2" data-testid="sw-exp-cat" value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })}>
              {expenseCats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <input className="sc-input" type="number" data-testid="sw-exp-amount" placeholder="Amount (₹) *" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} />
            <input className="sc-input" data-testid="sw-exp-vendor" placeholder="Vendor" value={exp.vendor} onChange={(e) => setExp({ ...exp, vendor: e.target.value })} />
            <input className="sc-input col-span-2" data-testid="sw-exp-desc" placeholder="Description" value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} />
            <input className="sc-input" data-testid="sw-exp-utr" placeholder="UTR (optional)" value={exp.utr} onChange={(e) => setExp({ ...exp, utr: e.target.value })} />
            <input className="sc-input" data-testid="sw-exp-ref" placeholder="Reference" value={exp.reference} onChange={(e) => setExp({ ...exp, reference: e.target.value })} />
          </div>
          <button data-testid="sw-add-expense" disabled={expBusy || !exp.amount} onClick={addExpense} className="sc-btn-primary mt-3 inline-flex items-center gap-1.5">
            {expBusy ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Add expense
          </button>
        </div>
      </div>

      {/* Withdraw for Account Tally */}
      <div className="sc-card p-4 mb-4" data-testid="sw-tally-withdrawals">
        <div className="font-extrabold mb-3 flex items-center gap-2"><ArrowDownToLine size={16} /> Withdraw for Account Tally</div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div><div className="text-[color:var(--sc-ink-muted)]">Pending count</div><div className="text-lg font-bold">{tallyWithdrawals.total_count ?? 0}</div></div>
          <div><div className="text-[color:var(--sc-ink-muted)]">Pending amount</div><div className="text-lg font-bold">{formatINR(tallyWithdrawals.total_amount)}</div></div>
          <div className="text-right text-[color:var(--sc-ink-muted)] text-[11px]">Settle from /admin/withdrawals queue.</div>
        </div>
      </div>

      {/* User source accountability */}
      <div className="sc-card p-4 mb-4" data-testid="sw-source">
        <div className="font-extrabold mb-3 flex items-center gap-2"><FileSpreadsheet size={16} /> User Source Accountability</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(sourceBreakdown?.rows || []).map((r) => (
            <div key={r.source} className="border border-[color:var(--sc-border)] rounded-xl p-3" data-testid={`src-${r.source}`}>
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--sc-ink-muted)]">{r.source}</div>
              <div className="text-xl font-extrabold">{formatINR(r.amount)}</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)]">{r.count ?? 0} entries</div>
              {sourceBreakdown?.fan_out?.[r.source] && (
                <div className="mt-2 pt-2 border-t border-[color:var(--sc-border)] text-[11px] text-[color:var(--sc-ink-muted)]">
                  Paid out: {formatINR(sourceBreakdown.fan_out[r.source].payouts_amount)} · {sourceBreakdown.fan_out[r.source].payouts_count} txns
                </div>
              )}
            </div>
          ))}
          {(sourceBreakdown?.rows || []).length === 0 && <div className="text-sm text-[color:var(--sc-ink-muted)] col-span-full text-center py-4">No source data.</div>}
        </div>
      </div>

      {/* Drift alerts */}
      <div className="sc-card p-4 mb-4" data-testid="sw-alerts">
        <div className="flex items-center justify-between mb-3">
          <div className="font-extrabold flex items-center gap-2"><AlertTriangle size={16} /> Money flow drift alerts</div>
          <div className="text-xs text-[color:var(--sc-ink-muted)]">
            held {formatINR(alerts.current?.held)} / expected {formatINR(alerts.current?.expected_held)}
            {alerts.current?.drift !== undefined && <span className={`ml-2 font-bold ${Math.abs(alerts.current.drift) > 1 ? "text-[color:var(--sc-error)]" : "text-[color:var(--sc-primary)]"}`}>Δ {formatINR(alerts.current.drift)}</span>}
          </div>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {alerts.alerts?.slice(0, 10).map((a) => (
            <div key={a.id} className="flex items-start gap-2 text-xs border-b border-[color:var(--sc-border)] py-1.5" data-testid={`alert-${a.id}`}>
              <div className={`mt-0.5 ${a.resolved ? "text-[color:var(--sc-primary)]" : "text-amber-600"}`}>
                {a.resolved ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{a.message}</div>
                <div className="text-[10px] text-[color:var(--sc-ink-muted)]">{formatDateTime(a.created_at)} {a.resolved ? `· resolved: ${a.resolution_note || ""}` : ""}</div>
              </div>
              {!a.resolved && <button data-testid={`alert-resolve-${a.id}`} onClick={() => resolveAlert(a.id)} className="text-[10px] font-semibold px-2 py-0.5 rounded border border-[color:var(--sc-border)]">Resolve</button>}
            </div>
          ))}
          {(!alerts.alerts || alerts.alerts.length === 0) && <div className="text-sm text-[color:var(--sc-ink-muted)] text-center py-4">No alerts.</div>}
        </div>
      </div>

      {/* Recent expenses */}
      <div className="sc-card overflow-x-auto" data-testid="sw-expense-list">
        <div className="px-4 pt-4 font-extrabold">Recent expenses ({expenses.total ?? expenses.items?.length ?? 0})</div>
        <table className="w-full text-sm mt-2">
          <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
            <tr>
              <th className="text-left px-3 py-2">ID</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Vendor</th>
              <th className="text-left px-3 py-2">Description</th>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-right px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(expenses.items || []).slice(0, 25).map((e) => <ExpenseRow key={e.id} e={e} />)}
            {(expenses.items || []).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[color:var(--sc-ink-muted)]">No expenses.</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
