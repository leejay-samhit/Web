import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import { useAuth } from "@/context/AuthContext";
import { gstAssistant, paiseToRupees } from "@/lib/erp";
import { Sparkles, ShieldAlert, Info, ArrowRight, Download } from "lucide-react";

// Icon per line type
const TYPES = {
  collected: { icon: ArrowRight, bg: "bg-sky-50 border-sky-200 text-sky-800" },
  paid:      { icon: ArrowRight, bg: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  payable:   { icon: ShieldAlert, bg: "bg-amber-50 border-amber-200 text-amber-900" },
  itc:       { icon: Sparkles, bg: "bg-violet-50 border-violet-200 text-violet-800" },
  disclaimer:{ icon: Info,     bg: "bg-slate-50 border-slate-200 text-slate-700" },
};

export default function ErpGstAssistant() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6" data-testid="erp-gst-assistant">
        <VendorNav />
        <ErpNav />
        <OwnerLockGate title="Smart GST Assistant — Owner verification required">
          {(pwd) => <Inner ownerPassword={pwd} period={period} setPeriod={setPeriod} />}
        </OwnerLockGate>
      </div>
    </Layout>
  );
}

function Inner({ ownerPassword, period, setPeriod }) {
  const { user } = useAuth();
  const vendorId = user?.id || user?._id || "anon";
  const [lines, setLines] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const d = await gstAssistant(vendorId, ownerPassword);
        setLines(d?.lines || []);
        setData(d?.data || null);
      } catch {
        setPending(true);
        setData(null);
        // fallback static demo lines
        setLines([
          { type: "collected", text: "You collected ₹0 GST from customers." },
          { type: "paid", text: "You paid ₹0 GST while purchasing products." },
          { type: "payable", text: "Estimated GST payable is ₹0." },
          { type: "itc", text: "You may be eligible to claim Input Tax Credit on eligible purchases." },
          { type: "disclaimer", text: "Please verify these figures before filing your GST return." },
        ]);
      }
      setLoading(false);
    })();
  }, [ownerPassword, period, vendorId]);

  void pending;

  const downloadExcel = () => {
    const r = (p) => paiseToRupees(p || 0);
    const rows = [
      { Metric: "Period", Value: period },
      { Metric: "GST collected from customers (invoices)", Value: r(data?.collected_paise) },
      { Metric: "GST paid on purchases (Purchase Book)", Value: r(data?.paid_paise) },
      { Metric: "Estimated GST payable (collected − paid)", Value: r(data?.payable_paise) },
      { Metric: "Taxable sales (net of GST)", Value: r(data?.taxableSales_paise) },
      { Metric: "Net profit this month (after GST)", Value: r(data?.netProfit_paise) },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 44 }, { wch: 16 }];
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
          onClick={downloadExcel}
          disabled={!data}
          data-testid="gst-assistant-export"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold bg-[color:var(--sc-primary)] text-white disabled:opacity-50"
        >
          <Download size={14} /> Download Excel
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4" data-testid="gst-assistant-kpis">
          {[
            { k: "Collected (invoices)", v: data.collected_paise, c: "text-sky-700" },
            { k: "Paid (purchases)", v: data.paid_paise, c: "text-emerald-700" },
            { k: "Payable (est.)", v: data.payable_paise, c: "text-amber-700" },
            { k: "Net profit (month)", v: data.netProfit_paise, c: "text-[color:var(--sc-primary)]" },
          ].map((x) => (
            <div key={x.k} className="sc-card p-3">
              <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--sc-ink-muted)]">{x.k}</div>
              <div className={`text-xl font-extrabold ${x.c}`}>₹{paiseToRupees(x.v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            </div>
          ))}
        </div>
      )}


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
