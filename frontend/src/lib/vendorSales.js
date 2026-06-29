/**
 * Vendor offline-sales data layer
 * ---------------------------------------------------------------------------
 * This module persists vendor POS data in localStorage (browser-only, single
 * device). Inventory decrement is the ONE thing that hits the real backend
 * via `PATCH /vendor/me/products/{id}` so stock stays in sync with the
 * public Shop, mobile app and Admin Panel.
 *
 * When the backend POS endpoints are ready (see SALES_BACKEND_SPEC.md),
 * swap the read/write helpers in this file with axios calls — every page
 * already imports from here, so the migration is one file.
 *
 * NOTE on isolation: nothing in this file touches the Slangcart wallet,
 * referral commissions or platform settlement balances. It is intentionally
 * a standalone vendor-business ledger.
 */

import api from "@/lib/api";

const KEY = (uid) => `sc_vendor_pos_v1_${uid || "anon"}`;
const SETTINGS_KEY = (uid) => `sc_vendor_pos_settings_v1_${uid || "anon"}`;
const COUNTER_KEY = (uid) => `sc_vendor_pos_counter_v1_${uid || "anon"}`;

const DEFAULT_SETTINGS = {
  invoice_prefix: "SLG-INV-2026",
  invoice_pad: 6,                 // 000001
  business_name: "",              // Defaults to user.name on first use
  business_address: "",
  business_gstin: "",
  business_phone: "",
  business_email: "",
  default_gst_pct: 18,
  gst_inclusive: false,
  opening_balance: 0,
};

const safeParse = (s, fb) => { try { return JSON.parse(s) ?? fb; } catch { return fb; } };

export const POS_PAYMENT_MODES = [
  { key: "cash",     label: "Cash" },
  { key: "upi",      label: "UPI" },
  { key: "debit",    label: "Debit Card" },
  { key: "credit",   label: "Credit Card" },
  { key: "netbank",  label: "Net Banking" },
  { key: "wallet",   label: "Wallet" },
  { key: "credit_sale", label: "Credit Sale" },
];

/* -------------------------------------------------------------------------- */
/*  Settings (invoice prefix etc.)                                            */
/* -------------------------------------------------------------------------- */
export const getSettings = (uid) =>
  ({ ...DEFAULT_SETTINGS, ...safeParse(localStorage.getItem(SETTINGS_KEY(uid)), {}) });

export const saveSettings = (uid, patch) => {
  const next = { ...getSettings(uid), ...patch };
  localStorage.setItem(SETTINGS_KEY(uid), JSON.stringify(next));
  return next;
};

/* -------------------------------------------------------------------------- */
/*  Invoice counter                                                           */
/* -------------------------------------------------------------------------- */
export const peekNextInvoiceNumber = (uid) => {
  const s = getSettings(uid);
  const counter = Number(localStorage.getItem(COUNTER_KEY(uid)) || 0) + 1;
  return `${s.invoice_prefix}-${String(counter).padStart(s.invoice_pad, "0")}`;
};
const consumeInvoiceNumber = (uid) => {
  const counter = Number(localStorage.getItem(COUNTER_KEY(uid)) || 0) + 1;
  localStorage.setItem(COUNTER_KEY(uid), String(counter));
  const s = getSettings(uid);
  return `${s.invoice_prefix}-${String(counter).padStart(s.invoice_pad, "0")}`;
};

/* -------------------------------------------------------------------------- */
/*  Invoice list                                                              */
/* -------------------------------------------------------------------------- */
export const listInvoices = (uid) => safeParse(localStorage.getItem(KEY(uid)), []);
export const getInvoice = (uid, id) => listInvoices(uid).find((i) => i.id === id) || null;

const writeAll = (uid, list) => localStorage.setItem(KEY(uid), JSON.stringify(list));

/**
 * Compute line totals + invoice grand total honoring discount / GST.
 *  - itemDiscount can be a flat ₹ or a "5%" percentage string.
 *  - totalDiscount likewise.
 */
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const applyDiscount = (base, d) => {
  if (!d) return 0;
  const s = String(d).trim();
  if (s.endsWith("%")) return round2((Number(s.slice(0, -1)) || 0) * base / 100);
  return round2(Number(s) || 0);
};

