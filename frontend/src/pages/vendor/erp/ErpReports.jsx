import { useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import { runReport, exportReport } from "@/lib/erp";
import { toast } from "sonner";
import { FileBarChart, FileText, Download, RefreshCw } from "lucide-react";

const KINDS = [
  { code: "purchase", label: "Purchase report" },
  { code: "sales",    label: "Sales report" },
  { code: "profit",   label: "Profit report" },
  { code: "gst",      label: "GST report" },
  { code: "inventory",label: "Inventory report" },
  { code: "supplier", label: "Supplier report" },
  { code: "customer", label: "Customer report" },
  { code: "category", label: "Category report" },
  { code: "product",  label: "Product report" },
  { code: "payment",  label: "Payment report" },
];

const RANGES = [
  { code: "today",     label: "Today" },
  { code: "week",      label: "Last 7 days" },
  { code: "month",     label: "This month" },
  { code: "lastMonth", label: "Last month" },
  { code: "year",      label: "Financial year" },
  { code: "custom",    label: "Custom" },
];

function rangeToDates(code) {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const first = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  switch (code) {
    case "today":     return { from: iso(today), to: iso(today) };
    case "week":      { const d = new Date(today); d.setDate(d.getDate() - 6); return { from: iso(d), to: iso(today) }; }
    case "month":     return { from: iso(first(today)), to: iso(today) };
    case "lastMonth": { const d = first(today); d.setMonth(d.getMonth() - 1); const e = new Date(d.getFullYear(), d.getMonth() + 1, 0); return { from: iso(d), to: iso(e) }; }
    case "year":      { const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1; return { from: `${y}-04-01`, to: iso(today) }; }
    default:          return null;
  }
}

export default function ErpReports() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6" data-testid="erp-reports">
        <VendorNav />
        <ErpNav />
        <OwnerLockGate title="Reports — Owner verification required">
          {(pwd) => <Inner ownerPassword={pwd} />}
        </OwnerLockGate>
      </div>
    </Layout>
  );
}

function Inner({ ownerPassword }) {
  const [kind, setKind] = useState("sales");
  const [range, setRange] = useState("month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  const resolvedRange = range === "custom" ? custom : rangeToDates(range);

  const generate = async () => {
    setLoading(true);
    setPending(false);
    try {
      const d = await runReport(kind, resolvedRange, ownerPassword);
      setRows(Array.isArray(d) ? d : d?.rows || []);
    } catch {
      setPending(true);
      setRows([]);
    }
    setLoading(false);
  };

  const doExport = async (format) => {
    try {
      const d = await exportReport(kind, { ...resolvedRange, format }, ownerPassword);
      if (d?.url) {
        window.open(d.url, "_blank");
      } else {
        toast.info("Export queued — you'll get a download link soon.");
      }
    } catch {
      toast.error("Export unavailable until backend ships.");
    }
  };

  return (
    <>

      <div className="sc-card p-4 mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs font-semibold">Report</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm" data-testid="report-kind">
              {KINDS.map((k) => <option key={k.code} value={k.code}>{k.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold">Range</span>
            <select value={range} onChange={(e) => setRange(e.target.value)} className="w-full rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm" data-testid="report-range">
              {RANGES.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </label>
          {range === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm" />
              <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={generate} disabled={loading} className="rounded-full px-4 py-2 bg-[color:var(--sc-primary)] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50" data-testid="report-generate">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {loading ? "Generating…" : "Generate"}
          </button>
          <button onClick={() => doExport("pdf")} className="rounded-full px-4 py-2 text-sm border border-[color:var(--sc-border)] inline-flex items-center gap-1.5" data-testid="report-export-pdf"><FileText size={14} /> PDF</button>
          <button onClick={() => doExport("excel")} className="rounded-full px-4 py-2 text-sm border border-[color:var(--sc-border)] inline-flex items-center gap-1.5" data-testid="report-export-excel"><Download size={14} /> Excel</button>
          <button onClick={() => doExport("csv")} className="rounded-full px-4 py-2 text-sm border border-[color:var(--sc-border)] inline-flex items-center gap-1.5" data-testid="report-export-csv"><Download size={14} /> CSV</button>
          <button onClick={() => window.print()} className="rounded-full px-4 py-2 text-sm border border-[color:var(--sc-border)] inline-flex items-center gap-1.5"><FileText size={14} /> Print</button>
        </div>
      </div>

      <div className="sc-card p-4">
        <div className="text-sm font-extrabold mb-2 inline-flex items-center gap-1.5"><FileBarChart size={14} /> Results</div>
        {rows.length === 0 ? (
          <div className="text-sm text-[color:var(--sc-ink-muted)]" data-testid="report-empty">Select filters and hit generate to see rows.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--sc-accent-light)]/40 text-[11px] uppercase text-[color:var(--sc-ink-muted)]">
                <tr>{Object.keys(rows[0] || {}).map((k) => <th key={k} className="text-left px-3 py-2">{k}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-[color:var(--sc-border)]">
                    {Object.values(r).map((v, j) => <td key={j} className="px-3 py-2">{String(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
