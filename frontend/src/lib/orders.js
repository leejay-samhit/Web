// Shared order-management helpers used by Admin (read-only) and Vendor (edit).
// Consolidates: stage catalogue, status chip styling, stage-advance transitions,
// and Excel export with a fixed column contract.
//
// Excel columns (per product spec 04-Jul-2026):
//   User Name · User Mobile · Product Name · Product Amount · Order Stage
//   · Vendor Name · Vendor Email · Vendor Mobile

import * as XLSX from "xlsx";

/* -------------------------------------------------------------------------- */
/*  Order stage catalogue                                                     */
/* -------------------------------------------------------------------------- */

/** Ordered list of allowed order stages — matches the backend's `status` field. */
export const ORDER_STAGES = [
  { key: "placed",            label: "Placed",          tone: "amber",   final: false },
  { key: "confirmed",         label: "Confirmed",       tone: "sky",     final: false },
  { key: "paid",              label: "Paid",            tone: "sky",     final: false },
  { key: "processing",        label: "Processing",      tone: "indigo",  final: false },
  { key: "packed",            label: "Packed",          tone: "indigo",  final: false },
  { key: "shipped",           label: "Shipped",         tone: "violet",  final: false },
  { key: "out_for_delivery",  label: "Out for delivery", tone: "violet", final: false },
  { key: "delivered",         label: "Delivered",       tone: "green",   final: true  },
  { key: "cancelled",         label: "Cancelled",       tone: "red",     final: true  },
  { key: "returned",          label: "Returned",        tone: "red",     final: true  },
];

const STAGE_INDEX = Object.fromEntries(ORDER_STAGES.map((s, i) => [s.key, i]));

/** Tailwind classes for the status chip, keyed by tone. */
const TONE_CLS = {
  amber:  "bg-amber-50 text-amber-700 border-amber-200",
  sky:    "bg-sky-50 text-sky-700 border-sky-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  red:    "bg-rose-50 text-rose-700 border-rose-200",
  gray:   "bg-slate-100 text-slate-700 border-slate-200",
};

export function stageMeta(key) {
  return ORDER_STAGES.find((s) => s.key === key) || { key, label: key || "unknown", tone: "gray", final: false };
}

export function stageChipClass(key) {
  const t = stageMeta(key).tone;
  return "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold capitalize " + (TONE_CLS[t] || TONE_CLS.gray);
}

/** Given the current stage, what stages can it advance to? Excludes final states. */
export function nextStages(currentKey) {
  const idx = STAGE_INDEX[currentKey] ?? -1;
  const cur = stageMeta(currentKey);
  if (cur.final) return [];
  // Non-final stages can advance to any following non-final OR to the two
  // final states (delivered/cancelled/returned) directly.
  return ORDER_STAGES.filter((s, i) => i > idx || s.final);
}

/* -------------------------------------------------------------------------- */
/*  Order-row shape helpers                                                   */
/* -------------------------------------------------------------------------- */

/** Extract the human-readable customer name from an order object. */
export const orderCustomerName = (o) =>
  o?.user_name || o?.customer_name || o?.shipping_address?.name || o?.user?.name || "";
export const orderCustomerPhone = (o) =>
  o?.user_phone || o?.customer_phone || o?.shipping_address?.phone || o?.user?.phone || o?.phone || "";
export const orderAmount = (o) =>
  Number(o?.total ?? o?.amount ?? o?.grand_total ?? o?.order_total ?? o?.totals?.grand_total ?? 0);
export const orderVendorName = (o) =>
  o?.vendor_name || o?.shop_name || o?.vendor?.shop_name || o?.vendor?.name || "";
export const orderVendorEmail = (o) =>
  o?.vendor_email || o?.vendor?.email || o?.vendor?.user_email || "";
export const orderVendorMobile = (o) =>
  o?.vendor_phone || o?.vendor_mobile || o?.vendor?.phone || o?.vendor?.mobile || "";
export const orderProductName = (o) => {
  const items = Array.isArray(o?.items) ? o.items : [];
  if (items.length === 0) return o?.product_name || "";
  if (items.length === 1) return items[0]?.product_name || items[0]?.name || "";
  return items
    .map((it) => `${it.product_name || it.name || "Product"}${it.qty ? ` × ${it.qty}` : ""}`)
    .join("; ");
};

/* -------------------------------------------------------------------------- */
/*  Excel export                                                              */
/* -------------------------------------------------------------------------- */

/** Build the fixed 8-column data rows from the given orders array. */
export function ordersToExcelRows(orders) {
  return (orders || []).map((o) => ({
    "User Name":       orderCustomerName(o),
    "User Mobile":     orderCustomerPhone(o),
    "Product Name":    orderProductName(o),
    "Product Amount":  orderAmount(o),
    "Order Stage":     stageMeta(o?.status).label,
    "Vendor Name":     orderVendorName(o),
    "Vendor Email":    orderVendorEmail(o),
    "Vendor Mobile":   orderVendorMobile(o),
  }));
}

/** Write and download an .xlsx file containing the order rows. Returns the filename. */
export function exportOrdersToExcel(orders, { role = "admin", shopName = "" } = {}) {
  const rows = ordersToExcelRows(orders);
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      "User Name", "User Mobile", "Product Name", "Product Amount",
      "Order Stage", "Vendor Name", "Vendor Email", "Vendor Mobile",
    ],
  });
  // Column widths (rough character counts).
  ws["!cols"] = [
    { wch: 22 }, { wch: 15 }, { wch: 32 }, { wch: 14 },
    { wch: 16 }, { wch: 22 }, { wch: 26 }, { wch: 15 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  const today = new Date().toISOString().slice(0, 10);
  const shopSlug = (shopName || "shop")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "shop";
  const filename = role === "vendor"
    ? `slangcart-vendor-${shopSlug}-orders-${today}.xlsx`
    : `slangcart-admin-orders-${today}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}
