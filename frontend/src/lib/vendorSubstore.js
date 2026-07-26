// Vendor Substore transfer ledger — backed by the local Emergent backend
// (`/api/vendor/me/transfers`) which persists to MongoDB and delegates
// identity to network-pay-1 via /auth/me.  Two vendors on two devices now
// see each other's transfers in real time.
//
// Spec: /app/memory/SUBSTORE_TRANSFER_SPEC.md
//
// The per-vendor substore DIRECTORY (list of known partner emails) stays
// in localStorage — it's a personal contact list, not shared data.

import apiLocal from "@/lib/apiLocal";

/* -------------------------------------------------------------------------- */
/*  Vendor identity helper                                                    */
/* -------------------------------------------------------------------------- */

function keyOf(vendor) {
  if (!vendor) return "self";
  if (typeof vendor === "string") return vendor.trim().toLowerCase();
  return (vendor.email || vendor.id || "self").toString().trim().toLowerCase();
}

/* -------------------------------------------------------------------------- */
/*  Substore directory  (server-persisted contact list, per vendor)           */
/* -------------------------------------------------------------------------- */

const LS_SUBSTORES = "slangcart_vendor_substores";  // local cache for offline / snappy first paint

function _cacheLoad(vendor) {
  try {
    const raw = localStorage.getItem(`${LS_SUBSTORES}:${keyOf(vendor)}`);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function _cacheSave(vendor, list) {
  try { localStorage.setItem(`${LS_SUBSTORES}:${keyOf(vendor)}`, JSON.stringify(list || [])); } catch { /* quota */ }
}

/** Synchronous initial render — reads the local cache. Pair with an async
 *  fetchSubstores() call in useEffect for the authoritative server list. */
export function loadSubstores(vendor) {
  return _cacheLoad(vendor);
}

/** Fetch the authoritative substore directory from the backend. */
export async function fetchSubstores(vendor) {
  try {
    const { data } = await apiLocal.get("/vendor/me/substores");
    const list = Array.isArray(data?.items) ? data.items : [];
    _cacheSave(vendor, list);
    return list;
  } catch {
    return _cacheLoad(vendor);
  }
}

export function saveSubstores(vendor, substores) {
  // Kept for callers doing local reordering; the server is still the source
  // of truth. This just refreshes the offline cache.
  _cacheSave(vendor, substores);
}

export async function addSubstore(vendor, substore) {
  const body = {
    email: (substore.email || "").trim().toLowerCase(),
    name: (substore.name || "").trim() || substore.email || "Substore",
    gstin: (substore.gstin || "").trim(),
    phone: (substore.phone || "").trim(),
    note: (substore.note || "").trim(),
  };
  if (!body.email) throw new Error("Substore email is required.");
  try {
    const { data } = await apiLocal.post("/vendor/me/substores", body);
    const list = [..._cacheLoad(vendor).filter((s) => s.id !== data.id), data];
    _cacheSave(vendor, list);
    return list;
  } catch (e) {
    const detail = e?.response?.data?.detail;
    if (detail === "substore_already_exists") throw new Error("A substore with this email already exists.");
    if (detail === "cannot_add_self_as_substore") throw new Error("You can't add yourself as a substore.");
    if (detail === "substore_email_required") throw new Error("Substore email is required.");
    throw new Error(detail || "Could not add substore.");
  }
}

export async function removeSubstore(vendor, id) {
  try {
    await apiLocal.delete(`/vendor/me/substores/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e?.response?.status !== 404) throw new Error(e?.response?.data?.detail || "Could not remove substore.");
  }
  const list = _cacheLoad(vendor).filter((s) => s.id !== id);
  _cacheSave(vendor, list);
  return list;
}

/* -------------------------------------------------------------------------- */
/*  SSE subscription — realtime push of transfer.* events                     */
/* -------------------------------------------------------------------------- */

/**
 * Open an EventSource against /api/vendor/me/transfers/stream and pipe each
 * event to `onEvent({type, transfer, transfer_id, event})`. Returns a
 * teardown function.
 *
 * Because EventSource can't set custom headers (no Authorization), we pass
 * the token as a query string. The backend still verifies via the same
 * network-pay-1 /auth/me delegation.
 */
export function subscribeTransfers(token, onEvent) {
  if (typeof window === "undefined" || !window.EventSource || !token) {
    return () => {};
  }
  const base = process.env.REACT_APP_BACKEND_URL;
  const url = `${base}/api/vendor/me/transfers/stream?access_token=${encodeURIComponent(token)}`;
  let es;
  try {
    es = new EventSource(url, { withCredentials: false });
  } catch {
    return () => {};
  }
  const parse = (raw) => { try { return JSON.parse(raw); } catch { return null; } };
  es.addEventListener("transfer", (e) => {
    const evt = parse(e.data);
    if (evt) onEvent(evt);
  });
  es.addEventListener("hello", () => { /* connection established */ });
  es.onerror = () => { /* browser auto-reconnects on transient errors */ };
  return () => { try { es.close(); } catch { /* noop */ } };
}

/* -------------------------------------------------------------------------- */
/*  Transfer ledger — persisted server-side, filtered by from/to email        */
/* -------------------------------------------------------------------------- */

// Retained for callers that still import it (e.g. optimistic UI). The real
// order id is assigned by the backend and returned in the create response.
export function nextTransferOrderId(/* vendor */) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `TRF-${today}-pending`;
}

/** Fetch every transfer where the caller is sender OR receiver. */
export async function loadTransfers(/* vendor */) {
  try {
    const { data } = await apiLocal.get("/vendor/me/transfers");
    return Array.isArray(data?.items) ? data.items : [];
  } catch (e) {
    // Return an empty list on failure so the UI can render the empty state
    // rather than crashing. Errors are surfaced via toast in the page.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("loadTransfers failed", e);
    }
    return [];
  }
}

/** Create a new transfer. Returns the server-persisted record. */
export async function createTransfer(vendor, payload) {
  if (!payload.product_name?.trim()) throw new Error("Product name is required.");
  const qty = Number(payload.qty);
  if (!qty || qty <= 0) throw new Error("Qty must be a positive number.");
  if (!payload.to_email) throw new Error("Please pick a destination substore.");

  const body = {
    to_email: (payload.to_email || "").trim().toLowerCase(),
    to_name: payload.to_name || "",
    product_id: payload.product_id || null,
    product_name: payload.product_name.trim(),
    image_url: payload.image_url || "",
    sku: payload.sku || "",
    serial_number: payload.serial_number || "",
    imei: payload.imei || "",
    qty,
    unit_price: Number(payload.unit_price) || 0,
    note: payload.note || "",
  };

  try {
    const { data } = await apiLocal.post("/vendor/me/transfers", body);
    return data;
  } catch (e) {
    const detail = e?.response?.data?.detail;
    if (detail === "cannot_transfer_to_self") throw new Error("You can't transfer to your own account.");
    if (e?.response?.status === 401) throw new Error("Please sign in again to send transfers.");
    throw new Error(detail || "Could not create the transfer. Try again in a moment.");
  }
}

/** Mark a transfer as accepted. Caller must be the destination vendor. */
export async function acceptTransfer(vendor, id) {
  try {
    await apiLocal.post(`/vendor/me/transfers/${encodeURIComponent(id)}/accept`);
  } catch (e) {
    const detail = e?.response?.data?.detail;
    if (detail === "only_recipient_can_accept") throw new Error("Only the destination substore can accept this transfer.");
    if (detail?.startsWith("transfer_already_")) throw new Error(`This transfer is already ${detail.replace("transfer_already_", "")}.`);
    throw new Error(detail || "Accept failed. Please retry.");
  }
  return loadTransfers(vendor);
}

/** Cancel a transfer. Caller must be the sender and status must be pending. */
export async function cancelTransfer(vendor, id) {
  try {
    await apiLocal.post(`/vendor/me/transfers/${encodeURIComponent(id)}/cancel`);
  } catch (e) {
    const detail = e?.response?.data?.detail;
    if (detail === "only_sender_can_cancel") throw new Error("Only the sender can cancel this transfer.");
    if (detail?.startsWith("transfer_already_")) throw new Error(`This transfer is already ${detail.replace("transfer_already_", "")}.`);
    throw new Error(detail || "Cancel failed. Please retry.");
  }
  return loadTransfers(vendor);
}

/** Reject a transfer. Caller must be the recipient and status must be pending. */
export async function rejectTransfer(vendor, id) {
  try {
    await apiLocal.post(`/vendor/me/transfers/${encodeURIComponent(id)}/reject`);
  } catch (e) {
    const detail = e?.response?.data?.detail;
    if (detail === "only_recipient_can_reject") throw new Error("Only the destination substore can reject this transfer.");
    if (detail?.startsWith("transfer_already_")) throw new Error(`This transfer is already ${detail.replace("transfer_already_", "")}.`);
    throw new Error(detail || "Reject failed. Please retry.");
  }
  return loadTransfers(vendor);
}

/* -------------------------------------------------------------------------- */
/*  "Received products" — accepted transfers where I am the destination       */
/* -------------------------------------------------------------------------- */

export async function loadReceivedProducts(vendor) {
  const me = keyOf(vendor);
  const all = await loadTransfers(vendor);
  return all
    .filter((t) => t.status === "accepted" && (t.to_email || "").toLowerCase() === me)
    .map((t) => ({
      id: `recv-${t.id}`,
      transfer_order_id: t.transfer_order_id,
      product_id: t.product_id,
      name: t.product_name,
      image_url: t.image_url,
      sku: t.sku,
      serial_number: t.serial_number,
      imei: t.imei,
      stock: t.qty,
      price: t.unit_price,
      source: "substore-transfer",
      from_email: t.from_email,
      from_name: t.from_name,
      accepted_at: t.accepted_at,
    }));
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
  const out = { total: 0, pending: 0, accepted: 0, cancelled: 0, rejected: 0, total_value: 0, qty: 0 };
  for (const t of transfers) {
    out.total += 1;
    out[t.status] = (out[t.status] || 0) + 1;
    out.total_value += Number(t.total_value) || 0;
    out.qty += Number(t.qty) || 0;
  }
  return out;
}
