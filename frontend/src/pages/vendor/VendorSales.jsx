import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import { formatINR, formatDateTime } from "@/lib/utils";
import { getDashboardKpis, POS_PAYMENT_MODES } from "@/lib/vendorSales";
import { TrendingUp, Receipt, Package, IndianRupee, Banknote, CreditCard, Wallet, FileWarning, ArrowUpRight } from "lucide-react";

const PAY_ICONS = { cash: Banknote, upi: IndianRupee, debit: CreditCard, credit: CreditCard, netbank: Wallet, wallet: Wallet, credit_sale: FileWarning };

function Card({ icon: Icon, label, value, hint, color = "var(--sc-primary)", testId }) {
  return (
    <div className="sc-card p-4" data-testid={testId}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center" style={{ color }}><Icon size={14} /></div>
        <div className="text-[11px] uppercase tracking-wider text-[color:var(--sc-ink-muted)] font-semibold flex-1">{label}</div>
      </div>
      <div className="text-2xl font-extrabold mt-2" style={{ color }}>{value}</div>
      {hint && <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-1">{hint}</div>}
    </div>
  );
}

export default function VendorSales() {
  const { user } = useAuth();
  const uid = user?.id;
  const nav = useNavigate();
  const [tick, setTick] = useState(0);
  // Lightweight refresh every 30s + on focus, since this is localStorage-backed.
  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    const id = setInterval(onFocus, 30000);
    return () => { window.removeEventListener("focus", onFocus); clearInterval(id); };
  }, []);
  // `tick` is an intentional manual re-render trigger (focus + 30s interval)
  // so KPIs refresh against the latest localStorage state. eslint can't see
  // the side-effect, so silence the false positive.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const k = useMemo(() => getDashboardKpis(uid), [uid, tick]);

  return (
    <Layout title="Vendor · Sales dashboard">
      <VendorNav />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3" data-testid="vs-kpis">
        <Card testId="kpi-today-sales"   icon={TrendingUp} label="Today's sales"     value={formatINR(k.today.sales)}                hint={`${k.today.bills} bills`} />
        <Card testId="kpi-today-profit"  icon={ArrowUpRight} label="Today's profit"   value={formatINR(k.today.profit)} />
        <Card testId="kpi-today-bills"   icon={Receipt}    label="Today's bills"      value={k.today.bills} />
        <Card testId="kpi-today-items"   icon={Package}    label="Items sold today"   value={k.today.items_sold} />
        <Card testId="kpi-month-sales"   icon={TrendingUp} label="This month sales"   value={formatINR(k.month.sales)}  hint={`${k.month.bills} bills`} />
        <Card testId="kpi-month-profit"  icon={ArrowUpRight} label="This month profit" value={formatINR(k.month.profit)} />
        <Card testId="kpi-month-gst"     icon={IndianRupee} label="GST collected (month)" value={formatINR(k.month.gst)} />
        <Card testId="kpi-credit-sales"  icon={FileWarning} label="Credit sales (pending)" value={formatINR(k.today.by_mode.credit_sale)} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4" data-testid="vs-payments">
        {POS_PAYMENT_MODES.filter((m) => m.key !== "credit_sale").map((m) => {
          const I = PAY_ICONS[m.key] || Banknote;
          return (
            <div key={m.key} className="sc-card p-3 flex items-center gap-2" data-testid={`pay-${m.key}`}>
              <div className="w-8 h-8 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)]"><I size={14} /></div>
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wider text-[color:var(--sc-ink-muted)] font-semibold">{m.label}</div>
                <div className="text-base font-extrabold">{formatINR(k.today.by_mode[m.key] || 0)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={() => nav("/vendor/pos")} className="sc-btn-primary inline-flex items-center gap-1.5 mb-4">
        <Receipt size={14} /> Start new sale (POS)
      </button>

      <div className="sc-card p-0 overflow-hidden" data-testid="vs-recent">
        <div className="px-4 py-2 border-b border-[color:var(--sc-border)] font-extrabold text-sm">Recent transactions</div>
        {k.recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[color:var(--sc-ink-muted)]">No bills yet. Click <b>Start new sale (POS)</b> above to create your first invoice.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr>
                <th className="text-left px-3 py-2">Invoice #</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-right px-3 py-2">Items</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {k.recent.map((i) => (
                <tr key={i.id} className="border-t border-[color:var(--sc-border)] hover:bg-[color:var(--sc-accent-light)]/20 cursor-pointer" onClick={() => nav("/vendor/invoices")} data-testid={`recent-${i.id}`}>
                  <td className="px-3 py-2 font-mono">{i.invoice_no}</td>
                  <td className="px-3 py-2 text-[color:var(--sc-ink-muted)]">{formatDateTime(i.created_at)}</td>
                  <td className="px-3 py-2">{i.customer?.name || "Walk-in"}</td>
                  <td className="px-3 py-2 text-right">{i.items?.length || 0}</td>
                  <td className="px-3 py-2 text-right font-extrabold">{formatINR(i.totals?.grand_total)}</td>
                  <td className="px-3 py-2"><span className="sc-chip capitalize" style={i.status === "completed" ? { background: "#E7F6EC", color: "#0F6E4F" } : i.status === "cancelled" ? { background: "#FDECEC", color: "#B42318" } : { background: "#FBEDE2", color: "#A0522D" }}>{i.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
