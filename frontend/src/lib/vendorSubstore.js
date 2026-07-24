// Vendor Substore transfer ledger — client-side (localStorage) storage.
// A "substore" is either a secondary shop under the same GSTIN or a partner
// vendor exchanging stock. Transfers are logged with: from → to, product,
// serial/IMEI, qty, price, timestamp, transfer order id, initiator, acceptor.
//
// Persistence: `slangcart_vendor_substore_transfers` (per-browser localStorage).
// When the backend ships the corresponding endpoints (see spec), this module
// can be swapped for API calls without changing the callers.

const LS_TRANSFERS = "slangcart_vendor_substore_transfers";
const LS_SUBSTORES = "slangcart_vendor_substores";

/* -------------------------------------------------------------------------- */
/*  Substore directory                                                        */
/* -------------------------------------------------------------------------- */

/** Load the substore directory (list of substore emails + display names). */
export function loadSubstores(vendorId) {
  try {
    const raw = localStorage.getItem(`${LS_SUBSTORES}:${vendorId || "self"}`);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Save the substore directory (replace-all). */
export function saveSubstores(vendorId, substores) {
  try {
    localStorage.setItem(`${LS_SUBSTORES}:${vendorId || "self"}`, JSON.stringify(substores || []));
  } catch { /* quota */ }
}

/** Add a substore. Returns the updated list. */
export function addSubstore(vendorId, substore) {
  const list = loadSubstores(vendorId);
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
  saveSubstores(vendorId, next);
  return next;
}

/** Remove a substore by id. Returns the updated list. */
export function removeSubstore(vendorId, id) {
  const list = loadSubstores(vendorId).filter((s) => s.id !== id);
  saveSubstores(vendorId, list);
  return list;
}

/* -------------------------------------------------------------------------- */
/*  Transfer ledger                                                            */
/* -------------------------------------------------------------------------- */

/** Load all transfers for a given vendor (both outgoing + incoming). */
export function loadTransfers(vendorId) {
  try {
    const raw = localStorage.getItem(`${LS_TRANSFERS}:${vendorId || "self"}`);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveTransfers(vendorId, transfers) {
  try {
    localStorage.setItem(`${LS_TRANSFERS}:${vendorId || "self"}`, JSON.stringify(transfers));
  } catch { /* quota */ }
}

/** Next per-vendor sequential transfer order id. Format: `TRF-YYYYMMDD-####`. */
export function nextTransferOrderId(vendorId) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const existing = loadTransfers(vendorId)
    .filter((t) => (t.transfer_order_id || "").startsWith(`TRF-${today}`))
    .length;
  return `TRF-${today}-${String(existing + 1).padStart(4, "0")}`;
}

/**
 * Create a transfer record. Payload:
 *   from_email      (vendor's own email, required)
 *   to_substore_id  (substore.id from directory, required)
 *   to_email        (denormalised for display)
 *   to_name
 *   product_name    (required)
 *   sku             (optional)
 *   serial_number   (optional)
 *   imei            (optional)
 *   qty             (required, positive integer)
 *   unit_price      (rupees; the exchange price)
 *   note
 */
export function createTransfer(vendorId, payload) {
  if (!payload.product_name?.trim()) throw new Error("Product name is required.");
  const qty = Number(payload.qty);
  if (!qty || qty <= 0) throw new Error("Qty must be a positive number.");
  if (!payload.to_substore_id) throw new Error("Please pick a destination substore.");
  const record = {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    transfer_order_id: nextTransferOrderId(vendorId),
    created_at: new Date().toISOString(),
    status: "pending",             // pending | accepted | rejected | cancelled
    from_email: (payload.from_email || "").toLowerCase(),
    from_name: payload.from_name || "",
    to_substore_id: payload.to_substore_id,
    to_email: (payload.to_email || "").toLowerCase(),
    to_name: payload.to_name || "",
    product_name: payload.product_name.trim(),
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
  const next = [record, ...loadTransfers(vendorId)];
  saveTransfers(vendorId, next);
  return record;
}

/** Mark a transfer as accepted (destination substore confirmed receipt). */
export function acceptTransfer(vendorId, id, acceptorEmail) {
  const list = loadTransfers(vendorId).map((t) => (
    t.id === id
      ? { ...t, status: "accepted", accepted_at: new Date().toISOString(), accepted_by: (acceptorEmail || "").toLowerCase() }
      : t
  ));
  saveTransfers(vendorId, list);
  return list;
}

/** Mark a transfer as cancelled (by initiator). */
export function cancelTransfer(vendorId, id) {
  const list = loadTransfers(vendorId).map((t) => (
    t.id === id ? { ...t, status: "cancelled" } : t
  ));
  saveTransfers(vendorId, list);
  return list;
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
