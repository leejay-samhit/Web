import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import BackendPendingBanner from "@/components/erp/BackendPendingBanner";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate } from "@/lib/utils";
import { listProducts, saveProduct, deleteProduct, paiseToRupees, rupeesToPaise, isOwnerRequired } from "@/lib/erp";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import ProductCsvImport from "@/components/erp/ProductCsvImport";
import { Search, Plus, Trash2, Save, AlertTriangle, Package, Barcode, Tag, Upload } from "lucide-react";

const EMPTY = {
  name: "", image: "", category: "", subCategory: "", brand: "",
  barcode: "", sku: "", hsnCode: "", unit: "pcs", description: "",
  mrp: 0, sellingPrice: 0, minSellingPrice: 0, discountPct: 0,
  openingStock: 0, currentStock: 0, reservedStock: 0,
  lowStockAlert: 0, reorderLevel: 0, batchNumber: "", expiryDate: "",
  // purchase / supplier
  supplierName: "", supplierGstin: "", supplierMobile: "", supplierAddress: "",
  purchaseInvoiceNumber: "", purchaseDate: "", purchaseQuantity: 0,
  freeQuantity: 0, purchasePriceExGst: 0, gstPct: 0, gstType: "CGST_SGST",
};

const UNITS = ["pcs", "kg", "g", "ltr", "ml", "box", "dozen", "pack"];
const GST_SLABS = [0, 5, 12, 18, 28];

