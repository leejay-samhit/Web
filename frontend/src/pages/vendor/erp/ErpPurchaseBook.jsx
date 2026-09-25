import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import DashboardCard from "@/components/erp/DashboardCard";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate } from "@/lib/utils";
import { listPurchases, purchaseSummary, createPurchase, updatePurchase, deletePurchase, paiseToRupees, rupeesToPaise } from "@/lib/erp";
import { BookOpen, Plus, Package, ShoppingCart, IndianRupee, Users, Percent, X, Save, Pencil, Trash2, Download } from "lucide-react";

export default function ErpPurchaseBook() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6" data-testid="erp-purchase-book">
        <VendorNav />
        <ErpNav />
        <OwnerLockGate title="Purchase Book — Owner verification required">
          {(pwd) => <PurchaseBookInner ownerPassword={pwd} />}
        </OwnerLockGate>
      </div>
    </Layout>
  );
}

const EMPTY_ITEM = {
  productName: "", barcode: "", category: "", hsnCode: "",
  quantity: 1, freeQuantity: 0, purchasePriceExGst: 0,
  gstPct: 5, gstType: "CGST_SGST",
  sellingPrice: 0, mrp: 0, batchNumber: "", expiryDate: "",
};

const EMPTY_PURCHASE = {
  purchaseDate: new Date().toISOString().slice(0, 10),
  invoiceNumber: "",
  supplier: { name: "", gstin: "", mobile: "", address: "" },
  items: [{ ...EMPTY_ITEM }],
};

