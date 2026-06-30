import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import { listInvoices, cancelInvoice, refundInvoice, toCSV, getSettings, POS_PAYMENT_MODES } from "@/lib/vendorSales";
import { printInvoice } from "@/lib/invoicePrint";
import { formatINR, formatDateTime } from "@/lib/utils";
import { Search, Printer, RotateCcw, X, Download, Eye } from "lucide-react";

export default function VendorInvoices() {
  const { user } = useAuth();
  const uid = user?.id;
  const settings = useMemo(() => getSettings(uid), [uid]);
  const [bump, setBump] = useState(0);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");
  const [view, setView] = useState(null);

  // `bump` is an intentional manual re-render trigger after local-storage
  // writes — eslint can't see the side-effect, so silence the false positive.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => listInvoices(uid), [uid, bump]);
  const filtered = useMemo(() => {
    return all.filter((i) => {
      if (q) {
        const t = q.toLowerCase();
        const hay = `${i.invoice_no} ${i.customer?.name || ""} ${i.customer?.phone || ""}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      if (mode && !(i.payments || []).some((p) => p.mode === mode)) return false;
      if (from && new Date(i.created_at).getTime() < new Date(from).getTime()) return false;
      if (to && new Date(i.created_at).getTime() > new Date(to).getTime() + 86400000) return false;
      const amt = i.totals?.grand_total || 0;
      if (minAmt && amt < Number(minAmt)) return false;
      if (maxAmt && amt > Number(maxAmt)) return false;
      return true;
    });
  }, [all, q, mode, from, to, minAmt, maxAmt]);

  const handleCancel = (id) => { if (window.confirm("Cancel this invoice?")) { cancelInvoice(uid, id); setBump((b) => b + 1); } };
  const handleRefund = (id) => { const reason = window.prompt("Refund reason"); if (reason !== null) { refundInvoice(uid, id, reason); setBump((b) => b + 1); } };
  const exportCsv = () => {
    const rows = filtered.map((i) => ({
      invoice_no: i.invoice_no, date: i.created_at, customer: i.customer?.name || "Walk-in",
      phone: i.customer?.phone || "", items: i.items?.length || 0, subtotal: i.totals?.subtotal || 0,
      gst: i.totals?.gst_total || 0, total: i.totals?.grand_total || 0, payment: (i.payments || []).map((p) => `${p.mode}:${p.amount}`).join("|"),
      status: i.status,
    }));
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "invoices.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  useEffect(() => { /* re-render driver */ }, [bump]);

  return (
    <Layout title="Vendor · Invoices">
      <VendorNav />
      <div className="sc-card p-3 mb-3 grid sm:grid-cols-3 lg:grid-cols-6 gap-2" data-testid="vi-filters">
        <div className="sm:col-span-2 flex items-center gap-1.5 border border-[color:var(--sc-border)] rounded-lg px-2">
          <Search size={14} className="text-[color:var(--sc-ink-muted)]" />
          <input data-testid="vi-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Invoice # / customer" className="flex-1 bg-transparent outline-none text-xs py-2" />
        </div>
        <select data-testid="vi-mode" value={mode} onChange={(e) => setMode(e.target.value)} className="sc-input text-xs">
          <option value="">All payments</option>
          {POS_PAYMENT_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <input type="date" data-testid="vi-from" value={from} onChange={(e) => setFrom(e.target.value)} className="sc-input text-xs" />
        <input type="date" data-testid="vi-to" value={to} onChange={(e) => setTo(e.target.value)} className="sc-input text-xs" />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" data-testid="vi-min" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} placeholder="Min ₹" className="sc-input text-xs" />
          <input type="number" data-testid="vi-max" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} placeholder="Max ₹" className="sc-input text-xs" />
        </div>
      </div>

      <div className="flex justify-between items-center mb-2 text-xs">
        <div className="text-[color:var(--sc-ink-muted)]" data-testid="vi-count">{filtered.length} of {all.length} invoices</div>
        <button data-testid="vi-export" onClick={exportCsv} className="sc-btn-outline inline-flex items-center gap-1 text-xs"><Download size={12} /> Export CSV</button>
      </div>

      <div className="sc-card p-0 overflow-x-auto" data-testid="vi-list">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--sc-ink-muted)]">No invoices.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Invoice #</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-left px-3 py-2">Payment</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-left px-3 py-2">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-t border-[color:var(--sc-border)]" data-testid={`vi-row-${i.id}`}>
                  <td className="px-3 py-2 font-mono">{i.invoice_no}</td>
                  <td className="px-3 py-2 text-[color:var(--sc-ink-muted)]">{formatDateTime(i.created_at)}</td>
                  <td className="px-3 py-2">{i.customer?.name || "Walk-in"}</td>
                  <td className="px-3 py-2">{(i.payments || []).map((p) => p.mode_label || p.mode).join(", ")}</td>
                  <td className="px-3 py-2 text-right font-extrabold">{formatINR(i.totals?.grand_total)}</td>
                  <td className="px-3 py-2">
                    <span className="sc-chip capitalize" style={i.status === "completed" ? { background: "#E7F6EC", color: "#0F6E4F" } : i.status === "cancelled" ? { background: "#FDECEC", color: "#B42318" } : { background: "#FBEDE2", color: "#A0522D" }}>{i.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <button data-testid={`vi-view-${i.id}`} onClick={() => setView(i)} className="text-[color:var(--sc-primary)]"><Eye size={14} /></button>
                      <button data-testid={`vi-print-${i.id}`} onClick={() => printInvoice(i, settings)} className="text-[color:var(--sc-ink-muted)]"><Printer size={14} /></button>
                      {i.status === "completed" && (
                        <>
                          <button data-testid={`vi-refund-${i.id}`} onClick={() => handleRefund(i.id)} title="Refund" className="text-orange-600"><RotateCcw size={14} /></button>
                          <button data-testid={`vi-cancel-${i.id}`} onClick={() => handleCancel(i.id)} title="Cancel" className="text-[color:var(--sc-error)]"><X size={14} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invoice detail modal */}
      {view && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="vi-detail">
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-3 border-b border-[color:var(--sc-border)] z-10">
              <div className="font-extrabold">{view.invoice_no}</div>
              <button onClick={() => setView(null)}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between text-xs text-[color:var(--sc-ink-muted)]"><span>{formatDateTime(view.created_at)}</span><span className="capitalize">{view.status}</span></div>
              <div><b>Customer:</b> {view.customer?.name || "Walk-in"} {view.customer?.phone ? `· ${view.customer.phone}` : ""}</div>
              <table className="w-full text-xs border-t border-[color:var(--sc-border)] mt-2">
                <thead className="text-[color:var(--sc-ink-muted)]"><tr><th className="text-left py-1">Item</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">GST</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {view.items?.map((it, idx) => (
                    <tr key={idx} className="border-t border-[color:var(--sc-border)]">
                      <td className="py-1">{it.name}</td>
                      <td className="text-right">{it.qty}</td>
                      <td className="text-right">{formatINR(it.price)}</td>
                      <td className="text-right">{formatINR(it.tax_amount)}</td>
                      <td className="text-right font-bold">{formatINR(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-[color:var(--sc-border)] pt-2 text-xs space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(view.totals?.subtotal)}</span></div>
                <div className="flex justify-between"><span>GST</span><span>{formatINR(view.totals?.gst_total)}</span></div>
                {!!view.totals?.discount_total && <div className="flex justify-between"><span>Discount</span><span>-{formatINR(view.totals.discount_total)}</span></div>}
                {!!view.totals?.round_off && <div className="flex justify-between"><span>Round off</span><span>{formatINR(view.totals.round_off)}</span></div>}
                <div className="flex justify-between font-extrabold text-sm border-t border-[color:var(--sc-border)] pt-1"><span>Grand total</span><span>{formatINR(view.totals?.grand_total)}</span></div>
              </div>
              <div className="text-xs"><b>Payments:</b> {(view.payments || []).map((p) => `${p.mode_label || p.mode} ${formatINR(p.amount)}`).join(", ")}</div>
              <button onClick={() => printInvoice(view, settings)} className="sc-btn-primary w-full mt-2 inline-flex items-center justify-center gap-1.5"><Printer size={14} /> Print / save PDF</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
