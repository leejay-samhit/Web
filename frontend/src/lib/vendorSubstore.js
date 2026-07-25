// Vendor Substore transfer ledger — client-side (localStorage) storage.
// A "substore" is either a secondary shop under the same GSTIN or a partner
// vendor exchanging stock. Transfers are logged with: from → to, product,
// serial/IMEI, qty, price, timestamp, transfer order id, initiator, acceptor.
//
// Storage strategy (v2, 04-Jul-2026):
//   `slangcart_substore_ledger_global`   — SHARED ledger keyed by email.
//     Any logged-in vendor sees transfers where `from_email === me OR to_email === me`.
//     This lets Vendor A create a transfer and Vendor B see it on the same
//     device / browser without a backend.
//   `slangcart_substore_received:<email>` — accepted products the recipient
//     should surface in their "My shop" product list.
//   `slangcart_vendor_substores:<email>`  — per-vendor substore directory.
//
// True cross-device sync still requires the backend spec at
// BACKLOG_BACKEND_SPEC §10 — this refactor unblocks single-device demos.

const LS_LEDGER  = "slangcart_substore_ledger_global";
const LS_RECEIVED = "slangcart_substore_received";
const LS_SUBSTORES = "slangcart_vendor_substores";

/** Normalise the vendor identity we key everything on. Prefers email over id
 *  because email is the field a partner vendor knows when adding a substore. */
function keyOf(vendor) {
  if (!vendor) return "self";
  if (typeof vendor === "string") return vendor.trim().toLowerCase();
  return (vendor.email || vendor.id || "self").toString().trim().toLowerCase();
}

/* -------------------------------------------------------------------------- */
/*  Substore directory                                                        */
/* -------------------------------------------------------------------------- */

