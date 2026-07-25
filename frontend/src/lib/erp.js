// ERP 3.0 client — thin wrapper over /api/erp/* with graceful localStorage
// fallback so the UI keeps working while the external backend rolls out.
// See /app/memory/ERP_BILLING_3.0_SPEC.md for the full contract.

import api from "@/lib/api";
import { log } from "@/lib/log";

// ─── Local-storage helpers (per vendor) ────────────────────────────────────
const NS = "sc.erp.v1";
const key = (vendorId, bucket) => `${NS}.${vendorId || "anon"}.${bucket}`;

const lsGet = (vendorId, bucket, fallback) => {
  try {
    const raw = localStorage.getItem(key(vendorId, bucket));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const lsSet = (vendorId, bucket, val) => {
  try {
    localStorage.setItem(key(vendorId, bucket), JSON.stringify(val));
  } catch { /* quota */ }
};

// ─── Currency helpers ──────────────────────────────────────────────────────
export const paiseToRupees = (p) => Number(p || 0) / 100;
export const rupeesToPaise = (r) => Math.round(Number(r || 0) * 100);

// ─── Owner verify header helper ────────────────────────────────────────────
const withOwner = (headers, ownerPassword) =>
  ownerPassword ? { ...headers, "X-Owner-Verify": ownerPassword } : headers;

// Detect the 428 owner-required response so caller can show the lock modal.
export const isOwnerRequired = (err) =>
  err?.response?.status === 428 ||
  err?.response?.data?.detail === "owner_verification_required";

// ─── Products (Product Master) ─────────────────────────────────────────────
export async function listProducts(vendorId, params = {}) {
  try {
    const { data } = await api.get("/erp/products", { params });
    return Array.isArray(data) ? data : data?.items || [];
  } catch (e) {
    if (e?.response?.status !== 404) log.error("listProducts", e);
    return lsGet(vendorId, "products", []);
  }
}
export async function saveProduct(vendorId, payload, ownerPassword) {
  try {
    const method = payload._id ? "put" : "post";
    const url = payload._id ? `/erp/products/${payload._id}` : "/erp/products";
    const { data } = await api({ method, url, data: payload, headers: withOwner({}, ownerPassword) });
    return data;
  } catch (e) {
    if (isOwnerRequired(e)) throw e;
    if (e?.response?.status !== 404) log.error("saveProduct", e);
    // fallback local
    const list = lsGet(vendorId, "products", []);
    const p = payload._id
      ? list.map((x) => (x._id === payload._id ? { ...x, ...payload, updatedAt: new Date().toISOString() } : x))
      : [...list, { ...payload, _id: `local-${Date.now()}`, createdAt: new Date().toISOString() }];
    lsSet(vendorId, "products", p);
    return payload._id ? payload : p[p.length - 1];
  }
}
export async function deleteProduct(vendorId, id, ownerPassword) {
  try {
    await api.delete(`/erp/products/${id}`, { headers: withOwner({}, ownerPassword) });
  } catch (e) {
    if (isOwnerRequired(e)) throw e;
    if (e?.response?.status !== 404) log.error("deleteProduct", e);
    lsSet(vendorId, "products", lsGet(vendorId, "products", []).filter((p) => p._id !== id));
  }
}

// ─── Purchase Book ─────────────────────────────────────────────────────────
export async function listPurchases(vendorId, params = {}, ownerPassword) {
  try {
    const { data } = await api.get("/erp/purchases", { params, headers: withOwner({}, ownerPassword) });
    return Array.isArray(data) ? data : data?.items || [];
  } catch (e) {
    if (isOwnerRequired(e)) throw e;
    if (e?.response?.status !== 404) log.error("listPurchases", e);
    return lsGet(vendorId, "purchases", []);
  }
}
export async function createPurchase(vendorId, payload, ownerPassword) {
  try {
    const { data } = await api.post("/erp/purchases", payload, { headers: withOwner({}, ownerPassword) });
    return data;
  } catch (e) {
    if (isOwnerRequired(e)) throw e;
    if (e?.response?.status !== 404) log.error("createPurchase", e);
    const rows = (payload.items || []).map((it, i) => ({
      _id: `local-${Date.now()}-${i}`,
      vendorId, purchaseDate: payload.purchaseDate, invoiceNumber: payload.invoiceNumber,
      supplierName: payload.supplier?.name, supplierGstin: payload.supplier?.gstin,
      supplierMobile: payload.supplier?.mobile, supplierAddress: payload.supplier?.address,
      productName: it.productName, barcode: it.barcode || "", category: it.category || "",
      hsnCode: it.hsnCode || "",
      quantity: it.quantity, freeQuantity: it.freeQuantity || 0,
      purchasePriceExGst_paise: it.purchasePriceExGst_paise,
      gstPct: it.gstPct, gstType: it.gstType,
      gstAmount_paise: Math.round(it.purchasePriceExGst_paise * it.gstPct / 100),
      purchasePriceIncGst_paise: it.purchasePriceExGst_paise + Math.round(it.purchasePriceExGst_paise * it.gstPct / 100),
      totalPurchaseValue_paise: (it.purchasePriceExGst_paise + Math.round(it.purchasePriceExGst_paise * it.gstPct / 100)) * it.quantity,
      sellingPrice_paise: it.sellingPrice_paise, mrp_paise: it.mrp_paise,
      profitMarginPct: it.sellingPrice_paise && it.purchasePriceExGst_paise
        ? ((it.sellingPrice_paise - it.purchasePriceExGst_paise) / it.sellingPrice_paise) * 100 : 0,
      createdAt: new Date().toISOString(),
    }));
    lsSet(vendorId, "purchases", [...lsGet(vendorId, "purchases", []), ...rows]);
    return { ok: true, rows };
  }
}
export async function purchaseSummary(vendorId, params = {}, ownerPassword) {
  try {
    const { data } = await api.get("/erp/purchases/summary", { params, headers: withOwner({}, ownerPassword) });
    return data;
  } catch (e) {
    if (isOwnerRequired(e)) throw e;
    const rows = lsGet(vendorId, "purchases", []);
    const totalPurchaseValue_paise = rows.reduce((s, r) => s + (r.totalPurchaseValue_paise || 0), 0);
    const totalGstPaid_paise = rows.reduce((s, r) => s + (r.gstAmount_paise || 0) * (r.quantity || 0), 0);
    const suppliers = new Set(rows.map((r) => r.supplierName).filter(Boolean));
    const products = new Set(rows.map((r) => r.productName));
    const margins = rows.map((r) => r.profitMarginPct || 0);
    const avgProfitMarginPct = margins.length ? margins.reduce((s, m) => s + m, 0) / margins.length : 0;
    return {
      totalPurchaseValue_paise,
      totalGstPaid_paise,
      totalProducts: products.size,
      totalSuppliers: suppliers.size,
      avgProfitMarginPct,
      currentInventoryValue_paise: totalPurchaseValue_paise, // rough local estimate
    };
  }
}

// ─── Inventory ─────────────────────────────────────────────────────────────
export async function inventorySummary(vendorId, ownerPassword) {
  try {
    const { data } = await api.get("/erp/inventory/summary", { headers: withOwner({}, ownerPassword) });
    return data;
  } catch (e) {
    if (isOwnerRequired(e)) throw e;
    const products = lsGet(vendorId, "products", []);
    const inventoryValue_paise = products.reduce((s, p) => s + (p.sellingPrice_paise || 0) * (p.currentStock || 0), 0);
    const currentStock = products.reduce((s, p) => s + (p.currentStock || 0), 0);
    const reservedStock = products.reduce((s, p) => s + (p.reservedStock || 0), 0);
    return {
      currentStock,
      reservedStock,
      availableStock: currentStock - reservedStock,
      inventoryValue_paise,
      lowStockCount: products.filter((p) => (p.currentStock || 0) <= (p.lowStockAlert || 0) && (p.currentStock || 0) > 0).length,
      outOfStockCount: products.filter((p) => (p.currentStock || 0) === 0).length,
      deadStockCount: 0,
      fastMoving: [],
      slowMoving: [],
    };
  }
}

// ─── Dashboards (all Owner-locked) ─────────────────────────────────────────
export const accountsDashboard = (ownerPassword) =>
  api.get("/erp/accounts/dashboard", { headers: withOwner({}, ownerPassword) }).then((r) => r.data);

export const profitDashboard = (params, ownerPassword) =>
  api.get("/erp/profit/dashboard", { params, headers: withOwner({}, ownerPassword) }).then((r) => r.data);

export const gstDashboard = (params, ownerPassword) =>
  api.get("/erp/gst/dashboard", { params, headers: withOwner({}, ownerPassword) }).then((r) => r.data);

export const gstTimeline = (params, ownerPassword) =>
  api.get("/erp/gst/timeline", { params, headers: withOwner({}, ownerPassword) }).then((r) => r.data).catch(() => null);

export const gstAssistant = (params, ownerPassword) =>
  api.get("/erp/gst/assistant", { params, headers: withOwner({}, ownerPassword) }).then((r) => r.data);

export const incomeTaxDashboard = (params, ownerPassword) =>
  api.get("/erp/income-tax/dashboard", { params, headers: withOwner({}, ownerPassword) }).then((r) => r.data);

export const financialHealth = (params, ownerPassword) =>
  api.get("/erp/financial-health", { params, headers: withOwner({}, ownerPassword) }).then((r) => r.data);

export const complianceStatus = () =>
  api.get("/erp/compliance/status").then((r) => r.data);

export const listReminders = () =>
  api.get("/erp/reminders").then((r) => r.data);

// ─── Business profile ─────────────────────────────────────────────────────
export async function getBusinessProfile(vendorId) {
  try {
    const { data } = await api.get("/erp/business-profile");
    return data;
  } catch (e) {
    if (e?.response?.status !== 404) log.error("getBusinessProfile", e);
    return lsGet(vendorId, "business-profile", null);
  }
}
export async function saveBusinessProfile(vendorId, profile) {
  try {
    const { data } = await api.put("/erp/business-profile", profile);
    return data;
  } catch (e) {
    if (e?.response?.status !== 404) log.error("saveBusinessProfile", e);
    lsSet(vendorId, "business-profile", profile);
    return profile;
  }
}

// ─── Reports ───────────────────────────────────────────────────────────────
export const runReport = (kind, params, ownerPassword) =>
  api.get(`/erp/reports/${kind}`, { params: { ...params, format: "json" }, headers: withOwner({}, ownerPassword) }).then((r) => r.data);

export const exportReport = (kind, params, ownerPassword) =>
  api.get(`/erp/reports/${kind}`, { params, headers: withOwner({}, ownerPassword) }).then((r) => r.data);

// ─── Owner Security ────────────────────────────────────────────────────────
export const ownerStatus = () => api.get("/erp/owner-security/status").then((r) => r.data).catch(() => ({ enrolled: false }));
export const ownerInit = (payload) => api.post("/erp/owner-security/init", payload).then((r) => r.data);
export const ownerVerify = (payload) => api.post("/erp/owner-security/verify", payload).then((r) => r.data);
export const ownerChangePassword = (payload) => api.post("/erp/owner-security/change-password", payload).then((r) => r.data);
export const ownerChangePin = (payload) => api.post("/erp/owner-security/change-pin", payload).then((r) => r.data);
export const ownerHistory = (ownerPassword) => api.get("/erp/owner-security/history", { headers: withOwner({}, ownerPassword) }).then((r) => r.data);

// ─── Roles & staff ─────────────────────────────────────────────────────────
export const listRoles = (ownerPassword) => api.get("/erp/roles", { headers: withOwner({}, ownerPassword) }).then((r) => r.data).catch(() => []);
export const listStaff = (ownerPassword) => api.get("/erp/staff", { headers: withOwner({}, ownerPassword) }).then((r) => r.data).catch(() => []);
export const saveRole = (payload, ownerPassword) => {
  const method = payload._id ? "put" : "post";
  const url = payload._id ? `/erp/roles/${payload._id}` : "/erp/roles";
  return api({ method, url, data: payload, headers: withOwner({}, ownerPassword) }).then((r) => r.data);
};

// ─── Audit ────────────────────────────────────────────────────────────────
export const listAudit = (params, ownerPassword) =>
  api.get("/erp/audit", { params, headers: withOwner({}, ownerPassword) }).then((r) => r.data).catch(() => []);

// ─── Learning center ──────────────────────────────────────────────────────
export const listLearn = () => api.get("/erp/learn").then((r) => r.data).catch(() => null);
export const getLearn = (slug) => api.get(`/erp/learn/${slug}`).then((r) => r.data).catch(() => null);

// ─── Search ────────────────────────────────────────────────────────────────
export const erpSearch = (params) => api.get("/erp/search", { params }).then((r) => r.data).catch(() => []);

// ─── Super Admin ERP settings ─────────────────────────────────────────────
export const getErpSettings = () => api.get("/admin/erp-settings").then((r) => r.data).catch(() => null);
export const saveErpSettings = (payload) => api.put("/admin/erp-settings", payload).then((r) => r.data);