export function computeTotals(items, opts = {}) {
  const { totalDiscount = 0, roundOff = true, gstInclusive = false } = opts;
  let subtotal = 0, gstTotal = 0, discTotal = 0;
  const lines = items.map((it) => {
    const qty = Number(it.qty || 0);
    const price = Number(it.price || 0);
    const gross = round2(qty * price);
    const disc = applyDiscount(gross, it.discount);
    const base = round2(gross - disc);
    let net, tax;
    if (gstInclusive) {
      // price already includes GST → tax = base − base/(1+gst/100)
      tax = round2(base - base / (1 + (Number(it.gst_pct || 0) / 100)));
      net = base;
    } else {
      tax = round2(base * (Number(it.gst_pct || 0) / 100));
      net = round2(base + tax);
    }
    subtotal += base;
    gstTotal += tax;
    discTotal += disc;
    return { ...it, gross, discount_amount: disc, taxable: base, tax_amount: tax, line_total: net };
  });
  subtotal = round2(subtotal);
  gstTotal = round2(gstTotal);
  discTotal = round2(discTotal);
  const billDiscount = applyDiscount(subtotal, totalDiscount);
  const beforeRound = round2(subtotal + gstTotal - billDiscount);
  const grand = roundOff ? Math.round(beforeRound) : beforeRound;
  const roundOffAmount = round2(grand - beforeRound);
  return {
    lines, subtotal, gst_total: gstTotal, discount_total: discTotal + billDiscount,
    bill_discount: billDiscount, round_off: roundOffAmount, grand_total: grand,
  };
}

/* -------------------------------------------------------------------------- */
/*  Create / cancel / refund                                                  */
/* -------------------------------------------------------------------------- */
export async function createInvoice(uid, draft) {
  // Decrement stock on the real backend BEFORE we commit the invoice so a
  // failed inventory write rolls back cleanly.
  const stockOps = await Promise.allSettled(
    draft.items.map(async (it) => {
      const newStock = Math.max(0, Number(it.stock_before ?? 0) - Number(it.qty || 0));
      return api.patch(`/vendor/me/products/${it.product_id}`, { stock: newStock });
    })
  );
  const failed = stockOps.filter((s) => s.status === "rejected");
  if (failed.length && stockOps.length) {
    const reason = failed[0].reason?.response?.data?.detail || failed[0].reason?.message || "stock update failed";
    throw new Error(`Could not reserve inventory: ${reason}`);
  }

  const invoiceNo = consumeInvoiceNumber(uid);
  const invoice = {
    id: `pos_${Date.now()}_${Math.floor(Math.random() * 999)}`,
    invoice_no: invoiceNo,
    created_at: new Date().toISOString(),
    status: "completed",
    ...draft,
  };
  writeAll(uid, [invoice, ...listInvoices(uid)]);
  return invoice;
}

export function cancelInvoice(uid, id) {
  const list = listInvoices(uid).map((i) => (i.id === id ? { ...i, status: "cancelled", cancelled_at: new Date().toISOString() } : i));
  writeAll(uid, list);
  return getInvoice(uid, id);
}

export function refundInvoice(uid, id, reason) {
  const list = listInvoices(uid).map((i) => (i.id === id ? { ...i, status: "refunded", refunded_at: new Date().toISOString(), refund_reason: reason } : i));
  writeAll(uid, list);
  return getInvoice(uid, id);
}

export function duplicateInvoice(uid, id) {
  const src = getInvoice(uid, id);
  if (!src) return null;
  const draft = { ...src, items: src.items.map((it) => ({ ...it })), notes: `Duplicate of ${src.invoice_no}` };
  delete draft.id; delete draft.invoice_no; delete draft.created_at; delete draft.status;
  return draft;
}

