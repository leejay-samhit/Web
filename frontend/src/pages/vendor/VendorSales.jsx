import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import apiLocal from "@/lib/apiLocal";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import { formatINR, formatDateTime } from "@/lib/utils";
import { listInvoices } from "@/lib/vendorSales";
import { log } from "@/lib/log";
import {
  TrendingUp, Receipt, IndianRupee, Banknote, CreditCard, Wallet as WalletIcon,
  Smartphone, Store, RefreshCw, ArrowUpRight, ChevronRight, X, CalendarDays, Search, Printer,
} from "lucide-react";

/* ============================================================
 *  Payment mode normalisation (POS + Online mirror + Upstream)
 *  Only these methods are surfaced (user decision, Feb-2026):
 *  CASH · UPI · DEBIT · CREDIT · WALLET
 * ============================================================ */
const PAY_KEYS = ["cash", "upi", "debit", "credit", "wallet"];
const PAY_META = {
  cash:   { label: "Cash",        icon: Banknote,   color: "#0F6E4F" },
  upi:    { label: "UPI",         icon: IndianRupee, color: "#0891B2" },
  debit:  { label: "Debit Card",  icon: CreditCard, color: "#7C3AED" },
  credit: { label: "Credit Card", icon: CreditCard, color: "#DB2777" },
  wallet: { label: "Wallet",      icon: WalletIcon, color: "#F59E0B" },
};

/** Normalise any raw mode/method string to one of PAY_KEYS or null. */
function normaliseMode(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s) return null;
  if (s.includes("cash") || s === "cod" || s.includes("cash_on_delivery")) return "cash";
  if (s.includes("upi") || s.includes("razor") || s.includes("gpay") || s.includes("phonepe") || s === "online" || s === "prepaid") return "upi";
  if (s.includes("debit")) return "debit";
  if (s.includes("credit_card") || s === "credit" || (s.includes("credit") && !s.includes("sale"))) return "credit";
  if (s.includes("wallet") || s.includes("paytm") || s.includes("net")) return "wallet";
  if (s.includes("card")) return "credit"; // generic card fallback
  return null;
}

const orderAmount = (o) =>
  Number(o?.amount ?? o?.total ?? o?.grand_total ?? o?.order_total ?? o?.totals?.grand_total ?? 0);
const orderCustomer = (o) =>
  o?.customer?.name || o?.customer_name || o?.user?.name || o?.buyer_name || "Walk-in / online";
const orderTime = (o) => o?.created_at || o?.placed_at || o?.updated_at || null;

/** Cancelled / refunded / returned orders must never count towards sales,
 *  payment breakdowns or accounts (user rule Aug-2026). */
const VOID_STATUSES = ["cancelled", "canceled", "refunded", "returned", "rejected", "failed", "void"];
const isVoided = (status) => VOID_STATUSES.includes(String(status || "").toLowerCase());

/** Build a unified Sale row from any source (POS invoice OR online order). */
function toSaleRow(src, source /* 'pos' | 'online' */) {
  if (source === "pos") {
    const inv = src;
    const modeCounts = {};
    (inv.payments || []).forEach((p) => {
      const k = normaliseMode(p.mode);
      if (k) modeCounts[k] = (modeCounts[k] || 0) + (Number(p.amount) || 0);
    });
    const primaryMode = Object.keys(modeCounts).sort((a, b) => modeCounts[b] - modeCounts[a])[0] || normaliseMode(inv.payments?.[0]?.mode) || "cash";
    return {
      id: inv.id,
      channel: "POS · Walk-in",
      channelKind: "pos",
      when: inv.created_at,
      customer: inv.customer?.name || "Walk-in",
      customer_phone: inv.customer?.phone || "",
      amount: inv.totals?.grand_total || 0,
      mode: primaryMode,
      status: inv.status || "completed",
      invoice_no: inv.invoice_no,
      raw: inv,
    };
  }
  // online (upstream or local mirror)
  const o = src;
  const mode = normaliseMode(o?.payment_method || o?.payment_mode || o?.mode || o?.gateway || o?.paymentType) || "upi";
  return {
    id: o.id || o._id || `${o.order_id}-${o.product_id}`,
    channel: o.source === "local" ? "Web (mirror)" : "Web / App",
    channelKind: "online",
    when: orderTime(o),
    customer: orderCustomer(o),
    customer_phone: o?.customer?.phone || o?.buyer_phone || "",
    amount: orderAmount(o),
    mode,
    status: o.status || o.payment_status || "placed",
    invoice_no: o.invoice_no || (o.id || "").toString().slice(0, 8),
    raw: o,
  };
}