function PurchaseBookInner({ ownerPassword }) {
  const { user } = useAuth();
  const vendorId = user?.id || user?._id || "anon";
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [list, sum] = await Promise.all([
      listPurchases(vendorId, {}, ownerPassword),
      purchaseSummary(vendorId, {}, ownerPassword),
    ]);
    setRows(list);
    setSummary(sum);
    setLoading(false);
  }, [vendorId, ownerPassword]);

  useEffect(() => { refresh(); }, [refresh]);

  const onDeleteRow = async (row) => {
    if (!window.confirm(`Delete purchase entry "${row.productName}"?`)) return;
    await deletePurchase(vendorId, row._id);
    await refresh();
  };

  const [detail, setDetail] = useState(null); // { title, kind }

  const downloadExcel = () => {
    const r = (p) => paiseToRupees(p || 0);
    const entryRows = rows.map((x, i) => ({
      "#": i + 1,
      Date: formatDate(x.purchaseDate),
      Invoice: x.invoiceNumber || "",
      Supplier: x.supplierName || "",
      "Supplier GSTIN": x.supplierGstin || "",
      Product: x.productName || "",
      HSN: x.hsnCode || "",
      Category: x.category || "",
      Qty: x.quantity || 0,
      "Free Qty": x.freeQuantity || 0,
      "Rate ex-GST": r(x.purchasePriceExGst_paise),
      "GST %": x.gstPct || 0,
      "GST Amount": r(x.gstAmount_paise) * (x.quantity || 0),
      "Rate inc-GST": r(x.purchasePriceIncGst_paise),
      "Total Value": r(x.totalPurchaseValue_paise),
      "Selling Price": r(x.sellingPrice_paise),
      "Margin %": Number(x.profitMarginPct || 0).toFixed(1),
    }));
    const summaryRows = summary ? [
      { Metric: "Total purchase value", Value: r(summary.totalPurchaseValue_paise) },
      { Metric: "  · Product Master", Value: r(summary.masterPurchaseValue_paise) },
      { Metric: "  · Purchase entries", Value: r(summary.purchasesValue_paise) },
      { Metric: "Purchase GST paid", Value: r(summary.totalGstPaid_paise) },
      { Metric: "  · Product Master", Value: r(summary.masterPurchaseGst_paise) },
      { Metric: "  · Purchase entries", Value: r(summary.purchasesGst_paise) },
      { Metric: "Inventory value", Value: r(summary.currentInventoryValue_paise) },
      { Metric: "Products", Value: summary.totalProducts },
      { Metric: "Suppliers", Value: summary.totalSuppliers },
      { Metric: "Avg profit margin %", Value: Number(summary.avgProfitMarginPct || 0).toFixed(1) },
    ] : [];
    const wb = XLSX.utils.book_new();
    const wsS = XLSX.utils.json_to_sheet(summaryRows);
    wsS["!cols"] = [{ wch: 28 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsS, "Summary");
    const wsE = XLSX.utils.json_to_sheet(entryRows.length ? entryRows : [{ "#": "", Date: "", Product: "" }]);
    XLSX.utils.book_append_sheet(wb, wsE, "Purchase Entries");
    XLSX.writeFile(wb, `purchase-book-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <>
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <button type="button" className="text-left" onClick={() => setDetail({ title: "Total purchase value — all entries", kind: "entries" })}><DashboardCard icon={ShoppingCart} label="Total purchase value" value={formatINR(paiseToRupees(summary.totalPurchaseValue_paise))} tone="purchase" testId="pb-total-value" hint={`Master ${formatINR(paiseToRupees(summary.masterPurchaseValue_paise || 0))} + Entries ${formatINR(paiseToRupees(summary.purchasesValue_paise || 0))}`} /></button>
          <button type="button" className="text-left" onClick={() => setDetail({ title: "Inventory value", kind: "entries" })}><DashboardCard icon={Package}       label="Inventory value"      value={formatINR(paiseToRupees(summary.currentInventoryValue_paise))} tone="stock" testId="pb-inv-value" /></button>
          <button type="button" className="text-left" onClick={() => setDetail({ title: "Purchase GST — all entries", kind: "entries" })}><DashboardCard icon={IndianRupee}   label="Purchase GST"         value={formatINR(paiseToRupees(summary.totalGstPaid_paise))} tone="gst" testId="pb-gst" hint={`Master ${formatINR(paiseToRupees(summary.masterPurchaseGst_paise || 0))} + Entries ${formatINR(paiseToRupees(summary.purchasesGst_paise || 0))}`} /></button>
          <button type="button" className="text-left" onClick={() => setDetail({ title: "Products purchased", kind: "entries" })}><DashboardCard icon={Package}       label="Products"             value={summary.totalProducts} tone="default" testId="pb-products" hint={`Master ${summary.masterProducts || 0} + Entries ${summary.purchaseProducts || 0}`} /></button>
          <button type="button" className="text-left" onClick={() => setDetail({ title: "Suppliers", kind: "suppliers" })}><DashboardCard icon={Users}         label="Suppliers"            value={summary.totalSuppliers} tone="default" testId="pb-suppliers" /></button>
          <button type="button" className="text-left" onClick={() => setDetail({ title: "Avg profit margin — per product", kind: "margin" })}><DashboardCard icon={Percent}       label="Avg profit margin"    value={`${(summary.avgProfitMarginPct || 0).toFixed(1)}%`} tone="profit" testId="pb-margin" /></button>
        </div>
      )}

      <div className="sc-card p-4 mb-4 flex items-center justify-between">
        <div className="font-extrabold flex items-center gap-2"><BookOpen size={16} /> Purchase entries</div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadExcel}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 border border-[color:var(--sc-border)] text-sm font-semibold hover:bg-[color:var(--sc-accent-light)]/40"
            data-testid="pb-export"
          >
            <Download size={14} /> Download Excel
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 bg-[color:var(--sc-primary)] text-white text-sm font-semibold"
            data-testid="pb-add-btn"
          >
            <Plus size={14} /> New purchase
          </button>
        </div>
      </div>

      {loading ? (
        <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="sc-card p-8 text-center" data-testid="pb-empty">
          <BookOpen size={32} className="mx-auto text-[color:var(--sc-ink-muted)]" />
          <div className="mt-2 font-semibold">No purchases yet</div>
          <div className="text-xs text-[color:var(--sc-ink-muted)]">Add your first supplier invoice to build your purchase book.</div>
        </div>
      ) : (
        <div className="overflow-x-auto sc-card">
          <table className="min-w-full text-sm">
            <thead className="bg-sky-50 text-[11px] uppercase text-sky-700">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Invoice</th>
                <th className="text-left px-3 py-2">Supplier</th>
                <th className="text-left px-3 py-2">Product</th>
                <th className="text-right px-3 py-2">Qty</th>
                <th className="text-right px-3 py-2">Rate (inc GST)</th>
                <th className="text-right px-3 py-2">GST</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-right px-3 py-2">Margin</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-t border-[color:var(--sc-border)]" data-testid={`pb-row-${r._id}`}>
                  <td className="px-3 py-2">{formatDate(r.purchaseDate)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.invoiceNumber}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{r.supplierName || "—"}</div>
                    <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{r.supplierGstin}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{r.productName}</div>
                    <div className="text-[11px] text-[color:var(--sc-ink-muted)]">HSN {r.hsnCode || "—"} · {r.category || ""}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{r.quantity}{r.freeQuantity ? ` + ${r.freeQuantity}` : ""}</td>
                  <td className="px-3 py-2 text-right">{formatINR(paiseToRupees(r.purchasePriceIncGst_paise))}</td>
                  <td className="px-3 py-2 text-right text-amber-700">{r.gstPct}%</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatINR(paiseToRupees(r.totalPurchaseValue_paise))}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{(r.profitMarginPct || 0).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setEditingRow(r)}
                        data-testid={`pb-edit-${r._id}`}
                        title="Edit"
                        className="w-7 h-7 rounded-md text-sky-700 hover:bg-sky-50 grid place-items-center"
                      ><Pencil size={13} /></button>
                      <button
                        onClick={() => onDeleteRow(r)}
                        data-testid={`pb-del-${r._id}`}
                        title="Delete"
                        className="w-7 h-7 rounded-md text-rose-700 hover:bg-rose-50 grid place-items-center"
                      ><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <NewPurchaseModal
          ownerPassword={ownerPassword}
          vendorId={vendorId}
          onClose={() => setShowForm(false)}
          onSaved={async () => { setShowForm(false); await refresh(); }}
        />
      )}
      {editingRow && (
        <NewPurchaseModal
          ownerPassword={ownerPassword}
          vendorId={vendorId}
          initialRow={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={async () => { setEditingRow(null); await refresh(); }}
        />
      )}
      {detail && (
        <PurchaseDetailModal detail={detail} rows={rows} summary={summary} onClose={() => setDetail(null)} />
      )}
    </>
  );
}

function PurchaseDetailModal({ detail, rows, summary, onClose }) {
  const r = (p) => paiseToRupees(p || 0);
  return (
    <div className="fixed inset-0 bg-black/40 z-40 grid place-items-center p-4" onClick={onClose}>
      <div className="sc-card w-full max-w-3xl p-5 my-6 max-h-[85vh] overflow-y-auto" data-testid="pb-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-extrabold">{detail.title}</div>
          <button onClick={onClose} data-testid="pb-detail-close"><X size={18} /></button>
        </div>
        {rows.length === 0 ? (
          <div className="text-sm text-[color:var(--sc-ink-muted)] py-8 text-center">No purchase entries yet.</div>
        ) : detail.kind === "margin" ? (
          <table className="min-w-full text-sm">
            <thead className="bg-emerald-50 text-[11px] uppercase text-emerald-700"><tr><th className="text-left px-3 py-2">Product</th><th className="text-right px-3 py-2">Cost ex-GST</th><th className="text-right px-3 py-2">Selling</th><th className="text-right px-3 py-2">Margin %</th></tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x._id} className="border-t border-[color:var(--sc-border)]">
                  <td className="px-3 py-2">{x.productName}</td>
                  <td className="px-3 py-2 text-right">{formatINR(r(x.purchasePriceExGst_paise))}</td>
                  <td className="px-3 py-2 text-right">{formatINR(r(x.sellingPrice_paise))}</td>
                  <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{Number(x.profitMarginPct || 0).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t-2 border-[color:var(--sc-border)] font-extrabold"><td className="px-3 py-2" colSpan={3}>Average margin</td><td className="px-3 py-2 text-right text-emerald-700">{(summary?.avgProfitMarginPct || 0).toFixed(1)}%</td></tr></tfoot>
          </table>
        ) : detail.kind === "suppliers" ? (
          <table className="min-w-full text-sm">
            <thead className="bg-sky-50 text-[11px] uppercase text-sky-700"><tr><th className="text-left px-3 py-2">Supplier</th><th className="text-left px-3 py-2">GSTIN</th><th className="text-right px-3 py-2">Entries</th></tr></thead>
            <tbody>
              {Object.values(rows.reduce((acc, x) => {
                const k = x.supplierName || "—";
                acc[k] = acc[k] || { name: k, gstin: x.supplierGstin || "", n: 0 };
                acc[k].n += 1; return acc;
              }, {})).map((s) => (
                <tr key={s.name} className="border-t border-[color:var(--sc-border)]"><td className="px-3 py-2">{s.name}</td><td className="px-3 py-2 font-mono text-xs">{s.gstin || "—"}</td><td className="px-3 py-2 text-right">{s.n}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-sky-50 text-[11px] uppercase text-sky-700"><tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Product</th><th className="text-right px-3 py-2">Qty</th><th className="text-right px-3 py-2">GST</th><th className="text-right px-3 py-2">Total</th></tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x._id} className="border-t border-[color:var(--sc-border)]">
                  <td className="px-3 py-2">{formatDate(x.purchaseDate)}</td>
                  <td className="px-3 py-2">{x.productName}</td>
                  <td className="px-3 py-2 text-right">{x.quantity}</td>
                  <td className="px-3 py-2 text-right text-amber-700">{formatINR(r(x.gstAmount_paise) * (x.quantity || 0))}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatINR(r(x.totalPurchaseValue_paise))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function NewPurchaseModal({ ownerPassword, vendorId, initialRow = null, onClose, onSaved }) {
  const isEdit = !!initialRow;
  const [draft, setDraft] = useState(() => {
    if (!initialRow) return EMPTY_PURCHASE;
    // Rehydrate a single-row edit into the modal shape.
    return {
      purchaseDate: initialRow.purchaseDate || new Date().toISOString().slice(0, 10),
      invoiceNumber: initialRow.invoiceNumber || "",
      supplier: {
        name: initialRow.supplierName || "",
        gstin: initialRow.supplierGstin || "",
        mobile: initialRow.supplierMobile || "",
        address: initialRow.supplierAddress || "",
      },
      items: [{
        productName: initialRow.productName || "",
        barcode: initialRow.barcode || "",
        category: initialRow.category || "",
        hsnCode: initialRow.hsnCode || "",
        quantity: initialRow.quantity || 1,
        freeQuantity: initialRow.freeQuantity || 0,
        purchasePriceExGst: paiseToRupees(initialRow.purchasePriceExGst_paise || 0),
        gstPct: initialRow.gstPct || 0,
        gstType: initialRow.gstType || "CGST_SGST",
        sellingPrice: paiseToRupees(initialRow.sellingPrice_paise || 0),
        mrp: paiseToRupees(initialRow.mrp_paise || 0),
        batchNumber: initialRow.batchNumber || "",
        expiryDate: initialRow.expiryDate || "",
      }],
    };
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const setItem = (i, k, v) => {
    const items = draft.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it));
    setDraft({ ...draft, items });
  };
  const addItem = () => setDraft({ ...draft, items: [...draft.items, { ...EMPTY_ITEM }] });
  const removeItem = (i) => setDraft({ ...draft, items: draft.items.filter((_, idx) => idx !== i) });

  const total = useMemo(() => draft.items.reduce((s, it) => {
    const ex = rupeesToPaise(it.purchasePriceExGst);
    const gst = Math.round(ex * (Number(it.gstPct) || 0) / 100);
    return s + (ex + gst) * (Number(it.quantity) || 0);
  }, 0), [draft.items]);

  const save = async () => {
    setErr("");
    setBusy(true);
    try {
      const payload = {
        purchaseDate: draft.purchaseDate,
        invoiceNumber: draft.invoiceNumber,
        supplier: draft.supplier,
        items: draft.items.map((it) => ({
          productName: it.productName,
          barcode: it.barcode,
          category: it.category,
          hsnCode: it.hsnCode,
          quantity: Number(it.quantity),
          freeQuantity: Number(it.freeQuantity),
          purchasePriceExGst_paise: rupeesToPaise(it.purchasePriceExGst),
          gstPct: Number(it.gstPct),
          gstType: it.gstType,
          sellingPrice_paise: rupeesToPaise(it.sellingPrice),
          mrp_paise: rupeesToPaise(it.mrp),
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate || null,
        })),
      };
      await createPurchase(vendorId, payload, ownerPassword);
      await onSaved();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not save purchase");
    } finally {
      setBusy(false);
    }
  };

  // Route through updatePurchase when editing an existing row.
  const saveEdit = async () => {
    setErr(""); setBusy(true);
    try {
      const it = draft.items[0];
      const payload = {
        purchaseDate: draft.purchaseDate,
        invoiceNumber: draft.invoiceNumber,
        supplier: draft.supplier,
        items: [{
          productName: it.productName, barcode: it.barcode, category: it.category, hsnCode: it.hsnCode,
          quantity: Number(it.quantity), freeQuantity: Number(it.freeQuantity),
          purchasePriceExGst_paise: rupeesToPaise(it.purchasePriceExGst),
          gstPct: Number(it.gstPct), gstType: it.gstType,
          sellingPrice_paise: rupeesToPaise(it.sellingPrice),
          mrp_paise: rupeesToPaise(it.mrp),
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate || null,
        }],
      };
      await updatePurchase(vendorId, initialRow._id, payload);
      await onSaved();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not save purchase");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-40 grid place-items-center p-4 overflow-y-auto">
      <div className="sc-card w-full max-w-4xl p-5 my-6" data-testid="pb-form">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-extrabold">{isEdit ? "Edit purchase entry" : "New purchase invoice"}</div>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <Field label="Purchase date"><input type="date" value={draft.purchaseDate} onChange={(e) => setDraft({ ...draft, purchaseDate: e.target.value })} className={inputCls} /></Field>
          <Field label="Invoice #"><input type="text" value={draft.invoiceNumber} onChange={(e) => setDraft({ ...draft, invoiceNumber: e.target.value })} className={inputCls} data-testid="pb-form-invoice" /></Field>
          <Field label="Supplier name"><input type="text" value={draft.supplier.name} onChange={(e) => setDraft({ ...draft, supplier: { ...draft.supplier, name: e.target.value } })} className={inputCls} data-testid="pb-form-supplier" /></Field>
          <Field label="Supplier GSTIN"><input type="text" value={draft.supplier.gstin} onChange={(e) => setDraft({ ...draft, supplier: { ...draft.supplier, gstin: e.target.value } })} className={inputCls} /></Field>
          <Field label="Supplier mobile"><input type="text" value={draft.supplier.mobile} onChange={(e) => setDraft({ ...draft, supplier: { ...draft.supplier, mobile: e.target.value } })} className={inputCls} /></Field>
          <Field label="Supplier address"><input type="text" value={draft.supplier.address} onChange={(e) => setDraft({ ...draft, supplier: { ...draft.supplier, address: e.target.value } })} className={inputCls} /></Field>
        </div>

        <div className="text-xs font-semibold text-[color:var(--sc-ink-muted)] uppercase tracking-wider mb-2">Line items</div>
        <div className="space-y-2 mb-3">
          {draft.items.map((it, i) => (
            <div key={i} className="sc-card p-3 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <Field label="Product name"><input type="text" value={it.productName} onChange={(e) => setItem(i, "productName", e.target.value)} className={inputCls} data-testid={`pb-item-name-${i}`} /></Field>
                <Field label="Barcode"><input type="text" value={it.barcode} onChange={(e) => setItem(i, "barcode", e.target.value)} className={inputCls} /></Field>
                <Field label="Category"><input type="text" value={it.category} onChange={(e) => setItem(i, "category", e.target.value)} className={inputCls} /></Field>
                <Field label="HSN"><input type="text" value={it.hsnCode} onChange={(e) => setItem(i, "hsnCode", e.target.value)} className={inputCls} /></Field>
                <Field label="Qty"><input type="number" value={it.quantity} onChange={(e) => setItem(i, "quantity", Number(e.target.value))} className={inputCls} /></Field>
                <Field label="Free qty"><input type="number" value={it.freeQuantity} onChange={(e) => setItem(i, "freeQuantity", Number(e.target.value))} className={inputCls} /></Field>
                <Field label="Purchase ex-GST ₹"><input type="number" step="0.01" value={it.purchasePriceExGst} onChange={(e) => setItem(i, "purchasePriceExGst", Number(e.target.value))} className={inputCls} /></Field>
                <Field label="GST %"><input type="number" step="0.01" value={it.gstPct} onChange={(e) => setItem(i, "gstPct", Number(e.target.value))} className={inputCls} /></Field>
                <Field label="Selling ₹"><input type="number" step="0.01" value={it.sellingPrice} onChange={(e) => setItem(i, "sellingPrice", Number(e.target.value))} className={inputCls} /></Field>
                <Field label="MRP ₹"><input type="number" step="0.01" value={it.mrp} onChange={(e) => setItem(i, "mrp", Number(e.target.value))} className={inputCls} /></Field>
                <Field label="Batch"><input type="text" value={it.batchNumber} onChange={(e) => setItem(i, "batchNumber", e.target.value)} className={inputCls} /></Field>
                <Field label="Expiry"><input type="date" value={it.expiryDate} onChange={(e) => setItem(i, "expiryDate", e.target.value)} className={inputCls} /></Field>
              </div>
              {draft.items.length > 1 && (
                <div className="text-right mt-1">
                  <button onClick={() => removeItem(i)} className="text-xs font-semibold text-red-600">Remove line</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3">
          <button onClick={addItem} className="text-xs font-semibold text-[color:var(--sc-primary)] inline-flex items-center gap-1"><Plus size={12} /> Add another line</button>
          <div className="text-sm font-extrabold">Total incl. GST: <span className="text-emerald-700">{formatINR(paiseToRupees(total))}</span></div>
        </div>

        {err && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">{err}</div>}

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm border border-[color:var(--sc-border)]">Cancel</button>
          <button onClick={isEdit ? saveEdit : save} disabled={busy || !draft.invoiceNumber} className="rounded-full px-4 py-2 text-sm bg-[color:var(--sc-primary)] text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-50" data-testid="pb-save-btn">
            <Save size={14} /> {busy ? "Saving…" : (isEdit ? "Save changes" : "Save purchase")}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--sc-primary)]/40";
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-[color:var(--sc-ink)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