/** Load the substore directory (list of substore emails + display names). */
export function loadSubstores(vendor) {
  try {
    const raw = localStorage.getItem(`${LS_SUBSTORES}:${keyOf(vendor)}`);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Save the substore directory (replace-all). */
export function saveSubstores(vendor, substores) {
  try {
    localStorage.setItem(`${LS_SUBSTORES}:${keyOf(vendor)}`, JSON.stringify(substores || []));
  } catch { /* quota */ }
}

/** Add a substore. Returns the updated list. */
export function addSubstore(vendor, substore) {
  const list = loadSubstores(vendor);
  const clean = {
    id: substore.id || `ss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email: (substore.email || "").trim().toLowerCase(),
    name: (substore.name || "").trim() || substore.email || "Substore",
    gstin: (substore.gstin || "").trim(),
    phone: (substore.phone || "").trim(),
    note: (substore.note || "").trim(),
  };
  if (!clean.email) throw new Error("Substore email is required.");
  if (list.some((s) => s.email === clean.email)) throw new Error("A substore with this email already exists.");
  const next = [...list, clean];
  saveSubstores(vendor, next);
  return next;
}

/** Remove a substore by id. Returns the updated list. */
export function removeSubstore(vendor, id) {
  const list = loadSubstores(vendor).filter((s) => s.id !== id);
  saveSubstores(vendor, list);
  return list;
}

/* -------------------------------------------------------------------------- */
/*  Transfer ledger — GLOBAL, filtered by (from_email OR to_email) === me      */
/* -------------------------------------------------------------------------- */

function loadAllTransfers() {
  try {
    const raw = localStorage.getItem(LS_LEDGER);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveAllTransfers(list) {
  try { localStorage.setItem(LS_LEDGER, JSON.stringify(list)); } catch { /* quota */ }
}

/** Load transfers where the given vendor is either initiator OR destination. */
export function loadTransfers(vendor) {
  const me = keyOf(vendor);
  return loadAllTransfers().filter((t) => t.from_email === me || t.to_email === me);
}

/** Next per-vendor sequential transfer order id. Format: `TRF-YYYYMMDD-####`. */
export function nextTransferOrderId(vendor) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const existing = loadTransfers(vendor)
    .filter((t) => (t.transfer_order_id || "").startsWith(`TRF-${today}`))
    .length;
  return `TRF-${today}-${String(existing + 1).padStart(4, "0")}`;
}

/** Create a transfer record. */
export function createTransfer(vendor, payload) {
  if (!payload.product_name?.trim()) throw new Error("Product name is required.");
  const qty = Number(payload.qty);
  if (!qty || qty <= 0) throw new Error("Qty must be a positive number.");
  if (!payload.to_substore_id) throw new Error("Please pick a destination substore.");
  const record = {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    transfer_order_id: nextTransferOrderId(vendor),
    created_at: new Date().toISOString(),
    status: "pending",
    from_email: keyOf(vendor),
    from_name: payload.from_name || "",
    to_substore_id: payload.to_substore_id,
    to_email: (payload.to_email || "").toLowerCase(),
    to_name: payload.to_name || "",
    // Snapshot the product so the recipient sees a real entry even without a
    // shared products endpoint.
    product_id: payload.product_id || "",
    product_name: payload.product_name.trim(),
    image_url: payload.image_url || "",
    sku: payload.sku || "",
    serial_number: payload.serial_number || "",
    imei: payload.imei || "",
    qty,
    unit_price: Number(payload.unit_price) || 0,
    total_value: (Number(payload.unit_price) || 0) * qty,
    note: payload.note || "",
    accepted_at: null,
    accepted_by: "",
  };
  saveAllTransfers([record, ...loadAllTransfers()]);
  return record;
}

/** Mark a transfer as accepted. Must be called by the DESTINATION vendor. */
export function acceptTransfer(vendor, id) {
  const me = keyOf(vendor);
  const all = loadAllTransfers();
  const t = all.find((x) => x.id === id);
  if (!t) throw new Error("Transfer not found.");
  if (t.to_email !== me) throw new Error("Only the destination substore can accept this transfer.");
  const next = all.map((x) => x.id === id
    ? { ...x, status: "accepted", accepted_at: new Date().toISOString(), accepted_by: me }
    : x);
  saveAllTransfers(next);
  // Push the transferred product into the recipient's "received" cache so
  // VendorDashboard can surface it under Products.
  addReceivedProduct(me, t);
  return next.filter((x) => x.from_email === me || x.to_email === me);
}

/** Cancel a transfer (only initiator, only while pending). */
export function cancelTransfer(vendor, id) {
  const me = keyOf(vendor);
  const all = loadAllTransfers();
  const next = all.map((x) => x.id === id && x.from_email === me && x.status === "pending"
    ? { ...x, status: "cancelled" } : x);
  saveAllTransfers(next);
  return next.filter((x) => x.from_email === me || x.to_email === me);
}

/* -------------------------------------------------------------------------- */
/*  "Received products" — surfaced on the recipient's My Shop products list    */
/* -------------------------------------------------------------------------- */

export function loadReceivedProducts(vendor) {
  try {
    const raw = localStorage.getItem(`${LS_RECEIVED}:${keyOf(vendor)}`);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function addReceivedProduct(email, transfer) {
  try {
    const key = `${LS_RECEIVED}:${email}`;
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    list.unshift({
      id: `recv-${transfer.id}`,
      transfer_order_id: transfer.transfer_order_id,
      product_id: transfer.product_id,
      name: transfer.product_name,
      image_url: transfer.image_url,
      sku: transfer.sku,
      serial_number: transfer.serial_number,
      imei: transfer.imei,
      stock: transfer.qty,
      price: transfer.unit_price,
      source: "substore-transfer",
      from_email: transfer.from_email,
      from_name: transfer.from_name,
      accepted_at: transfer.accepted_at,
    });
    localStorage.setItem(key, JSON.stringify(list));
  } catch { /* quota */ }
}

/* -------------------------------------------------------------------------- */
/*  CSV export                                                                */
/* -------------------------------------------------------------------------- */

const CSV_HEADERS = [
  "Transfer Order ID", "Date", "Time", "Status",
  "Transferred By", "Accepted By",
  "Product Name", "SKU", "Serial Number", "IMEI", "Qty",
  "Unit Price", "Total Value",
  "From Email", "From Name", "To Email", "To Name", "Note",
];

function formatDate(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}
function formatTime(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  let h = d.getHours();
  const m = pad(d.getMinutes());
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${pad(h)}:${m} ${ampm}`;
}
function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function transfersToCsv(transfers) {
  const rows = [CSV_HEADERS.join(",")];
  for (const t of transfers) {
    rows.push([
      t.transfer_order_id, formatDate(t.created_at), formatTime(t.created_at), t.status,
      t.from_email, t.accepted_by || "",
      t.product_name, t.sku, t.serial_number, t.imei, t.qty,
      t.unit_price, t.total_value,
      t.from_email, t.from_name, t.to_email, t.to_name, t.note,
    ].map(csvEscape).join(","));
  }
  return rows.join("\n");
}

export function downloadTransfersCsv(transfers, shopName) {
  const csv = transfersToCsv(transfers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  const slug = (shopName || "shop").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "shop";
  a.href = URL.createObjectURL(blob);
  a.download = `slangcart-vendor-${slug}-transfers-${today}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* -------------------------------------------------------------------------- */
/*  Aggregates (KPI cards)                                                    */
/* -------------------------------------------------------------------------- */

export function transferSummary(transfers) {
  const out = { total: 0, pending: 0, accepted: 0, cancelled: 0, total_value: 0, qty: 0 };
  for (const t of transfers) {
    out.total += 1;
    out[t.status] = (out[t.status] || 0) + 1;
    out.total_value += Number(t.total_value) || 0;
    out.qty += Number(t.qty) || 0;
  }
  return out;
}