/* Date predicates */
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const startOfMonth = (d = new Date()) => { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x; };
const endOfMonth = (d = new Date()) => { const x = new Date(d.getFullYear(), d.getMonth() + 1, 0); x.setHours(23,59,59,999); return x; };
const inRange = (row, from, to) => {
  const t = row.when ? new Date(row.when).getTime() : NaN;
  if (!Number.isFinite(t)) return false;
  return (!from || t >= from.getTime()) && (!to || t <= to.getTime());
};
const isoDate = (d) => new Date(d).toISOString().slice(0, 10);

/* ============================================================
 *  Header KPI card — clickable
 * ============================================================ */
function KpiTile({ icon: Icon, label, value, hint, onClick, testId, tone = "primary" }) {
  const tones = {
    primary: "from-emerald-50 to-white ring-emerald-200 text-emerald-800",
    amber: "from-amber-50 to-white ring-amber-200 text-amber-800",
    slate: "from-slate-50 to-white ring-slate-200 text-slate-700",
  };
  const iconBg = {
    primary: "bg-emerald-600 text-white",
    amber: "bg-amber-500 text-white",
    slate: "bg-slate-600 text-white",
  };
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`text-left sc-card p-4 bg-gradient-to-br ${tones[tone]} ring-1 hover:shadow-lg hover:-translate-y-0.5 transition group w-full`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-9 h-9 rounded-xl grid place-items-center shadow ${iconBg[tone]}`}>
          <Icon size={16} />
        </div>
        <div className="text-[10px] uppercase tracking-widest font-bold flex-1">{label}</div>
        <ChevronRight size={16} className="opacity-40 group-hover:opacity-90 group-hover:translate-x-0.5 transition" />
      </div>
      <div className="text-2xl font-extrabold text-[color:var(--sc-ink)] mt-2">{value}</div>
      {hint && <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-1">{hint}</div>}
      <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mt-2">Tap to view invoices →</div>
    </button>
  );
}

/* Payment-method tile — CASH / UPI / DEBIT / CREDIT / WALLET */
function PayTile({ k, amount, count, onClick }) {
  const meta = PAY_META[k];
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      data-testid={`vs-pay-${k}`}
      className="sc-card p-3 flex items-center gap-2 hover:border-[color:var(--sc-primary)] hover:shadow transition text-left w-full"
    >
      <div className="w-9 h-9 rounded-xl grid place-items-center text-white shadow" style={{ background: meta.color }}>
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-[color:var(--sc-ink-muted)] font-bold">{meta.label}</div>
        <div className="text-lg font-extrabold text-[color:var(--sc-ink)] truncate">{formatINR(amount)}</div>
        <div className="text-[10px] text-[color:var(--sc-ink-muted)]">{count} sale{count !== 1 ? "s" : ""}</div>
      </div>
    </button>
  );
}

/* ============================================================
 *  Drilldown modal — invoices in range (with search + filter)
 * ============================================================ */
function SalesDrilldown({ open, title, rows, from, to, onClose, onChangeRange, allowRangePicker = false, filterMode = null, onOpenReceipt }) {
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("all");
  const [mode, setMode] = useState(filterMode || "all");

  useEffect(() => { if (open) { setQ(""); setChannel("all"); setMode(filterMode || "all"); } }, [open, filterMode]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (channel !== "all" && r.channelKind !== channel) return false;
      if (mode !== "all" && r.mode !== mode) return false;
      if (!n) return true;
      const bag = [r.customer, r.customer_phone, r.invoice_no, r.id, r.channel, r.mode].filter(Boolean).join(" ").toLowerCase();
      return bag.includes(n);
    });
  }, [rows, q, channel, mode]);

  const totals = useMemo(() => {
    const t = { amount: 0, count: filtered.length, by_mode: {} };
    filtered.forEach((r) => {
      t.amount += r.amount;
      t.by_mode[r.mode] = (t.by_mode[r.mode] || 0) + r.amount;
    });
    return t;
  }, [filtered]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-5xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="vs-drilldown"
      >
        <div className="px-5 py-4 border-b border-[color:var(--sc-border)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary)] grid place-items-center">
            <Receipt size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-[color:var(--sc-ink)] truncate">{title}</div>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)]">
              {from && to && (<>{isoDate(from)} → {isoDate(to)} · </>)}
              Web + App + POS · {totals.count} invoices · <b>{formatINR(totals.amount)}</b>
            </div>
          </div>
          <button onClick={onClose} data-testid="vs-drilldown-close" className="w-9 h-9 rounded-lg text-[color:var(--sc-ink-muted)] hover:bg-[color:var(--sc-accent-light)] grid place-items-center">
            <X size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-[color:var(--sc-border)] flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 border border-[color:var(--sc-border)] rounded-lg px-2 py-1.5 flex-1 min-w-[220px]">
            <Search size={13} className="text-[color:var(--sc-ink-muted)]" />
            <input
              data-testid="vs-drilldown-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search customer, invoice, mode…"
              className="flex-1 text-sm bg-transparent outline-none"
            />
          </div>
          <select data-testid="vs-drilldown-channel" value={channel} onChange={(e) => setChannel(e.target.value)} className="sc-input !py-1.5 text-xs w-auto">
            <option value="all">All channels</option>
            <option value="pos">POS · Walk-in</option>
            <option value="online">Web / App</option>
          </select>
          <select data-testid="vs-drilldown-mode" value={mode} onChange={(e) => setMode(e.target.value)} className="sc-input !py-1.5 text-xs w-auto">
            <option value="all">All payments</option>
            {PAY_KEYS.map((k) => <option key={k} value={k}>{PAY_META[k].label}</option>)}
          </select>

          {allowRangePicker && (
            <div className="flex items-center gap-1.5 border border-[color:var(--sc-border)] rounded-lg px-2 py-1 text-xs">
              <CalendarDays size={13} className="text-[color:var(--sc-ink-muted)]" />
              <input
                type="date"
                value={from ? isoDate(from) : ""}
                onChange={(e) => onChangeRange({ from: e.target.value ? new Date(e.target.value + "T00:00:00") : null, to })}
                className="bg-transparent outline-none"
                data-testid="vs-drilldown-from"
              />
              <span className="text-[color:var(--sc-ink-muted)]">→</span>
              <input
                type="date"
                value={to ? isoDate(to) : ""}
                onChange={(e) => onChangeRange({ from, to: e.target.value ? new Date(e.target.value + "T23:59:59") : null })}
                className="bg-transparent outline-none"
                data-testid="vs-drilldown-to"
              />
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-[color:var(--sc-ink-muted)]" data-testid="vs-drilldown-empty">
              No sales for this filter. Try widening the range or clearing filters.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2">Invoice</th>
                  <th className="text-left px-4 py-2">When</th>
                  <th className="text-left px-4 py-2">Channel</th>
                  <th className="text-left px-4 py-2">Customer</th>
                  <th className="text-left px-4 py-2">Payment</th>
                  <th className="text-right px-4 py-2">Amount</th>
                  <th className="text-right px-4 py-2">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const meta = PAY_META[r.mode];
                  return (
                    <tr key={r.id} className="border-t border-[color:var(--sc-border)] hover:bg-[color:var(--sc-accent-light)]/30" data-testid={`vs-row-${r.id}`}>
                      <td className="px-4 py-2 font-mono">{r.invoice_no || r.id?.toString().slice(0, 8)}</td>
                      <td className="px-4 py-2 text-[color:var(--sc-ink-muted)]">{formatDateTime(r.when)}</td>
                      <td className="px-4 py-2">
                        <span className="sc-chip">{r.channel}</span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-semibold">{r.customer || "—"}</div>
                        {r.customer_phone && <div className="text-[10px] text-[color:var(--sc-ink-muted)]">{r.customer_phone}</div>}
                      </td>
                      <td className="px-4 py-2">
                        {meta ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: meta.color + "18", color: meta.color }}>
                            <meta.icon size={11} /> {meta.label}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-extrabold">{formatINR(r.amount)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => onOpenReceipt(r)}
                          data-testid={`vs-receipt-${r.id}`}
                          title="Print receipt"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--sc-primary)] hover:underline"
                        >
                          <Printer size={11} /> Print
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer summary */}
        <div className="px-5 py-3 border-t border-[color:var(--sc-border)] flex flex-wrap items-center gap-3 justify-between bg-[color:var(--sc-bg)]">
          <div className="text-[11px] text-[color:var(--sc-ink-muted)] font-semibold">
            {PAY_KEYS.filter((k) => totals.by_mode[k]).map((k) => (
              <span key={k} className="mr-3">
                {PAY_META[k].label}: <b style={{ color: PAY_META[k].color }}>{formatINR(totals.by_mode[k])}</b>
              </span>
            ))}
          </div>
          <div className="text-sm font-extrabold text-[color:var(--sc-primary)]">
            Total · {formatINR(totals.amount)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 *  Print a POS-style thermal receipt for any row
 * ============================================================ */
function openReceipt(row) {
  const items = Array.isArray(row?.raw?.items) ? row.raw.items : [];
  const itemsRows = items.map((it) => {
    const name = it.product_name || it.name || "Item";
    const qty = Number(it.qty || 1);
    const price = Number(it.price || 0);
    const line = Number(it.line_total ?? qty * price);
    return `<tr><td style="padding:4px 0;">${name}</td><td style="text-align:right;padding:4px 0;">${qty}</td><td style="text-align:right;padding:4px 0;">${formatINR(price)}</td><td style="text-align:right;padding:4px 0;font-weight:600;">${formatINR(line)}</td></tr>`;
  }).join("");
  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Receipt · ${row.invoice_no || row.id}</title>
<style>
  body{font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif;color:#0F172A;margin:0;padding:24px;max-width:520px;}
  .brand{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
  .logo{width:40px;height:40px;border-radius:10px;background:#0F6E4F;color:#fff;font-weight:800;display:grid;place-items:center;font-size:18px;}
  h1{font-size:16px;margin:14px 0 4px;}
  .muted{color:#64748B;font-size:11px;}
  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #E2E8F0;font-size:12px;}
  .row:last-child{border-bottom:0;}
  .k{color:#64748B;}
  .v{font-weight:600;}
  table.items{width:100%;font-size:12px;border-collapse:collapse;margin-top:10px;}
  table.items thead{background:#F1F5F9;color:#334155;text-transform:uppercase;font-size:10px;}
  table.items th{padding:6px 8px;text-align:right;}
  table.items th:first-child{text-align:left;}
  table.items td{padding:6px 8px;border-bottom:1px dashed #E2E8F0;}
  .amt{font-size:22px;font-weight:800;color:#0F6E4F;margin-top:8px;text-align:right;border-top:2px solid #0F6E4F;padding-top:6px;}
  .chip{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:#E8F4ED;color:#0F6E4F;letter-spacing:.05em;text-transform:uppercase;}
  @media print { body { padding: 8px; } .noprint { display:none; } }
</style></head><body>
  <div class="brand"><div class="logo">S</div><div><b>Slangcart</b><div class="muted">Shop · Service · Connect</div></div></div>
  <h1>Sales receipt</h1>
  <div class="muted">${formatDateTime(row.when) || ""}</div>
  <div style="margin-top:10px;"><div class="chip">${(row.channel || "").toUpperCase()}</div></div>
  <div style="margin-top:12px;">
    <div class="row"><span class="k">Invoice</span><span class="v">${row.invoice_no || row.id}</span></div>
    <div class="row"><span class="k">Customer</span><span class="v">${row.customer || "Walk-in"}</span></div>
    ${row.customer_phone ? `<div class="row"><span class="k">Phone</span><span class="v">${row.customer_phone}</span></div>` : ""}
    <div class="row"><span class="k">Payment</span><span class="v">${(PAY_META[row.mode]?.label) || row.mode || "—"}</span></div>
    <div class="row"><span class="k">Status</span><span class="v">${row.status || "posted"}</span></div>
  </div>
  ${items.length ? `
    <table class="items">
      <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
  ` : `<div class="muted" style="margin-top:14px;text-align:center;">No item breakdown available for this ${row.channel || "sale"}.</div>`}
  <div class="amt">${formatINR(row.amount).replace(/[^\d.,₹\-\+ ]/g, "")}</div>
  <div class="muted" style="margin-top:14px;text-align:center;">Thank you for your business — Slangcart</div>
  <div class="noprint" style="text-align:center;margin-top:16px;">
    <button onclick="window.print()" style="background:#0F6E4F;color:#fff;border:0;border-radius:8px;padding:8px 18px;font-weight:700;cursor:pointer;">Print</button>
  </div>
  <script>window.onload=()=>setTimeout(()=>window.print(),200);</script>
</body></html>`;
  const w = window.open("", "_blank", "noopener,noreferrer,width=580,height=820");
  if (!w) { alert("Please allow pop-ups to print the receipt."); return; }
  w.document.write(html);
  w.document.close();
}