export default function ErpProducts() {
  const { user } = useAuth();
  const vendorId = user?.id || user?._id || "anon";

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(EMPTY);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerNeeded, setOwnerNeeded] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listProducts(vendorId);
    setProducts(list);
    setLoading(false);
  }, [vendorId]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.barcode, p.sku, p.category, p.brand].some((f) => String(f || "").toLowerCase().includes(q))
    );
  }, [products, query]);

  const handleEdit = (p) => {
    setEditing({
      ...EMPTY, ...p,
      mrp: paiseToRupees(p.mrp_paise), sellingPrice: paiseToRupees(p.sellingPrice_paise),
      minSellingPrice: paiseToRupees(p.minSellingPrice_paise),
      purchasePriceExGst: paiseToRupees(p.purchasePriceExGst_paise),
    });
    setShowForm(true);
    setErr("");
  };

  const buildPayload = (draft) => {
    const mrp_paise = rupeesToPaise(draft.mrp);
    const sellingPrice_paise = rupeesToPaise(draft.sellingPrice);
    const minSellingPrice_paise = rupeesToPaise(draft.minSellingPrice);
    const purchasePriceExGst_paise = rupeesToPaise(draft.purchasePriceExGst);
    const profitPerItem_paise = Math.max(0, sellingPrice_paise - purchasePriceExGst_paise);
    const profitMarginPct = sellingPrice_paise ? (profitPerItem_paise / sellingPrice_paise) * 100 : 0;
    return {
      ...draft, mrp_paise, sellingPrice_paise, minSellingPrice_paise,
      purchasePriceExGst_paise, profitPerItem_paise, profitMarginPct,
      currentStock: Number(draft.currentStock || draft.openingStock || 0),
      availableStock: Number(draft.currentStock || draft.openingStock || 0) - Number(draft.reservedStock || 0),
    };
  };

  const handleSave = async () => {
    setErr("");
    try {
      const payload = buildPayload(editing);
      await saveProduct(vendorId, payload, ownerPassword || undefined);
      setShowForm(false);
      setEditing(EMPTY);
      setOwnerNeeded(false);
      await refresh();
    } catch (e) {
      if (isOwnerRequired(e)) {
        setOwnerNeeded(true);
      } else {
        setErr(e?.response?.data?.detail || "Could not save product");
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product? This action is audited.")) return;
    try {
      await deleteProduct(vendorId, id, ownerPassword || undefined);
      await refresh();
    } catch (e) {
      if (isOwnerRequired(e)) setOwnerNeeded(true);
      else setErr(e?.response?.data?.detail || "Delete failed");
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6" data-testid="erp-products">
        <VendorNav />
        <ErpNav />

        <BackendPendingBanner endpoint="/api/erp/products" note="Data will migrate seamlessly once the API is live." />

        <div className="sc-card p-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search size={16} className="text-[color:var(--sc-ink-muted)]" />
              <input
                type="text"
                placeholder="Search by name, barcode, SKU, category, brand"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 border-none outline-none text-sm bg-transparent"
                data-testid="erp-products-search"
              />
            </div>
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 border border-[color:var(--sc-border)] bg-white text-sm font-semibold"
              data-testid="erp-products-import-btn"
            >
              <Upload size={14} /> Import CSV
            </button>
            <button
              onClick={() => { setEditing(EMPTY); setShowForm(true); setErr(""); }}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 bg-[color:var(--sc-primary)] text-white text-sm font-semibold"
              data-testid="erp-products-add-btn"
            >
              <Plus size={14} /> Add Product
            </button>
          </div>
        </div>

        {loading ? (
          <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading products…</div>
        ) : filtered.length === 0 ? (
          <div className="sc-card p-8 text-center" data-testid="erp-products-empty">
            <Package size={32} className="mx-auto text-[color:var(--sc-ink-muted)]" />
            <div className="mt-2 font-semibold">No products yet</div>
            <div className="text-xs text-[color:var(--sc-ink-muted)]">Add your first product to start billing.</div>
          </div>
        ) : (
          <div className="overflow-x-auto sc-card">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--sc-accent-light)]/40 text-[11px] uppercase text-[color:var(--sc-ink-muted)]">
                <tr>
                  <th className="text-left px-3 py-2">Product</th>
                  <th className="text-left px-3 py-2">HSN</th>
                  <th className="text-right px-3 py-2">MRP</th>
                  <th className="text-right px-3 py-2">Sell ₹</th>
                  <th className="text-right px-3 py-2">Margin</th>
                  <th className="text-right px-3 py-2">Stock</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const low = (p.currentStock || 0) > 0 && (p.currentStock || 0) <= (p.lowStockAlert || 0);
                  const oos = (p.currentStock || 0) === 0;
                  return (
                    <tr key={p._id} className="border-t border-[color:var(--sc-border)]" data-testid={`erp-product-row-${p._id}`}>
                      <td className="px-3 py-2">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-[11px] text-[color:var(--sc-ink-muted)] flex items-center gap-2 flex-wrap">
                          {p.barcode && <span className="inline-flex items-center gap-1"><Barcode size={10} /> {p.barcode}</span>}
                          {p.category && <span className="inline-flex items-center gap-1"><Tag size={10} /> {p.category}</span>}
                          {p.batchNumber && <span>Batch: {p.batchNumber}</span>}
                          {p.expiryDate && <span>Exp: {formatDate(p.expiryDate)}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{p.hsnCode || "—"}</td>
                      <td className="px-3 py-2 text-right">{formatINR(paiseToRupees(p.mrp_paise))}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatINR(paiseToRupees(p.sellingPrice_paise))}</td>
                      <td className="px-3 py-2 text-right">{(p.profitMarginPct || 0).toFixed(1)}%</td>
                      <td className={`px-3 py-2 text-right font-semibold ${oos ? "text-red-600" : low ? "text-amber-600" : "text-emerald-700"}`}>
                        {p.currentStock || 0} {p.unit || "pcs"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => handleEdit(p)} className="text-xs font-semibold text-[color:var(--sc-primary)] mr-3" data-testid={`erp-product-edit-${p._id}`}>Edit</button>
                        <button onClick={() => handleDelete(p._id)} className="text-xs font-semibold text-red-600 inline-flex items-center gap-1" data-testid={`erp-product-delete-${p._id}`}><Trash2 size={12} /> Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showForm && (
          <ProductFormModal
            draft={editing}
            onChange={setEditing}
            onClose={() => { setShowForm(false); setOwnerNeeded(false); setErr(""); }}
            onSave={handleSave}
            err={err}
          />
        )}

        {showImport && (
          <ProductCsvImport
            vendorId={vendorId}
            onClose={() => setShowImport(false)}
            onImported={async () => { setShowImport(false); await refresh(); }}
          />
        )}

        {ownerNeeded && (
          <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4">
            <div className="w-full max-w-md">
              <OwnerLockGate title="Confirm price / cost change">
                {(pwd) => {
                  setOwnerPassword(pwd);
                  setOwnerNeeded(false);
                  // Retry save with password
                  setTimeout(() => handleSave(), 50);
                  return null;
                }}
              </OwnerLockGate>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function ProductFormModal({ draft, onChange, onClose, onSave, err }) {
  const set = (k, v) => onChange({ ...draft, [k]: v });
  return (
    <div className="fixed inset-0 bg-black/40 z-40 grid place-items-center p-4 overflow-y-auto">
      <div className="sc-card w-full max-w-3xl p-5 my-8" data-testid="erp-product-form">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-extrabold">{draft._id ? "Edit product" : "Add new product"}</div>
          <button onClick={onClose} className="text-sm text-[color:var(--sc-ink-muted)]">Close</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Section title="Product Information">
            <Field label="Product Name *"><input type="text" value={draft.name} onChange={(e) => set("name", e.target.value)} className={inputCls} data-testid="erp-form-name" /></Field>
            <Field label="Image URL"><input type="text" value={draft.image} onChange={(e) => set("image", e.target.value)} className={inputCls} /></Field>
            <Field label="Category"><input type="text" value={draft.category} onChange={(e) => set("category", e.target.value)} className={inputCls} /></Field>
            <Field label="Sub Category"><input type="text" value={draft.subCategory} onChange={(e) => set("subCategory", e.target.value)} className={inputCls} /></Field>
            <Field label="Brand"><input type="text" value={draft.brand} onChange={(e) => set("brand", e.target.value)} className={inputCls} /></Field>
            <Field label="Barcode"><input type="text" value={draft.barcode} onChange={(e) => set("barcode", e.target.value)} className={inputCls} /></Field>
            <Field label="SKU"><input type="text" value={draft.sku} onChange={(e) => set("sku", e.target.value)} className={inputCls} /></Field>
            <Field label="HSN / SAC"><input type="text" value={draft.hsnCode} onChange={(e) => set("hsnCode", e.target.value)} className={inputCls} data-testid="erp-form-hsn" /></Field>
            <Field label="Unit">
              <select value={draft.unit} onChange={(e) => set("unit", e.target.value)} className={inputCls}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Description" full>
              <textarea rows={2} value={draft.description} onChange={(e) => set("description", e.target.value)} className={inputCls} />
            </Field>
          </Section>

          <Section title="Purchase Information">
            <Field label="Supplier Name"><input type="text" value={draft.supplierName} onChange={(e) => set("supplierName", e.target.value)} className={inputCls} /></Field>
            <Field label="Supplier GSTIN"><input type="text" value={draft.supplierGstin} onChange={(e) => set("supplierGstin", e.target.value)} className={inputCls} /></Field>
            <Field label="Supplier Mobile"><input type="text" value={draft.supplierMobile} onChange={(e) => set("supplierMobile", e.target.value)} className={inputCls} /></Field>
            <Field label="Supplier Address" full><input type="text" value={draft.supplierAddress} onChange={(e) => set("supplierAddress", e.target.value)} className={inputCls} /></Field>
            <Field label="Invoice #"><input type="text" value={draft.purchaseInvoiceNumber} onChange={(e) => set("purchaseInvoiceNumber", e.target.value)} className={inputCls} /></Field>
            <Field label="Purchase Date"><input type="date" value={draft.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} className={inputCls} /></Field>
            <Field label="Purchase Qty"><input type="number" value={draft.purchaseQuantity} onChange={(e) => set("purchaseQuantity", Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Free Qty"><input type="number" value={draft.freeQuantity} onChange={(e) => set("freeQuantity", Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Purchase Price (ex-GST) ₹"><input type="number" step="0.01" value={draft.purchasePriceExGst} onChange={(e) => set("purchasePriceExGst", Number(e.target.value))} className={inputCls} data-testid="erp-form-purchase" /></Field>
            <Field label="GST %">
              <select value={draft.gstPct} onChange={(e) => set("gstPct", Number(e.target.value))} className={inputCls}>
                {GST_SLABS.map((g) => <option key={g} value={g}>{`${g}%`}</option>)}
              </select>
            </Field>
            <Field label="GST Type">
              <select value={draft.gstType} onChange={(e) => set("gstType", e.target.value)} className={inputCls}>
                <option value="CGST_SGST">CGST + SGST (same state)</option>
                <option value="IGST">IGST (inter-state)</option>
              </select>
            </Field>
          </Section>

          <Section title="Selling Information">
            <Field label="MRP ₹"><input type="number" step="0.01" value={draft.mrp} onChange={(e) => set("mrp", Number(e.target.value))} className={inputCls} data-testid="erp-form-mrp" /></Field>
            <Field label="Selling Price ₹"><input type="number" step="0.01" value={draft.sellingPrice} onChange={(e) => set("sellingPrice", Number(e.target.value))} className={inputCls} data-testid="erp-form-selling" /></Field>
            <Field label="Min Selling Price ₹"><input type="number" step="0.01" value={draft.minSellingPrice} onChange={(e) => set("minSellingPrice", Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Discount %"><input type="number" step="0.01" value={draft.discountPct} onChange={(e) => set("discountPct", Number(e.target.value))} className={inputCls} /></Field>
          </Section>

          <Section title="Inventory">
            <Field label="Opening Stock"><input type="number" value={draft.openingStock} onChange={(e) => set("openingStock", Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Current Stock"><input type="number" value={draft.currentStock} onChange={(e) => set("currentStock", Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Reserved Stock"><input type="number" value={draft.reservedStock} onChange={(e) => set("reservedStock", Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Low Stock Alert"><input type="number" value={draft.lowStockAlert} onChange={(e) => set("lowStockAlert", Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Reorder Level"><input type="number" value={draft.reorderLevel} onChange={(e) => set("reorderLevel", Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Batch Number"><input type="text" value={draft.batchNumber} onChange={(e) => set("batchNumber", e.target.value)} className={inputCls} /></Field>
            <Field label="Expiry Date"><input type="date" value={draft.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} className={inputCls} /></Field>
          </Section>
        </div>

        {err && (
          <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="mt-[2px]" /> {err}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm border border-[color:var(--sc-border)]">Cancel</button>
          <button
            onClick={onSave}
            disabled={!draft.name}
            className="rounded-full px-4 py-2 text-sm bg-[color:var(--sc-primary)] text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            data-testid="erp-product-save-btn"
          >
            <Save size={14} /> Save product
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--sc-primary)]/40";

function Section({ title, children }) {
  return (
    <div className="sm:col-span-2">
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[color:var(--sc-ink-muted)] mb-2 mt-2">{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-semibold text-[color:var(--sc-ink)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
