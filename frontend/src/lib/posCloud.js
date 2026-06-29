/**
 * Vendor POS — cloud API client
 * ---------------------------------------------------------------------------
 * This module implements the 14 endpoints documented in
 * `/app/memory/SALES_BACKEND_SPEC.md`. Every function is a thin axios
 * wrapper that returns the response body.
 *
 * The endpoints DO NOT exist yet on `network-pay-1` — they will after the
 * backend dev applies the spec. Until then, `probeCloud()` returns false
 * and the frontend keeps using its localStorage fallback (see
 * `src/lib/vendorSales.js`).
 *
 * One probe per browser tab is cached so we don't spam 404s.
 */
import api from "@/lib/api";

let _probe = null;   // null = unknown, true = available, false = unavailable
let _probeAt = 0;
const PROBE_TTL = 60_000; // re-probe after 1 minute

/** Returns true if the cloud POS endpoints are live on this backend. */
export async function probeCloud(force = false) {
  const now = Date.now();
  if (!force && _probe !== null && (now - _probeAt) < PROBE_TTL) return _probe;
  try {
    await api.get("/vendor/me/pos/settings");
    _probe = true;
  } catch (e) {
    const code = e?.response?.status;
    // Anything other than a 404 (= route not mounted) means the endpoint
    // exists but failed for some other reason — treat as available so the
    // caller can surface the real error.
    _probe = code !== undefined && code !== 404;
  }
  _probeAt = now;
  return _probe;
}

export function cachedCloudState() { return _probe; }
export function resetCloudProbe() { _probe = null; _probeAt = 0; }

/* -------------------------------------------------------------------------- */
/*  Settings                                                                  */
/* -------------------------------------------------------------------------- */
export const getSettings = () => api.get("/vendor/me/pos/settings").then((r) => r.data);
export const putSettings = (patch) => api.put("/vendor/me/pos/settings", patch).then((r) => r.data);

/* -------------------------------------------------------------------------- */
/*  Invoice counter                                                           */
/* -------------------------------------------------------------------------- */
export const peekInvoiceNo    = () => api.post("/vendor/me/pos/invoice/peek").then((r) => r.data);
export const consumeInvoiceNo = () => api.post("/vendor/me/pos/invoice/consume").then((r) => r.data);

/* -------------------------------------------------------------------------- */
/*  Sales CRUD                                                                */
/* -------------------------------------------------------------------------- */
export const createSale = (body) => api.post("/vendor/me/pos/sales", body).then((r) => r.data);
export const listSales  = (params = {}) => api.get("/vendor/me/pos/sales", { params }).then((r) => r.data);
export const getSale    = (id) => api.get(`/vendor/me/pos/sales/${id}`).then((r) => r.data);
export const cancelSale = (id) => api.post(`/vendor/me/pos/sales/${id}/cancel`).then((r) => r.data);
export const refundSale = (id, reason) => api.post(`/vendor/me/pos/sales/${id}/refund`, { reason }).then((r) => r.data);
export const downloadInvoicePdf = (id) =>
  api.get(`/vendor/me/pos/sales/${id}/invoice.pdf`, { responseType: "blob" }).then((r) => r.data);

/* -------------------------------------------------------------------------- */
/*  Dashboard / KPIs                                                          */
/* -------------------------------------------------------------------------- */
export const getDashboard   = () => api.get("/vendor/me/pos/dashboard").then((r) => r.data);
export const getCashSummary = (date) => api.get("/vendor/me/pos/cash-summary", { params: date ? { date } : {} }).then((r) => r.data);
export const getStatement   = (from, to) => api.get("/vendor/me/pos/statement", { params: { from, to } }).then((r) => r.data);
export const getAnalytics   = () => api.get("/vendor/me/pos/analytics").then((r) => r.data);

/* -------------------------------------------------------------------------- */
/*  Customers (optional v1)                                                   */
/* -------------------------------------------------------------------------- */
export const listCustomers   = (q, limit = 20) => api.get("/vendor/me/pos/customers", { params: { q, limit } }).then((r) => r.data);
export const upsertCustomer  = (body) => api.post("/vendor/me/pos/customers", body).then((r) => r.data);
export const patchCustomer   = (id, body) => api.patch(`/vendor/me/pos/customers/${id}`, body).then((r) => r.data);

/* -------------------------------------------------------------------------- */
/*  One-shot bulk import — migrates the vendor's localStorage history into    */
/*  the cloud the first time it becomes available.                            */
/* -------------------------------------------------------------------------- */
export const bulkImportSales = (sales) => api.post("/vendor/me/pos/sales/bulk-import", { sales }).then((r) => r.data);

/* -------------------------------------------------------------------------- */
/*  Mirror helper — used by vendorSales.createInvoice. Never throws; returns  */
/*  { ok, server } so the localStorage write keeps being authoritative until  */
/*  cloud is fully migrated.                                                  */
/* -------------------------------------------------------------------------- */
export async function mirrorSaleToCloud(draft) {
  if (!(await probeCloud())) return { ok: false, reason: "cloud-not-available" };
  try {
    const server = await createSale(draft);
    return { ok: true, server };
  } catch (e) {
    return { ok: false, reason: e?.response?.data?.detail || e?.message || "cloud-write-failed" };
  }
}
