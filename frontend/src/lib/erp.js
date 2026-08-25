// ERP 3.0 client — pulls REAL vendor data from the existing production
// endpoints (/vendor/me/products, /vendor/me/pos/*, /vendor/me/stats) so the
// dashboards reflect what the shopkeeper already has in the mobile app.
//
// Modules that don't yet have a production endpoint (Purchase Book, Audit,
// Roles, Compliance flags, Return reminders) still fall back to localStorage
// per vendor and surface a small "Backend pending" banner.
//
// Full contract for the ERP-specific endpoints (when the backend team ships
// them) lives at /app/memory/ERP_BILLING_3.0_SPEC.md.

import api from "@/lib/api";
import { log } from "@/lib/log";

// ─── Local-storage helpers (per vendor) ────────────────────────────────────
const NS = "sc.erp.v1";
const key = (vendorId, bucket) => `${NS}.${vendorId || "anon"}.${bucket}`;

const lsGet = (vendorId, bucket, fallback) => {
  try {
    const raw = localStorage.getItem(key(vendorId, bucket));
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
};
const lsSet = (vendorId, bucket, val) => {
  try { localStorage.setItem(key(vendorId, bucket), JSON.stringify(val)); } catch { /* quota */ }
};

// ─── Currency helpers ──────────────────────────────────────────────────────
export const paiseToRupees = (p) => Number(p || 0) / 100;
export const rupeesToPaise = (r) => Math.round(Number(r || 0) * 100);
const inr = (v) => Math.round(Number(v || 0) * 100); // rupees→paise short alias

// ─── Owner verify header helper ────────────────────────────────────────────
const withOwner = (headers, ownerPassword) =>
  ownerPassword ? { ...headers, "X-Owner-Verify": ownerPassword } : headers;

export const isOwnerRequired = (err) =>
  err?.response?.status === 428 ||
  err?.response?.data?.detail === "owner_verification_required";

// ─── Product mapping between production and ERP shape ──────────────────────
// Production `/vendor/me/products` returns { id, name, price, mrp, stock,
// image_url, description, gst, hsn, category, brand, sku, barcode, ... }.
// We normalise to the ERP Product Master shape so the UI stays unchanged.
function fromProdProduct(p) {
  const price = Number(p.price || 0);
  const mrp = Number(p.mrp || price);
  const purchase = Number(p.purchase_price || p.cost_price || 0);
  const gstPct = Number(p.gst || p.gst_pct || 0);
  return {
    _id: p.id || p._id,
    name: p.name || "",
    image: p.image_url || p.image || "",
    category: p.category || "",
    subCategory: p.sub_category || "",
    brand: p.brand || "",
    barcode: p.barcode || "",
    sku: p.sku || "",
    hsnCode: p.hsn || p.hsn_code || "",
    unit: p.unit || "pcs",
    description: p.description || "",
    mrp_paise: inr(mrp),
    sellingPrice_paise: inr(price),
    minSellingPrice_paise: inr(p.min_selling_price || 0),
    purchasePriceExGst_paise: inr(purchase),
    gstPct,
    gstType: p.gst_type || "CGST_SGST",
    profitPerItem_paise: inr(Math.max(0, price - purchase)),
    profitMarginPct: price ? ((price - purchase) / price) * 100 : 0,
    openingStock: Number(p.opening_stock || 0),
    currentStock: Number(p.stock ?? p.current_stock ?? 0),
    reservedStock: Number(p.reserved_stock || 0),
    availableStock: Number(p.stock ?? 0) - Number(p.reserved_stock || 0),
    lowStockAlert: Number(p.low_stock_alert || 0),
    reorderLevel: Number(p.reorder_level || 0),
    batchNumber: p.batch_number || "",
    expiryDate: p.expiry_date || "",
    supplierName: p.supplier_name || "",
    supplierGstin: p.supplier_gstin || "",
    _source: "backend", // marker so UI can tell real vs local
  };
}

function toProdPatch(p) {
  const patch = {
    name: p.name,
    price: paiseToRupees(p.sellingPrice_paise),
    mrp: paiseToRupees(p.mrp_paise),
    stock: Number(p.currentStock || 0),
    image_url: p.image,
    category: p.category,
    sub_category: p.subCategory,
    brand: p.brand,
    barcode: p.barcode,
    sku: p.sku,
    hsn: p.hsnCode,
    unit: p.unit,
    description: p.description,
    gst: p.gstPct,
    gst_type: p.gstType,
    min_selling_price: paiseToRupees(p.minSellingPrice_paise),
    purchase_price: paiseToRupees(p.purchasePriceExGst_paise),
    low_stock_alert: p.lowStockAlert,
    reorder_level: p.reorderLevel,
    batch_number: p.batchNumber,
    expiry_date: p.expiryDate,
    supplier_name: p.supplierName,
    supplier_gstin: p.supplierGstin,
  };
  // Strip undefined so backend doesn't null out unknown fields.
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
  return patch;
}

/** Merge live backend products with any locally-added-but-not-yet-synced ones. */
function mergeWithLocal(vendorId, backendList) {
  const local = lsGet(vendorId, "products", []).filter((p) => String(p._id).startsWith("local-"));
  return [...backendList, ...local];
}

// ─── Products (Product Master) ─────────────────────────────────────────────
export async function listProducts(vendorId /*, params = {} */) {
  try {
    const { data } = await api.get("/vendor/me/products", { params: { limit: 500 } });
    const raw = Array.isArray(data) ? data : data?.items || [];
    const list = raw.map(fromProdProduct);
    return mergeWithLocal(vendorId, list);
  } catch (e) {
    if (e?.response?.status !== 404) log.error("listProducts", e);
    return lsGet(vendorId, "products", []);
  }
}

export async function saveProduct(vendorId, payload, ownerPassword) {
  const id = payload._id;
  const isNew = !id || String(id).startsWith("local-");
  try {
    if (isNew) {
      const { data } = await api.post("/vendor/me/products", toProdPatch(payload));
      return fromProdProduct(data);
    }
    const { data } = await api.patch(`/vendor/me/products/${id}`, toProdPatch(payload), { headers: withOwner({}, ownerPassword) });
    return fromProdProduct(data);
  } catch (e) {
    if (isOwnerRequired(e)) throw e;
    const status = e?.response?.status;
    // Only fall back to local when the endpoint truly doesn't exist (create
    // route not shipped yet). Any real backend rejection (400/401/403/409/422/500)
    // must surface to the user so they know the change didn't persist.
    if (status !== 404 && status !== 405) {
      log.error("saveProduct", e);
      throw e;
    }
    // Local fallback (only when the create/update route is 404/405)
    const list = lsGet(vendorId, "products", []);
    const p = isNew
      ? [...list, { ...payload, _id: `local-${Date.now()}`, createdAt: new Date().toISOString() }]
      : list.map((x) => (x._id === id ? { ...x, ...payload, updatedAt: new Date().toISOString() } : x));
    lsSet(vendorId, "products", p);
    return isNew ? p[p.length - 1] : payload;
  }
}

export async function deleteProduct(vendorId, id, ownerPassword) {
  try {
    await api.delete(`/vendor/me/products/${id}`, { headers: withOwner({}, ownerPassword) });
  } catch (e) {
    if (isOwnerRequired(e)) throw e;
    if (e?.response?.status !== 404) log.error("deleteProduct", e);
    lsSet(vendorId, "products", lsGet(vendorId, "products", []).filter((p) => p._id !== id));
  }
}

// ─── Purchase Book (localStorage-backed; edit/delete supported) ────────────
export async function listPurchases(vendorId /*, params, ownerPassword */) {
  return lsGet(vendorId, "purchases", []);
}

function _buildPurchaseRow(vendorId, payload, it, i, existingId) {
  const exGst = Math.max(0, Number(it.purchasePriceExGst_paise) || 0);
  const gstPct = Math.max(0, Number(it.gstPct) || 0);
  const gstAmount = Math.round(exGst * gstPct / 100);
  const incGst = exGst + gstAmount;
  const qty = Math.max(0, Number(it.quantity) || 0);
  const sell = Math.max(0, Number(it.sellingPrice_paise) || 0);
  return {
    _id: existingId || `local-${Date.now()}-${i}`,
    vendorId,
    purchaseDate: payload.purchaseDate,
    invoiceNumber: payload.invoiceNumber,
    supplierName: payload.supplier?.name,
    supplierGstin: payload.supplier?.gstin,
    supplierMobile: payload.supplier?.mobile,
    supplierAddress: payload.supplier?.address,
    productName: it.productName,
    barcode: it.barcode || "",
    category: it.category || "",
    hsnCode: it.hsnCode || "",
    quantity: qty,
    freeQuantity: Math.max(0, Number(it.freeQuantity) || 0),
    purchasePriceExGst_paise: exGst,
    gstPct,
    gstType: it.gstType,
    gstAmount_paise: gstAmount,
    purchasePriceIncGst_paise: incGst,
    totalPurchaseValue_paise: incGst * qty,
    sellingPrice_paise: sell,
    mrp_paise: Math.max(0, Number(it.mrp_paise) || 0),
    profitMarginPct: sell && exGst ? ((sell - exGst) / sell) * 100 : 0,
    createdAt: existingId ? undefined : new Date().toISOString(),
    updatedAt: existingId ? new Date().toISOString() : undefined,
  };
}

export async function createPurchase(vendorId, payload /*, ownerPassword */) {
  const rows = (payload.items || []).map((it, i) => _buildPurchaseRow(vendorId, payload, it, i, null));
  lsSet(vendorId, "purchases", [...lsGet(vendorId, "purchases", []), ...rows]);
  return { ok: true, rows };
}

export async function updatePurchase(vendorId, purchaseId, payload) {
  const list = lsGet(vendorId, "purchases", []);
  const it = (payload.items || [])[0] || payload;
  const next = list.map((r) => r._id === purchaseId ? _buildPurchaseRow(vendorId, payload, it, 0, purchaseId) : r);
  lsSet(vendorId, "purchases", next);
  return { ok: true };
}

export async function deletePurchase(vendorId, purchaseId) {
  const list = lsGet(vendorId, "purchases", []).filter((r) => r._id !== purchaseId);
  lsSet(vendorId, "purchases", list);
  return { ok: true };
}

export async function purchaseSummary(vendorId) {
  const rows = lsGet(vendorId, "purchases", []);
  const purchasesValue_paise = rows.reduce((s, r) => s + (r.totalPurchaseValue_paise || 0), 0);
  const purchasesGst_paise = rows.reduce((s, r) => s + (r.gstAmount_paise || 0) * (r.quantity || 0), 0);
  const suppliers = new Set(rows.map((r) => r.supplierName).filter(Boolean));
  const purchaseProducts = new Set(rows.map((r) => r.productName));
  const margins = rows.map((r) => r.profitMarginPct || 0);
  const avgProfitMarginPct = margins.length ? margins.reduce((s, m) => s + m, 0) / margins.length : 0;

  // Aggregate with Product Master (live catalog) — user decision Feb-2026:
  //   Total Purchase Value = Product Master (purchase price × current stock) + Purchase Book entries
  //   Purchase GST = Product Master GST (on purchase cost × stock) + Purchase Book GST
  //   Products = master product count + unique purchase products
  let masterPurchaseValue_paise = 0;
  let masterPurchaseGst_paise = 0;
  let masterProducts = 0;
  let inventoryValue_paise = purchasesValue_paise;
  try {
    const live = await listProducts(vendorId);
    masterProducts = live.length;
    live.forEach((p) => {
      const cost = Number(p.purchasePriceExGst_paise || 0);
      const stock = Number(p.currentStock || 0);
      const gstPct = Number(p.gstPct || 0);
      masterPurchaseValue_paise += cost * stock;
      masterPurchaseGst_paise += Math.round(cost * gstPct / 100) * stock;
    });
    inventoryValue_paise = live.reduce((s, p) => s + (Number(p.sellingPrice_paise) || 0) * (Number(p.currentStock) || 0), 0);
  } catch { /* keep defaults */ }

  return {
    // Aggregated totals (Product Master + Purchase entries) — new per user decision
    totalPurchaseValue_paise: masterPurchaseValue_paise + purchasesValue_paise,
    totalGstPaid_paise: masterPurchaseGst_paise + purchasesGst_paise,
    totalProducts: masterProducts + purchaseProducts.size,
    // Individual splits (so UI can hint "master + entries")
    masterPurchaseValue_paise, purchasesValue_paise,
    masterPurchaseGst_paise, purchasesGst_paise,
    masterProducts, purchaseProducts: purchaseProducts.size,
    totalSuppliers: suppliers.size,
    avgProfitMarginPct,
    currentInventoryValue_paise: inventoryValue_paise,
  };
}

// ─── Inventory — derived live from /vendor/me/products ────────────────────
export async function inventorySummary(vendorId) {
  const products = await listProducts(vendorId);
  const inventoryValue_paise = products.reduce((s, p) => s + (p.sellingPrice_paise || 0) * (p.currentStock || 0), 0);
  const currentStock  = products.reduce((s, p) => s + (p.currentStock || 0), 0);
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

// ─── Accounts Dashboard — /vendor/me/pos/dashboard + /vendor/me/stats ────
export async function accountsDashboard(/* ownerPassword */) {
  const [dash, stats] = await Promise.all([
    api.get("/vendor/me/pos/dashboard").then((r) => r.data).catch(() => null),
    api.get("/vendor/me/stats").then((r) => r.data).catch(() => null),
  ]);
  const mk = (blk) => ({
    sales_paise:       inr(blk?.turnover),
    purchase_paise:    inr(blk?.purchase),
    orders:            Number(blk?.bills || blk?.orders || 0),
    profit_paise:      inr(blk?.profit),
    gst_paise:         inr(blk?.gst),
    expenses_paise:    inr(blk?.expenses),
    netEarnings_paise: inr(blk?.profit) - inr(blk?.expenses),
  });
  return {
    today:    mk(dash?.today),
    month:    mk(dash?.month),
    lifetime: {
      sales_paise:       inr(stats?.total_sales),
      purchase_paise:    0,
      orders:            Number(stats?.all_orders || 0),
      profit_paise:      inr(stats?.total_earnings),
      gst_paise:         0,
      expenses_paise:    0,
      netEarnings_paise: inr(stats?.total_earnings),
    },
  };
}

// ─── Profit Dashboard — /vendor/me/pos/analytics ─────────────────────────
export async function profitDashboard(/* params, ownerPassword */) {
  const a = await api.get("/vendor/me/pos/analytics").then((r) => r.data).catch(() => null);
  const daily = a?.daily || [];
  const totalSalesValue_paise = daily.reduce((s, d) => s + inr(d.turnover), 0);
  const grossProfit_paise = daily.reduce((s, d) => s + inr(d.profit), 0);
  const topRev = a?.top_revenue?.[0];
  const leastRev = (a?.least_sold || [])[0];
  const topGst = a?.top_gst?.[0];
  return {
    totalPurchaseValue_paise: Math.max(0, totalSalesValue_paise - grossProfit_paise),
    totalSalesValue_paise,
    grossProfit_paise,
    netProfit_paise: grossProfit_paise,
    profitPct: totalSalesValue_paise ? (grossProfit_paise * 100) / totalSalesValue_paise : 0,
    avgMarginPct: totalSalesValue_paise ? (grossProfit_paise * 100) / totalSalesValue_paise : 0,
    bestSelling:  topRev  ? { productId: topRev.product_id,  name: topRev.name,  qtySold: topRev.qty,  revenue_paise: inr(topRev.revenue) } : null,
    lowestSelling: leastRev ? { productId: leastRev.product_id, name: leastRev.name, qtySold: leastRev.qty, revenue_paise: inr(leastRev.revenue) } : null,
    highestProfit: topGst ? { productId: topGst.product_id, name: topGst.name, profit_paise: inr(topGst.revenue) } : null,
    lowestProfit: null,
  };
}

// ─── GST Dashboard — /vendor/me/pos/dashboard + analytics ────────────────
export async function gstDashboard(/* params, ownerPassword */) {
  const [dash, a, stats] = await Promise.all([
    api.get("/vendor/me/pos/dashboard").then((r) => r.data).catch(() => null),
    api.get("/vendor/me/pos/analytics").then((r) => r.data).catch(() => null),
    api.get("/vendor/me/stats").then((r) => r.data).catch(() => null),
  ]);
  const monthGst = inr(dash?.month?.gst);
  const monthTurnover = inr(dash?.month?.turnover);
  const monthProfit = inr(dash?.month?.profit);
  const half = Math.round(monthGst / 2);
  void stats; void a;
  return {
    taxableSales_paise: monthTurnover - monthGst,
    exemptSales_paise: 0,
    inputGst_paise: 0,
    outputGst_paise: monthGst,
    cgst_paise: half,
    sgst_paise: monthGst - half,
    igst_paise: 0,
    gstPayableEstimate_paise: monthGst,
    gstRefundEstimate_paise: 0,
    filingStatus: monthGst > 0 ? "PENDING" : "FILED",
    nextReturnDueDate: (() => { const d = new Date(); d.setDate(20); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); })(),
    monthProfit,
  };
}

// ─── Smart GST Assistant — templated over real data ──────────────────────
export async function gstAssistant(/* params, ownerPassword */) {
  const g = await gstDashboard();
  const fmt = (p) => `₹${Math.round(p / 100).toLocaleString("en-IN")}`;
  return {
    lines: [
      { type: "collected",  text: `You collected ${fmt(g.outputGst_paise)} GST from customers this month.` },
      { type: "paid",       text: `You paid ${fmt(g.inputGst_paise)} GST while purchasing products.` },
      { type: "payable",    text: `Estimated GST payable is ${fmt(g.gstPayableEstimate_paise)}.` },
      { type: "itc",        text: `You may be eligible to claim Input Tax Credit on eligible purchases with proper invoices.` },
      { type: "disclaimer", text: "Please verify these figures with your CA before filing your GST return." },
    ],
  };
}

// ─── Income Tax Dashboard ────────────────────────────────────────────────
export async function incomeTaxDashboard(/* params, ownerPassword */) {
  const stats = await api.get("/vendor/me/stats").then((r) => r.data).catch(() => null);
  const annualSales_paise = inr(stats?.total_sales);
  const grossProfit_paise = inr(stats?.total_earnings);
  const annualPurchases_paise = Math.max(0, annualSales_paise - grossProfit_paise);
  return {
    annualSales_paise,
    annualPurchases_paise,
    grossProfit_paise,
    businessExpenses_paise: 0,
    netBusinessIncome_paise: grossProfit_paise,
    estimatedTaxableIncome_paise: grossProfit_paise,
    disclaimer: "These are estimates for business accounting and should be verified before filing taxes.",
  };
}

// ─── Financial Health — 30-day series from POS analytics ─────────────────
export async function financialHealth(/* params, ownerPassword */) {
  const a = await api.get("/vendor/me/pos/analytics").then((r) => r.data).catch(() => null);
  const daily = a?.daily || [];
  // Bucket by month (YYYY-MM)
  const byMonth = {};
  daily.forEach((d) => {
    const m = d.date.slice(0, 7);
    const row = byMonth[m] || { month: m, sales_paise: 0, purchase_paise: 0, profit_paise: 0, margin: 0 };
    row.sales_paise += inr(d.turnover);
    row.profit_paise += inr(d.profit);
    row.purchase_paise += Math.max(0, inr(d.turnover) - inr(d.profit));
    byMonth[m] = row;
  });
  const monthlySeries = Object.values(byMonth).sort((x, y) => x.month.localeCompare(y.month));
  monthlySeries.forEach((r) => { r.margin = r.sales_paise ? (r.profit_paise / r.sales_paise) : 0; });
  const salesArr = monthlySeries.map((r) => r.sales_paise);
  const highestSalesMonth = monthlySeries.length > 1 ? monthlySeries[salesArr.indexOf(Math.max(...salesArr))]?.month || "" : "";
  const lowestSalesMonth  = monthlySeries.length > 1 ? monthlySeries[salesArr.indexOf(Math.min(...salesArr))]?.month || "" : "";
  const salesGrowthPct = monthlySeries.length >= 2 && monthlySeries[0].sales_paise
    ? ((monthlySeries[monthlySeries.length - 1].sales_paise - monthlySeries[0].sales_paise) / monthlySeries[0].sales_paise) * 100
    : 0;
  const totalSales = salesArr.reduce((s, v) => s + v, 0);
  const inv = await inventorySummary(undefined);
  return {
    salesGrowthPct,
    purchaseGrowthPct: 0,
    monthlySeries,
    highestSalesMonth,
    lowestSalesMonth,
    cashSales_paise: 0,
    upiSales_paise: totalSales,
    cardSales_paise: 0,
    creditSales_paise: 0,
    outstandingPayments_paise: 0,
    inventoryValue_paise: inv.inventoryValue_paise,
  };
}

// ─── Compliance status ────────────────────────────────────────────────────
export async function complianceStatus() {
  const stats = await api.get("/vendor/me/stats").then((r) => r.data).catch(() => null);
  const annualTurnover_paise = inr(stats?.total_sales);
  // Editable thresholds (Super Admin) — falls back to Indian defaults.
  const gstGoods = 4000000000; // ₹40L
  const flags = [];
  if (annualTurnover_paise < gstGoods * 0.5) {
    flags.push({ level: "INFO", code: "BELOW_GST_THRESHOLD", text: "You are currently well below the GST registration threshold." });
  } else if (annualTurnover_paise < gstGoods) {
    flags.push({ level: "WARNING", code: "NEAR_GST_THRESHOLD", text: "You are within range of the GST registration threshold — start preparing." });
  } else {
    flags.push({ level: "ACTION", code: "GST_REGISTRATION_REQUIRED", text: "GST registration may be mandatory — consult your CA." });
  }
  return { annualTurnover_paise, flags };
}

// ─── Reminders — synthesised from live data ──────────────────────────────
export async function listReminders() {
  const list = [];
  try {
    const products = await listProducts();
    const low = products.filter((p) => (p.currentStock || 0) > 0 && (p.currentStock || 0) <= (p.lowStockAlert || 0));
    const oos = products.filter((p) => (p.currentStock || 0) === 0);
    low.slice(0, 8).forEach((p) => list.push({ kind: "LOW_STOCK", productId: p._id, text: `${p.name} is running low (${p.currentStock} left).`, severity: "INFO" }));
    oos.slice(0, 8).forEach((p) => list.push({ kind: "OUT_OF_STOCK", productId: p._id, text: `${p.name} is out of stock.`, severity: "WARNING" }));
  } catch { /* ignore */ }
  const g = await gstDashboard().catch(() => null);
  if (g?.gstPayableEstimate_paise > 0) {
    list.push({ kind: "GST_RETURN", dueDate: g.nextReturnDueDate, text: `GST return due on ${g.nextReturnDueDate} · estimated payable ₹${Math.round(g.gstPayableEstimate_paise / 100).toLocaleString("en-IN")}.`, severity: "WARNING" });
  }
  return list;
}

// ─── Business profile — local until backend ships ────────────────────────
export async function getBusinessProfile(vendorId) {
  return lsGet(vendorId, "business-profile", null);
}
export async function saveBusinessProfile(vendorId, profile) {
  lsSet(vendorId, "business-profile", profile);
  return profile;
}

// ─── Reports — best-effort. Sales/profit use POS, others fall back local ─
export async function runReport(kind /*, params, ownerPassword */) {
  try {
    if (kind === "sales" || kind === "profit") {
      const s = await api.get("/vendor/me/pos/sales", { params: { limit: 500 } }).then((r) => r.data).catch(() => []);
      const rows = (Array.isArray(s) ? s : s?.items || []).map((b) => ({
        invoice: b.invoice_number || b.id,
        date: b.date || b.created_at,
        customer: b.customer_name || "Walk-in",
        turnover: b.total || b.turnover,
        gst: b.gst || 0,
        profit: b.profit || 0,
        payment: b.payment_mode || "-",
      }));
      return rows;
    }
    if (kind === "product") {
      const p = await listProducts();
      return p.map((x) => ({ name: x.name, hsn: x.hsnCode, mrp: paiseToRupees(x.mrp_paise), price: paiseToRupees(x.sellingPrice_paise), stock: x.currentStock, unit: x.unit }));
    }
    if (kind === "inventory") {
      const p = await listProducts();
      return p.filter((x) => (x.currentStock || 0) > 0).map((x) => ({ name: x.name, stock: x.currentStock, unit: x.unit, value: paiseToRupees(x.sellingPrice_paise) * (x.currentStock || 0) }));
    }
  } catch (e) { log.error("runReport", e); }
  return [];
}
export async function exportReport(/* kind, params, ownerPassword */) { return { url: null }; }

// ─── Owner Security ──────────────────────────────────────────────────────
// Owner endpoints live on the LOCAL backend (not network-pay-1) so the PIN /
// password data stays with the transfer service.  Default credentials are
// `1234` (both password and PIN); vendors can update them from Owner
// Settings.  See /app/backend/server.py for the endpoint bodies.
import apiLocal from "@/lib/apiLocal";

export const ownerStatus = () => apiLocal.get("/erp/owner-security/status").then((r) => r.data).catch(() => ({ enrolled: false }));
export const ownerInit = (payload) => apiLocal.post("/erp/owner-security/init", payload).then((r) => r.data);
export const ownerVerify = (payload) => apiLocal.post("/erp/owner-security/verify", payload).then((r) => r.data);
export const ownerChangePassword = (payload) => apiLocal.post("/erp/owner-security/change-password", payload).then((r) => r.data);
export const ownerChangePin = (payload) => apiLocal.post("/erp/owner-security/change-pin", payload).then((r) => r.data);
export const ownerHistory = (ownerPassword) => apiLocal.get("/erp/owner-security/history", { headers: withOwner({}, ownerPassword) }).then((r) => r.data).catch(() => null);

// ─── Roles & Staff — no backend yet ──────────────────────────────────────
export const listRoles = () => api.get("/erp/roles").then((r) => r.data).catch(() => []);
export const listStaff = () => api.get("/erp/staff").then((r) => r.data).catch(() => []);
export const saveRole = (payload) => {
  const method = payload._id ? "put" : "post";
  const url = payload._id ? `/erp/roles/${payload._id}` : "/erp/roles";
  return api({ method, url, data: payload }).then((r) => r.data);
};

// ─── Audit — no backend yet ──────────────────────────────────────────────
export const listAudit = (params) => api.get("/erp/audit", { params }).then((r) => r.data).catch(() => []);

// ─── Learning center ──────────────────────────────────────────────────────
export const listLearn = () => api.get("/erp/learn").then((r) => r.data).catch(() => null);
export const getLearn = (slug) => api.get(`/erp/learn/${slug}`).then((r) => r.data).catch(() => null);

// ─── Search ───────────────────────────────────────────────────────────────
export const erpSearch = async ({ q, type }) => {
  const products = await listProducts();
  const needle = String(q || "").toLowerCase();
  if (!needle) return [];
  const match = products.filter((p) => {
    const bag = [p.name, p.barcode, p.sku, p.brand, p.category, p.hsnCode, p.batchNumber, p.supplierName, p.supplierGstin].map((x) => String(x || "").toLowerCase()).join(" ");
    return bag.includes(needle);
  });
  return match.slice(0, 40).map((p) => ({ title: p.name, subtitle: `${p.category} · ${p.hsnCode ? `HSN ${p.hsnCode} · ` : ""}Stock ${p.currentStock} ${p.unit} · ₹${paiseToRupees(p.sellingPrice_paise)}` }));
};

// ─── GST Filing Timeline ──────────────────────────────────────────────────
export const gstTimeline = (params /*, ownerPassword */) =>
  api.get("/erp/gst/timeline", { params }).then((r) => r.data).catch(() => null);

// ─── Super Admin ERP settings ─────────────────────────────────────────────
export const getErpSettings = () => api.get("/admin/erp-settings").then((r) => r.data).catch(() => null);
export const saveErpSettings = (payload) => api.put("/admin/erp-settings", payload).then((r) => r.data);
