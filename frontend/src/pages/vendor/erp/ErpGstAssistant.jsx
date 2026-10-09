import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import { useAuth } from "@/context/AuthContext";
import { listPurchases, paiseToRupees } from "@/lib/erp";
import { listInvoices } from "@/lib/vendorSales";
import { formatINR } from "@/lib/utils";
import { Sparkles, ShieldAlert, Info, ArrowRight, Download, RefreshCw } from "lucide-react";

const TYPES = {
  collected: { icon: ArrowRight, bg: "bg-sky-50 border-sky-200 text-sky-800" },
  paid:      { icon: ArrowRight, bg: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  payable:   { icon: ShieldAlert, bg: "bg-amber-50 border-amber-200 text-amber-900" },
  itc:       { icon: Sparkles, bg: "bg-violet-50 border-violet-200 text-violet-800" },
  disclaimer:{ icon: Info,     bg: "bg-slate-50 border-slate-200 text-slate-700" },
};

const monthKey = (d) => { try { return new Date(d).toISOString().slice(0, 7); } catch { return ""; } };

/**
 * Smart GST — computed strictly from BILLED INVOICES for the month, with a
 * running purchase-GST (input credit) carry-forward ledger:
 *   COLLECTED = GST actually billed to customers in this month's invoices
 *   PAID      = purchase GST entered in the Purchase Book this month
 *   PAYABLE   = max(0, collected − (carry-forward input credit + paid this month))
 *   CARRY FWD = leftover input credit rolled into next month
 *   NET PROFIT= Σ (selling − purchase) × (1 − GST%) over units SOLD this month
 * All figures in rupees.
 */
function computeSmartGst(uid, purchases, period) {
  const invoices = listInvoices(uid).filter((i) => i.status === "completed");

  const invByMonth = {};
  invoices.forEach((inv) => {
    const m = monthKey(inv.created_at);
    if (!m) return;
    const agg = invByMonth[m] || (invByMonth[m] = { collected: 0, netProfit: 0 });
    (inv.items || []).forEach((it) => {
      const q = Number(it.qty || 0);
      const gst = Number(it.gst_pct || 0);
      const sell = Number(it.price || 0);
      const cost = Number(it.cost || 0);
      agg.collected += Number(it.tax_amount != null ? it.tax_amount : (sell * gst / 100) * q);
      agg.netProfit += (sell - cost) * (1 - gst / 100) * q;
    });
  });

  const paidByMonth = {};
  (purchases || []).forEach((p) => {
    const m = monthKey(p.purchaseDate);
    if (!m) return;
    paidByMonth[m] = (paidByMonth[m] || 0) + paiseToRupees(Number(p.gstAmount_paise || 0) * Number(p.quantity || 0));
  });

  const months = [...new Set([...Object.keys(invByMonth), ...Object.keys(paidByMonth), period])].filter(Boolean).sort();
  let carry = 0;
  let result = { collected: 0, paid: 0, carryIn: 0, payable: 0, carryOut: 0, netProfit: 0 };
  for (const m of months) {
    if (m > period) break;
    const collected = Math.round(((invByMonth[m]?.collected) || 0) * 100) / 100;
    const paid = Math.round((paidByMonth[m] || 0) * 100) / 100;
    const avail = carry + paid;
    const payable = Math.max(0, Math.round((collected - avail) * 100) / 100);
    const carryOut = Math.max(0, Math.round((avail - collected) * 100) / 100);
    if (m === period) {
      result = { collected, paid, carryIn: carry, payable, carryOut, netProfit: Math.round(((invByMonth[m]?.netProfit) || 0) * 100) / 100 };
    }
    carry = carryOut;
  }
  return result;
}

export default function ErpGstAssistant() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6" data-testid="erp-gst-assistant">
        <VendorNav />
        <ErpNav />
        <OwnerLockGate title="Smart GST Assistant — Owner verification required">
          {() => <Inner period={period} setPeriod={setPeriod} />}
        </OwnerLockGate>
      </div>
    </Layout>
  );
}