/* ============================================================
 *  Main page
 * ============================================================ */
export default function VendorSales() {
  const { user } = useAuth();
  const uid = user?.id;
  const nav = useNavigate();

  // POS invoices (localStorage-backed for now)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    const id = setInterval(onFocus, 30000);
    return () => { window.removeEventListener("focus", onFocus); clearInterval(id); };
  }, []);
  const posInvoices = useMemo(() => listInvoices(uid).filter((i) => i.status === "completed"), [uid, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Online sales (upstream) + local mirror
  const [onlineRows, setOnlineRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(null);
  const [error, setError] = useState("");

  const loadOnline = useCallback(async () => {
    setLoading(true); setError("");
    const combined = [];
    const seen = new Set();
    const pushAll = (arr, source) => {
      arr.forEach((o) => {
        const key = o.id || o._id || o.order_id;
        if (!key || seen.has(key)) return;
        seen.add(key);
        combined.push({ ...o, source });
      });
    };
    try {
      const { data } = await api.get("/vendor/me/sales");
      pushAll(Array.isArray(data) ? data : data?.items || data?.sales || [], "upstream");
    } catch (e) {
      log.error("VendorSales.loadOnline upstream", e);
    }
    try {
      const { data } = await apiLocal.get("/vendor/me/orders");
      pushAll(Array.isArray(data?.items) ? data.items : [], "local");
    } catch { /* local backend may be offline */ }
    setOnlineRows(combined);
    setLoading(false);
    setLastSynced(new Date());
  }, []);

  useEffect(() => { loadOnline(); }, [loadOnline]);
  // 30s auto-sync so web + app stay unified
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && loadOnline(), 30000);
    const onVis = () => document.visibilityState === "visible" && loadOnline();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [loadOnline]);

  /* Unify all sales into one list of rows (excluding voided orders) */
  const allSales = useMemo(() => {
    const rows = [];
    posInvoices.forEach((inv) => rows.push(toSaleRow(inv, "pos")));
    onlineRows.forEach((o) => rows.push(toSaleRow(o, "online")));
    // Sort newest first
    rows.sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));
    // Drop cancelled / refunded / returned — they must not inflate sales,
    // payment tiles or accounts.
    return rows.filter((r) => !isVoided(r.status));
  }, [posInvoices, onlineRows]);

  /* Range aggregates */
  const now = new Date();
  const todayFrom = startOfDay(now);
  const todayTo = endOfDay(now);
  const monthFrom = startOfMonth(now);
  const monthTo = endOfMonth(now);

  const todayRows = useMemo(() => allSales.filter((r) => inRange(r, todayFrom, todayTo)), [allSales, todayFrom, todayTo]);
  const monthRows = useMemo(() => allSales.filter((r) => inRange(r, monthFrom, monthTo)), [allSales, monthFrom, monthTo]);

  const todayTotal = todayRows.reduce((s, r) => s + r.amount, 0);
  const monthTotal = monthRows.reduce((s, r) => s + r.amount, 0);

  /* Payment method breakdown (today by default) */
  const [payScope, setPayScope] = useState("today"); // 'today' | 'month' | 'all'
  const payRows = payScope === "today" ? todayRows : payScope === "month" ? monthRows : allSales;
  const payTotals = useMemo(() => {
    const out = {};
    PAY_KEYS.forEach((k) => { out[k] = { amount: 0, count: 0 }; });
    payRows.forEach((r) => {
      if (out[r.mode]) { out[r.mode].amount += r.amount; out[r.mode].count += 1; }
    });
    return out;
  }, [payRows]);

  /* Drilldown state */
  const [drill, setDrill] = useState(null); // { title, rows, from, to, allowRangePicker, filterMode }
  const [customRange, setCustomRange] = useState({ from: monthFrom, to: monthTo });

  const openToday = () => setDrill({
    title: "Today's Sales · Offline + Online",
    rows: todayRows,
    from: todayFrom,
    to: todayTo,
    allowRangePicker: false,
  });
  const openMonth = () => {
    setCustomRange({ from: monthFrom, to: monthTo });
    setDrill({
      title: "This Month's Sales · Offline + Online",
      rows: monthRows,
      from: monthFrom,
      to: monthTo,
      allowRangePicker: true,
    });
  };
  const openMode = (k) => setDrill({
    title: `${PAY_META[k].label} Sales · ${payScope === "today" ? "Today" : payScope === "month" ? "This Month" : "All time"}`,
    rows: payRows.filter((r) => r.mode === k),
    from: payScope === "today" ? todayFrom : payScope === "month" ? monthFrom : null,
    to: payScope === "today" ? todayTo : payScope === "month" ? monthTo : null,
    allowRangePicker: false,
    filterMode: k,
  });

  // For the month drilldown, use the custom range once user tweaks it
  const drillRows = useMemo(() => {
    if (!drill) return [];
    if (drill.allowRangePicker) {
      return allSales.filter((r) => inRange(r, customRange.from, customRange.to));
    }
    return drill.rows;
  }, [drill, customRange, allSales]);

  return (
    <Layout title="Vendor · Sales dashboard">
      <VendorNav />

      {/* Header row: sync indicator + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="text-sm font-extrabold uppercase tracking-wider text-[color:var(--sc-ink-muted)] flex items-center gap-2">
            <Smartphone size={14} /> Sales · Offline · Walk-in · Web · App
          </div>
          <div className="text-[11px] text-[color:var(--sc-ink-muted)] flex items-center gap-1.5 mt-0.5" data-testid="vs-last-synced">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {lastSynced ? <>Auto-sync every 30s · last {lastSynced.toLocaleTimeString()}</> : "Syncing web + app…"}
          </div>
        </div>
        <button onClick={loadOnline} disabled={loading} data-testid="vs-refresh" className="sc-btn-outline inline-flex items-center gap-1.5 text-xs">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> {loading ? "Syncing…" : "Sync now"}
        </button>
      </div>

      {error && <div className="sc-card p-3 mb-3 text-xs text-[color:var(--sc-error)]" data-testid="vs-error">{error}</div>}

      {/* KPI tiles: Today Sales · This Month Sales · Lifetime */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4" data-testid="vs-kpis">
        <KpiTile
          testId="kpi-today-sales"
          icon={TrendingUp}
          label="Today's Sales"
          value={formatINR(todayTotal)}
          hint={`${todayRows.length} invoices · web + app + POS`}
          onClick={openToday}
        />
        <KpiTile
          testId="kpi-month-sales"
          icon={ArrowUpRight}
          label="This Month Sales"
          value={formatINR(monthTotal)}
          hint={`${monthRows.length} invoices · date-range enabled`}
          onClick={openMonth}
          tone="amber"
        />
        <KpiTile
          testId="kpi-lifetime-sales"
          icon={Store}
          label="Lifetime Sales"
          value={formatINR(allSales.reduce((s, r) => s + r.amount, 0))}
          hint={`${allSales.length} invoices · everything`}
          onClick={() => setDrill({ title: "All Sales · Offline + Online", rows: allSales, from: null, to: null, allowRangePicker: false })}
          tone="slate"
        />
      </div>

      {/* Payment method tiles — CASH · UPI · DEBIT · CREDIT · WALLET only, real data */}
      <div className="flex items-center gap-2 mb-2">
        <div className="text-sm font-extrabold uppercase tracking-wider text-[color:var(--sc-ink-muted)]">Payments</div>
        <div className="inline-flex rounded-full border border-[color:var(--sc-border)] overflow-hidden text-[10px] font-bold" data-testid="vs-pay-scope">
          {[
            { k: "today", label: "Today" },
            { k: "month", label: "Month" },
            { k: "all", label: "All time" },
          ].map((s) => (
            <button
              key={s.k}
              onClick={() => setPayScope(s.k)}
              data-testid={`vs-pay-scope-${s.k}`}
              className={`px-3 py-1 ${payScope === s.k ? "bg-[color:var(--sc-primary)] text-white" : "bg-white text-[color:var(--sc-ink)]"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6" data-testid="vs-payments">
        {PAY_KEYS.map((k) => (
          <PayTile
            key={k}
            k={k}
            amount={payTotals[k].amount}
            count={payTotals[k].count}
            onClick={() => openMode(k)}
          />
        ))}
      </div>

      {/* Quick POS action */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => nav("/vendor/pos")} className="sc-btn-primary inline-flex items-center gap-1.5 text-sm" data-testid="vs-start-sale">
          <Receipt size={14} /> Start new sale (POS)
        </button>
        <button onClick={() => nav("/vendor/invoices")} className="sc-btn-outline inline-flex items-center gap-1.5 text-sm" data-testid="vs-all-invoices">
          <Receipt size={14} /> All invoices
        </button>
      </div>

      {/* Recent unified sales table (last 10) */}
      <div className="sc-card p-0 overflow-hidden" data-testid="vs-recent">
        <div className="px-4 py-2 border-b border-[color:var(--sc-border)] font-extrabold text-sm flex items-center justify-between">
          <span>Recent sales (web · app · POS)</span>
          <span className="text-[11px] text-[color:var(--sc-ink-muted)]">{allSales.length} total</span>
        </div>
        {allSales.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[color:var(--sc-ink-muted)]">No sales yet. Ring one up in POS or wait for a web/app order.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr>
                <th className="text-left px-3 py-2">Invoice</th>
                <th className="text-left px-3 py-2">Channel</th>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-left px-3 py-2">Payment</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-left px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {allSales.slice(0, 10).map((r) => {
                const meta = PAY_META[r.mode];
                return (
                  <tr key={r.id} className="border-t border-[color:var(--sc-border)] hover:bg-[color:var(--sc-accent-light)]/20 cursor-pointer" onClick={() => openReceipt(r)} data-testid={`vs-recent-${r.id}`}>
                    <td className="px-3 py-2 font-mono">{r.invoice_no || r.id?.toString().slice(0, 8)}</td>
                    <td className="px-3 py-2"><span className="sc-chip">{r.channel}</span></td>
                    <td className="px-3 py-2">{r.customer || "—"}</td>
                    <td className="px-3 py-2">
                      {meta ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: meta.color + "18", color: meta.color }}>
                          <meta.icon size={11} /> {meta.label}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-extrabold">{formatINR(r.amount)}</td>
                    <td className="px-3 py-2 text-[color:var(--sc-ink-muted)]">{formatDateTime(r.when)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <SalesDrilldown
        open={!!drill}
        title={drill?.title}
        rows={drillRows}
        from={drill?.allowRangePicker ? customRange.from : drill?.from}
        to={drill?.allowRangePicker ? customRange.to : drill?.to}
        allowRangePicker={!!drill?.allowRangePicker}
        filterMode={drill?.filterMode}
        onChangeRange={(next) => setCustomRange({ from: next.from ?? customRange.from, to: next.to ?? customRange.to })}
        onClose={() => setDrill(null)}
        onOpenReceipt={openReceipt}
      />
    </Layout>
  );
}
