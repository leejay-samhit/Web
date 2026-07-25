// Lightweight CSV parser + Product Master validator/normaliser.
// No external dependency. Handles quoted fields, escaped quotes and CRLF.

/**
 * Parse a CSV string into an array of row objects using the header row.
 * Returns { headers: string[], rows: object[] }.
 */
export function parseCsv(text) {
  if (!text) return { headers: [], rows: [] };
  const src = text.replace(/\r\n?/g, "\n");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [headerRow, ...data] = rows;
  const headers = (headerRow || []).map((h) => h.trim());
  return {
    headers,
    rows: data.map((r) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
      return obj;
    }),
  };
}

// Canonical header list — case-insensitive lookup at parse time.
export const PRODUCT_HEADERS = [
  "name","category","subCategory","brand","barcode","sku","hsnCode","unit",
  "mrp","sellingPrice","minSellingPrice","purchasePriceExGst","gstPct","gstType",
  "openingStock","currentStock","lowStockAlert","reorderLevel",
  "batchNumber","expiryDate","description",
  "supplierName","supplierGstin",
];

// Small alias map so users can use headers like "Product Name" or "GST%".
const ALIASES = {
  "product name": "name",
  "product": "name",
  "sale price": "sellingPrice",
  "selling price": "sellingPrice",
  "mrp price": "mrp",
  "hsn": "hsnCode",
  "hsn code": "hsnCode",
  "sac": "hsnCode",
  "gst%": "gstPct",
  "gst %": "gstPct",
  "gst": "gstPct",
  "gst type": "gstType",
  "stock": "currentStock",
  "quantity": "currentStock",
  "opening stock": "openingStock",
  "low stock": "lowStockAlert",
  "reorder": "reorderLevel",
  "batch": "batchNumber",
  "expiry": "expiryDate",
  "purchase price": "purchasePriceExGst",
  "cost": "purchasePriceExGst",
  "supplier": "supplierName",
  "supplier name": "supplierName",
  "gstin": "supplierGstin",
  "supplier gstin": "supplierGstin",
};

/** Normalise headers to canonical Product Master fields. */
export function normaliseHeader(h) {
  const key = String(h || "").trim().toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  const found = PRODUCT_HEADERS.find((c) => c.toLowerCase() === key);
  return found || null;
}

/**
 * Validate one row and return { ok, value, errors[] }.
 * `value` is the normalised object ready for saveProduct().
 */
export function validateRow(raw) {
  const errors = [];
  const num = (v) => {
    if (v == null || v === "") return 0;
    const n = Number(String(v).replace(/[,₹\s]/g, ""));
    return isNaN(n) ? 0 : n;
  };
  const name = String(raw.name || "").trim();
  if (!name) errors.push("Missing name");
  const gstPct = num(raw.gstPct);
  if (gstPct < 0 || gstPct > 40) errors.push("Invalid GST %");
  const sellingPrice = num(raw.sellingPrice);
  if (sellingPrice < 0) errors.push("Selling price cannot be negative");
  const mrp = num(raw.mrp) || sellingPrice;
  const purchasePrice = num(raw.purchasePriceExGst);
  const currentStock = num(raw.currentStock) || num(raw.openingStock);

  const value = {
    name,
    category: raw.category || "",
    subCategory: raw.subCategory || "",
    brand: raw.brand || "",
    barcode: raw.barcode || "",
    sku: raw.sku || "",
    hsnCode: raw.hsnCode || "",
    unit: raw.unit || "pcs",
    description: raw.description || "",

    mrp_paise: Math.round(mrp * 100),
    sellingPrice_paise: Math.round(sellingPrice * 100),
    minSellingPrice_paise: Math.round(num(raw.minSellingPrice) * 100),
    purchasePriceExGst_paise: Math.round(purchasePrice * 100),
    gstPct,
    gstType: raw.gstType || "CGST_SGST",
    profitPerItem_paise: Math.max(0, Math.round((sellingPrice - purchasePrice) * 100)),
    profitMarginPct: sellingPrice ? ((sellingPrice - purchasePrice) / sellingPrice) * 100 : 0,

    openingStock: num(raw.openingStock),
    currentStock,
    reservedStock: 0,
    availableStock: currentStock,
    lowStockAlert: num(raw.lowStockAlert),
    reorderLevel: num(raw.reorderLevel),
    batchNumber: raw.batchNumber || "",
    expiryDate: raw.expiryDate || "",

    supplierName: raw.supplierName || "",
    supplierGstin: raw.supplierGstin || "",
  };

  return { ok: errors.length === 0, value, errors };
}

/** Convert a raw parsed CSV (headers + rows of {rawHeader: cell}) to canonical rows. */
export function normaliseParsed(headers, rows) {
  const mapping = headers.map((h) => normaliseHeader(h));
  const canonical = rows.map((raw) => {
    const out = {};
    headers.forEach((h, i) => {
      const canon = mapping[i];
      if (canon) out[canon] = raw[h];
    });
    return out;
  });
  return {
    mapping: headers.map((h, i) => ({ from: h, to: mapping[i] })),
    rows: canonical,
  };
}

/** A CSV template retailers can download. */
export const CSV_TEMPLATE = [
  ["name","category","brand","barcode","sku","hsnCode","unit","mrp","sellingPrice","purchasePriceExGst","gstPct","gstType","currentStock","lowStockAlert","batchNumber","expiryDate","supplierName","supplierGstin"],
  ["Basmati Rice 5kg","Grocery","India Gate","8901234567890","RICE-5KG","1006","kg","650","599","480","5","CGST_SGST","30","5","B2402","2026-12-31","Delight Foods","29AAACD1234E1Z5"],
  ["Cotton T-Shirt L","Fashion","Slangwear","","TSHIRT-L","6109","pcs","799","699","410","5","CGST_SGST","20","3","","","Wear Well","27AAACW1234A1ZP"],
].map((row) => row.map((v) => (String(v).includes(",") ? `"${v}"` : v)).join(",")).join("\n");
