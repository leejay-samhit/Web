import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import api from "@/lib/api";
import apiLocal from "@/lib/apiLocal";
import { listInvoices, cancelInvoice, refundInvoice, toCSV, getSettings, POS_PAYMENT_MODES } from "@/lib/vendorSales";
import { printInvoice } from "@/lib/invoicePrint";
import { formatINR, formatDateTime } from "@/lib/utils";
import { Search, Printer, RotateCcw, X, Download, Eye, RefreshCw } from "lucide-react";

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

  // Fetch online shop orders (upstream + local mirror) and normalise to the
  // invoice row shape so POS + web + app all appear in ONE list — user
  // decision Feb-2026.
  const [online, setOnline] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const loadOnline = useCallback(async () => {
    setSyncing(true);
    const merged = [];
    const seen = new Set();
    const push = (arr, source) => {
      arr.forEach((o) => {
        const key = o.id || o._id || o.order_id;
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push({ ...o, _source: source });
      });
    };
    try {
      const { data } = await api.get("/vendor/me/sales");
      push(Array.isArray(data) ? data : (data?.items || data?.sales || []), "upstream");
    } catch { /* ignore */ }
    try {
      const { data } = await apiLocal.get("/vendor/me/orders");
      push(Array.isArray(data?.items) ? data.items : [], "local");
    } catch { /* ignore */ }
    // Convert to invoice-like rows
    const rows = merged.map((o) => ({
      id: o.id || o._id || o.order_id,
      invoice_no: o.invoice_no || `WEB-${(o.id || "").toString().slice(0, 8).toUpperCase()}`,
      created_at: o.created_at || o.placed_at || o.updated_at || null,
      customer: {
        name: o.customer?.name || o.customer_name || o.user?.name || "Online buyer",
        phone: o.customer?.phone || o.buyer_phone || "",
        address: [o.shipping_address?.line1, o.shipping_address?.city, o.shipping_address?.pincode].filter(Boolean).join(", "),
        gstin: o.customer?.gstin || "",
      },
      items: Array.isArray(o.items) ? o.items.map((it) => ({
        name: it.product_name || it.name || "Item", qty: it.qty || 1,
        price: it.price || 0, gst_pct: it.gst || it.gst_pct || 0,
        line_total: (it.price || 0) * (it.qty || 1),
      })) : [],
      payments: [{ mode: (String(o.payment_method || o.mode || "").toLowerCase().includes("cod") ? "cash" : "upi"), mode_label: (String(o.payment_method || o.mode || "").toLowerCase().includes("cod") ? "Cash" : "UPI"), amount: Number(o.amount || o.total || o.grand_total || 0) }],
      totals: {
        subtotal: Number(o.subtotal ?? o.amount ?? o.total ?? 0),
        gst_total: Number(o.gst_total ?? 0),
        discount_total: Number(o.discount ?? 0),
        grand_total: Number(o.amount ?? o.total ?? o.grand_total ?? 0),
      },
      status: o.status === "delivered" ? "completed" : (o.status || "placed"),
      _channel: o._source === "local" ? "Web / App" : "Web / App",
      _readonly: true, // no cancel/refund from POS panel
    }));
    setOnline(rows);
    setSyncing(false);
  }, []);
  useEffect(() => { loadOnline(); }, [loadOnline]);
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && loadOnline(), 30000);
    return () => clearInterval(t);
  }, [loadOnline]);

  // `bump` is an intentional manual re-render trigger after local-storage
  // writes — eslint can't see the side-effect, so silence the false positive.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const posInvoices = useMemo(() => listInvoices(uid).map((i) => ({ ...i, _channel: "POS · Walk-in" })), [uid, bump]);
  const all = useMemo(() => {
    // Sort by created_at desc (POS + web/app unified)
    const merged = [...posInvoices, ...online];
    merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return merged;
  }, [posInvoices, online]);
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
    // Business rule (04-Jul-2026): CSV must include CGST/SGST split + customer
    // GSTIN + Order Number/Date/Time so vendors can reconcile GSTR-1 filings.
    const half = (v) => Math.round(((Number(v) || 0) / 2) * 100) / 100;
    const rows = filtered.map((i, idx) => {
      const gstTotal = Number(i.totals?.gst_total || 0);
      const d = new Date(i.created_at);
      const pad = (n) => String(n).padStart(2, "0");
      const dateStr = Number.isNaN(d.getTime()) ? "" : `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
      let timeStr = "";
      if (!Number.isNaN(d.getTime())) {
        let h = d.getHours();
        const m = pad(d.getMinutes());
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        timeStr = `${pad(h)}:${m} ${ampm}`;
      }
      return {
        "Order Number": idx + 1, // per-vendor sequential
        "Invoice No": i.invoice_no,
        "Date": dateStr,
        "Time": timeStr,
        "Customer": i.customer?.name || "Walk-in",
        "Phone": i.customer?.phone || "",
        "Customer GSTIN": i.customer?.gstin || "",
        "Items": i.items?.length || 0,
        "Subtotal": i.totals?.subtotal || 0,
        "CGST": half(gstTotal),
        "SGST": half(gstTotal),
        "GST Total": gstTotal,
        "Discount": i.totals?.discount_total || 0,
        "Grand Total": i.totals?.grand_total || 0,
        "Payment Mode": (i.payments || []).map((p) => p.mode_label || p.mode).join("|"),
        "Payment Detail": (i.payments || []).map((p) => `${p.mode}:${p.amount}`).join("|"),
        "Status": i.status,
      };
    });
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
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
          {POS_PAYMENT_MODES.filter((m) => m.key !== "netbank" && m.key !== "credit_sale").map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <input type="date" data-testid="vi-from" value={from} onChange={(e) => setFrom(e.target.value)} className="sc-input text-xs" />
        <input type="date" data-testid="vi-to" value={to} onChange={(e) => setTo(e.target.value)} className="sc-input text-xs" />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" data-testid="vi-min" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} placeholder="Min ₹" className="sc-input text-xs" />
          <input type="number" data-testid="vi-max" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} placeholder="Max ₹" className="sc-input text-xs" />
        </div>
      </div>

      <div className="flex justify-between items-center mb-2 text-xs">
        <div className="text-[color:var(--sc-ink-muted)]" data-testid="vi-count">{filtered.length} of {all.length} invoices (POS + Web + App)</div>
        <div className="flex items-center gap-2">
          <button data-testid="vi-sync" onClick={loadOnline} disabled={syncing} className="sc-btn-outline inline-flex items-center gap-1 text-xs disabled:opacity-60">
            <RefreshCw size={12} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing…" : "Sync web+app"}
          </button>
          <button data-testid="vi-export" onClick={exportCsv} className="sc-btn-outline inline-flex items-center gap-1 text-xs"><Download size={12} /> Export CSV</button>
        </div>
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