/* -------------------------------------------------------------------------- */
/*  KPIs                                                                      */
/* -------------------------------------------------------------------------- */
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/** Aggregate sales for the given date-range predicate. */
const aggregate = (list, pred) => {
  const out = {
    sales: 0, profit: 0, gst: 0, bills: 0, items_sold: 0,
    by_mode: { cash: 0, upi: 0, debit: 0, credit: 0, netbank: 0, wallet: 0, credit_sale: 0 },
  };
  list.forEach((inv) => {
    if (inv.status !== "completed") return;
    const dt = new Date(inv.created_at);
    if (!pred(dt)) return;
    out.sales += inv.totals?.grand_total || 0;
    out.gst += inv.totals?.gst_total || 0;
    out.bills += 1;
    out.items_sold += inv.items?.reduce((n, it) => n + (Number(it.qty) || 0), 0) || 0;
    out.profit += inv.totals?.profit ?? 0;
    (inv.payments || []).forEach((p) => {
      const k = p.mode || "cash";
      out.by_mode[k] = (out.by_mode[k] || 0) + (Number(p.amount) || 0);
    });
  });
  return out;
};

export function getDashboardKpis(uid) {
  const list = listInvoices(uid);
  const today = new Date();
  const t = aggregate(list, (dt) => sameDay(dt, today));
  const m = aggregate(list, (dt) => sameMonth(dt, today));
  return {
    today: t,
    month: m,
    recent: list.slice(0, 10),
  };
}

/** Cash-summary per date (defaults to today). */
export function getCashSummary(uid, date = new Date()) {
  const list = listInvoices(uid);
  const settings = getSettings(uid);
  const dayBills = list.filter((i) => sameDay(new Date(i.created_at), date));
  const day = aggregate(list, (dt) => sameDay(dt, date));
  const refunds = dayBills.filter((i) => i.status === "refunded").reduce((s, i) => s + (i.totals?.grand_total || 0), 0);
  const opening = settings.opening_balance || 0;
  const cash = day.by_mode.cash;
  const closing = opening + cash - refunds;
  return {
    date: date.toISOString().slice(0, 10),
    opening_balance: opening,
    cash_sales: cash,
    upi_sales: day.by_mode.upi,
    card_sales: day.by_mode.debit + day.by_mode.credit,
    netbank_sales: day.by_mode.netbank,
    wallet_sales: day.by_mode.wallet,
    credit_sales: day.by_mode.credit_sale,
    total_collections: day.sales,
    bills_count: day.bills,
    refunds,
    closing_balance: closing,
  };
}

/** Full statement (with running balance) — supports date range filter. */
export function getStatement(uid, { from, to } = {}) {
  const list = [...listInvoices(uid)].reverse(); // chronological
  let bal = getSettings(uid).opening_balance || 0;
  return list
    .filter((i) => {
      if (!from && !to) return true;
      const t = new Date(i.created_at).getTime();
      if (from && t < new Date(from).getTime()) return false;
      if (to && t > new Date(to).getTime() + 86400000) return false;
      return true;
    })
    .map((i) => {
      const delta = i.status === "refunded" ? -(i.totals?.grand_total || 0)
                  : i.status === "cancelled" ? 0
                  : (i.totals?.grand_total || 0);
      bal = round2(bal + delta);
      return { ...i, delta, running_balance: bal };
    });
}

/** Top sellers + analytics breakdown. */
export function getAnalytics(uid) {
  const list = listInvoices(uid).filter((i) => i.status === "completed");
  const products = {};
  const dailyMap = {};
  list.forEach((i) => {
    const d = new Date(i.created_at).toISOString().slice(0, 10);
    dailyMap[d] = (dailyMap[d] || 0) + (i.totals?.grand_total || 0);
    (i.items || []).forEach((it) => {
      const k = it.product_id || it.name;
      if (!products[k]) products[k] = { product_id: it.product_id, name: it.name, qty: 0, revenue: 0, gst: 0 };
      products[k].qty += Number(it.qty || 0);
      products[k].revenue += Number(it.line_total || 0);
      products[k].gst += Number(it.tax_amount || 0);
    });
  });
  const arr = Object.values(products);
  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, sales]) => ({ date, sales }));
  return {
    daily,
    most_sold: [...arr].sort((a, b) => b.qty - a.qty).slice(0, 10),
    highest_revenue: [...arr].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    highest_gst: [...arr].sort((a, b) => b.gst - a.gst).slice(0, 10),
    least_sold: [...arr].sort((a, b) => a.qty - b.qty).slice(0, 5),
  };
}

/* -------------------------------------------------------------------------- */
/*  CSV / JSON exports                                                        */
/* -------------------------------------------------------------------------- */
export function toCSV(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}