function Inner({ period, setPeriod }) {
  const { user } = useAuth();
  const vendorId = user?.id || user?._id || "anon";
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const p = await listPurchases(vendorId);
        if (alive) setPurchases(Array.isArray(p) ? p : []);
      } catch { if (alive) setPurchases([]); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [vendorId, bump]);

  const d = useMemo(() => computeSmartGst(vendorId, purchases, period), [vendorId, purchases, period]);

  const hasActivity = d.collected || d.paid || d.netProfit || d.carryIn;
  const lines = useMemo(() => {
    if (!hasActivity) {
      return [{ type: "disclaimer", text: `No invoices were billed in ${period}, so there is nothing to collect, pay or report for this month. Figures will appear once you bill a sale.` }];
    }
    return [
      { type: "collected", text: `You collected ${formatINR(d.collected)} GST from customers this month (from billed invoices only).` },
      { type: "paid", text: `You paid ${formatINR(d.paid)} GST on purchases this month${d.carryIn ? `, plus ${formatINR(d.carryIn)} input credit carried forward from earlier months` : ""}.` },
      { type: "payable", text: `Estimated GST payable is ${formatINR(d.payable)} (collected ${formatINR(d.collected)} − available input credit ${formatINR(d.paid + d.carryIn)}).` },
      ...(d.carryOut ? [{ type: "itc", text: `${formatINR(d.carryOut)} unused input credit carries forward to next month.` }] : []),
      { type: "itc", text: `Net profit this month after removing GST is ${formatINR(d.netProfit)} (sold units: selling − purchase, each minus its GST).` },
      { type: "disclaimer", text: "Please verify these figures with your CA before filing your GST return." },
    ];
  }, [d, hasActivity, period]);

  const downloadExcel = () => {
    const rows = [
      { Metric: "Period", Value: period },
      { Metric: "GST collected from customers (billed invoices)", Value: d.collected },
      { Metric: "GST paid on purchases (this month)", Value: d.paid },
      { Metric: "Input credit carried forward (from earlier months)", Value: d.carryIn },
      { Metric: "Estimated GST payable", Value: d.payable },
      { Metric: "Input credit carried to next month", Value: d.carryOut },
      { Metric: "Net profit this month (after GST)", Value: d.netProfit },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 48 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Smart GST");
    XLSX.writeFile(wb, `smart-gst-${period}.xlsx`);
  };

  return (
    <>
      <div className="sc-card p-4 mb-4 flex items-center gap-3 flex-wrap">
        <div className="text-sm font-extrabold inline-flex items-center gap-1.5"><Sparkles size={14} /> Explain my GST for</div>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm"
          data-testid="gst-assistant-period"
        />
        <button
          onClick={() => setBump((b) => b + 1)}
          data-testid="gst-assistant-sync"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold border border-[color:var(--sc-border)]"
          title="Sync invoices & purchase book"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Sync invoices & purchase book
        </button>
        <button
          onClick={downloadExcel}
          data-testid="gst-assistant-export"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold bg-[color:var(--sc-primary)] text-white"
        >
          <Download size={14} /> Download Excel
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4" data-testid="gst-assistant-kpis">
        {[
          { k: "Collected (invoices)", v: d.collected, c: "text-sky-700" },
          { k: "Paid + carry (purchases)", v: d.paid + d.carryIn, c: "text-emerald-700" },
          { k: "Payable (est.)", v: d.payable, c: "text-amber-700" },
          { k: "Net profit (month)", v: d.netProfit, c: "text-[color:var(--sc-primary)]" },
        ].map((x) => (
          <div key={x.k} className="sc-card p-3">
            <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--sc-ink-muted)]">{x.k}</div>
            <div className={`text-xl font-extrabold ${x.c}`}>{formatINR(x.v)}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Preparing your GST summary…</div>
      ) : (
        <div className="space-y-2" data-testid="gst-assistant-lines">
          {lines.map((line, i) => {
            const spec = TYPES[line.type] || TYPES.disclaimer;
            const Icon = spec.icon;
            return (
              <div key={i} className={`rounded-xl border ${spec.bg} px-4 py-3 flex items-start gap-3`}>
                <Icon size={16} className="mt-0.5 shrink-0" />
                <div className="text-sm">{line.text}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
