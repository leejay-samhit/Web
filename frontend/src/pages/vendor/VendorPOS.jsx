import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { useAuth } from "@/context/AuthContext";
import { formatINR, resolveImageUrl } from "@/lib/utils";
import { log } from "@/lib/log";
import { printInvoice } from "@/lib/invoicePrint";
import {
  GST_SLABS, computeTotals, createInvoice, getSettings, peekNextInvoiceNumber, saveCustomer, listCustomers,
} from "@/lib/vendorSales";
import {
  Search, Plus, Minus, Trash2, X, Receipt, CheckCircle2, Loader2, ShoppingCart, IndianRupee, Printer,
  Banknote, Smartphone, CreditCard, BookUser,
} from "lucide-react";
import VendorNav from "@/components/vendor/VendorNav";

// Collect-payment options — Cash / UPI / Card only (user decision Aug-2026).
// Card is stored under the "credit" ledger key so it still lands in the
// Sales-dashboard payment breakdown.
const PAY_OPTIONS = [
  { key: "cash", label: "Cash", store: "cash", icon: Banknote, color: "#0F6E4F", refLabel: "" },
  { key: "upi", label: "UPI", store: "upi", icon: Smartphone, color: "#0891B2", refLabel: "UPI reference / txn ID" },
  { key: "card", label: "Card", store: "credit", icon: CreditCard, color: "#7C3AED", refLabel: "Card reference / last 4 digits" },
];

export default function VendorPOS() {
  const { user } = useAuth();
  const uid = user?.id;
  const nav = useNavigate();

  const [products, setProducts] = useState([]);
  const [loadingProds, setLoadingProds] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [billDiscount, setBillDiscount] = useState("");
  const [roundOff, setRoundOff] = useState(true);
  const [gstInclusive, setGstInclusive] = useState(false);
  const [customer, setCustomer] = useState({ kind: "walkin", name: "", phone: "", gstin: "", address: "" });
  // Collect-payment state (single mode + reference + remarks)
  const [payMode, setPayMode] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [payRemarks, setPayRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const searchRef = useRef(null);

  // Load vendor products on mount
  const loadProducts = useCallback(async () => {
    setLoadingProds(true);
    setLoadError("");
    try {
      const { data } = await api.get("/vendor/me/products");
      setProducts(data?.items || data || []);
    } catch (e) {
      log.error("VendorPOS.loadProducts failed", e);
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      if (status === 403) {
        setLoadError(detail || "Your account is not an approved vendor on the catalog service, so no products could be loaded.");
      } else {
        setLoadError(detail || "Could not load your products. Please check your connection and try again.");
      }
    } finally { setLoadingProds(false); }
  }, []);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  const settings = useMemo(() => getSettings(uid), [uid]);
  const [customerBook, setCustomerBook] = useState(() => listCustomers(uid));
  useEffect(() => { setCustomerBook(listCustomers(uid)); }, [uid]);
  const previewInvoiceNo = useMemo(() => peekNextInvoiceNumber(uid), [uid, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Searchable list (memoized)
  const searchHits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter((p) =>
        (p.name || "").toLowerCase().includes(term) ||
        (p.barcode || "").toLowerCase().includes(term) ||
        (p.sku || "").toLowerCase().includes(term) ||
        (p.category || "").toLowerCase().includes(term) ||
        (p.serial_number || "").toLowerCase().includes(term) ||
        (p.imei_1 || "").toLowerCase().includes(term) ||
        (p.imei_2 || "").toLowerCase().includes(term) ||
        (Array.isArray(p.serial_numbers) && p.serial_numbers.some((s) => (s || "").toLowerCase().includes(term))) ||
        (Array.isArray(p.imei_numbers) && p.imei_numbers.some((s) => (s || "").toLowerCase().includes(term)))
      )
      .slice(0, 12);
  }, [q, products]);

  // Add product to current bill
  const addProduct = (p) => {
    setItems((cur) => {
      const idx = cur.findIndex((it) => it.product_id === p.id);
      if (idx >= 0) {
        const next = [...cur];
        const it = { ...next[idx] };
        if (it.qty + 1 > (it.stock_before || Infinity)) return cur; // OOS guard
        it.qty += 1;
        next[idx] = it;
        return next;
      }
      return [...cur, {
        product_id: p.id,
        name: p.name,
        unit: p.unit || "pc",
        price: Number(p.price) || 0,
        gst_pct: Number(p.gst_pct ?? settings.default_gst_pct ?? 18),
        hsn: p.hsn || "",
        qty: 1,
        discount: "",
        commission: "",
        stock_before: Number(p.stock ?? 0),
        cost: Number(p.cost_price ?? 0),
      }];
    });
    setQ("");
    setTimeout(() => searchRef.current?.focus(), 30);
  };

  const updateItem = (idx, patch) =>
    setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const incQty = (idx) => setItems((cur) => cur.map((it, i) => {
    if (i !== idx) return it;
    const maxStock = it.stock_before || Infinity;
    return { ...it, qty: Math.min(it.qty + 1, maxStock) };
  }));
  const decQty = (idx) => setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, qty: Math.max(1, it.qty - 1) } : it)));
  const removeItem = (idx) => setItems((cur) => cur.filter((_, i) => i !== idx));

  const totals = useMemo(
    () => computeTotals(items, { totalDiscount: billDiscount, roundOff, gstInclusive }),
    [items, billDiscount, roundOff, gstInclusive]
  );

  const reset = () => {
    setItems([]); setBillDiscount(""); setCustomer({ kind: "walkin", name: "", phone: "", gstin: "", address: "" });
    setPayMode("cash"); setPayRef(""); setPayRemarks(""); setError(""); setShowCheckout(false);
  };

  const openCheckout = () => {
    setPayMode("cash"); setPayRef(""); setPayRemarks(""); setError("");
    setShowCheckout(true);
  };

  const activeOption = PAY_OPTIONS.find((o) => o.key === payMode) || PAY_OPTIONS[0];

  const checkout = async () => {
    setError("");
    if (items.length === 0) return setError("Add at least one item to the bill.");
    const opt = activeOption;
    const payments = [{
      mode: opt.store,
      mode_label: opt.label,
      amount: totals.grand_total,
      reference: payRef.trim(),
      remarks: payRemarks.trim(),
    }];
    // Compute profit (revenue - cost) using line cost when available.
    const profit = items.reduce((s, it) => s + ((Number(it.line_total || 0) - Number(it.cost || 0) * Number(it.qty || 0))), 0);
    const draft = {
      items: totals.lines,
      totals: { ...totals, profit: Math.round(profit * 100) / 100 },
      payments,
      customer: customer.kind === "walkin" ? { kind: "walkin", name: "Walk-in Customer" } : customer,
      gst_inclusive: gstInclusive,
      vendor_id: uid,
      notes: payRemarks.trim(),
    };
    setSaving(true);
    try {
      const inv = await createInvoice(uid, draft);
      // Save named customer to the Customer Book on every Collect & Complete.
      if (customer.kind === "named" && (customer.name.trim() || customer.phone.trim())) {
        saveCustomer(uid, {
          name: customer.name, phone: customer.phone, gstin: customer.gstin,
          address: customer.address, amount: totals.grand_total,
        });
        setCustomerBook(listCustomers(uid));
      }
      setSuccess(inv);
      // Refresh products to reflect updated stock counts coming back from the API.
      loadProducts();
    } catch (e) {
      setError(e?.message || "Could not save invoice.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingProds) return <Layout title="Vendor · POS billing"><VendorNav /><Spinner /></Layout>;

  return (
    <Layout title="Vendor · POS billing">
      <VendorNav />

      {loadError && (
        <div data-testid="pos-load-error" className="sc-card p-3 mb-3 text-sm font-semibold text-[color:var(--sc-error)] bg-red-50 border border-red-100 flex items-start gap-2">
          <span className="mt-0.5">⚠️</span>
          <div>
            <div>{loadError}</div>
            <button onClick={loadProducts} className="mt-1 text-xs underline text-[color:var(--sc-primary)]" data-testid="pos-load-retry">Retry</button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        {/* ============================ LEFT: bill ============================ */}
        <div className="space-y-3">
          {/* Search */}
          <div className="sc-card p-3" data-testid="pos-search-card">
            <div className="flex items-center gap-2">
              <Search size={18} className="text-[color:var(--sc-ink-muted)]" />
              <input
                ref={searchRef}
                data-testid="pos-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search product · scan barcode · or type SKU…"
                autoFocus
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <span className="text-[10px] uppercase tracking-wider text-[color:var(--sc-ink-muted)] hidden md:inline">Esc to clear</span>
            </div>
            {searchHits.length > 0 && (
              <div className="mt-2 border border-[color:var(--sc-border)] rounded-xl divide-y divide-[color:var(--sc-border)] bg-white max-h-72 overflow-y-auto" data-testid="pos-hits">
                {searchHits.map((p) => {
                  const oos = Number(p.stock ?? 0) <= 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => !oos && addProduct(p)}
                      disabled={oos}
                      data-testid={`pos-hit-${p.id}`}
                      className={`w-full text-left px-3 py-2 flex items-center gap-3 ${oos ? "opacity-50 cursor-not-allowed" : "hover:bg-[color:var(--sc-accent-light)]/40"}`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-[color:var(--sc-accent-light)] overflow-hidden shrink-0">
                        {p.image_url && <img alt="" src={resolveImageUrl(p.image_url)} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{p.name}</div>
                        <div className="text-[11px] text-[color:var(--sc-ink-muted)] truncate">
                          Stock: {p.stock ?? 0} {p.unit || ""} · GST {p.gst_pct ?? settings.default_gst_pct}% {p.category ? `· ${p.category}` : ""}
                        </div>
                      </div>
                      <div className="text-sm font-extrabold text-[color:var(--sc-primary)]">{formatINR(p.price)}</div>
                      {oos && <span className="sc-chip" style={{ background: "#FDECEC", color: "#B42318" }}>OOS</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {q && searchHits.length === 0 && <div className="text-xs text-[color:var(--sc-ink-muted)] mt-2">No matches.</div>}
          </div>

          {/* Bill items */}
          <div className="sc-card p-0 overflow-hidden" data-testid="pos-bill">
            <div className="px-4 py-3 border-b border-[color:var(--sc-border)] flex items-center justify-between bg-[color:var(--sc-accent-light)]/40">
              <div>
                <div className="font-extrabold text-sm flex items-center gap-1.5"><Receipt size={14} /> {previewInvoiceNo}</div>
                <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{items.length} items · {settings.business_name || "My shop"}</div>
              </div>
              <label className="text-xs inline-flex items-center gap-1.5">
                <input type="checkbox" data-testid="pos-gst-inclusive" checked={gstInclusive} onChange={(e) => setGstInclusive(e.target.checked)} />
                GST inclusive
              </label>
            </div>
            {items.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-[color:var(--sc-ink-muted)]">
                <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
                Start by searching a product above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white text-[color:var(--sc-ink-muted)]">
                    <tr>
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-center px-2 py-2 w-32">Qty</th>
                      <th className="text-right px-2 py-2">Price</th>
                      <th className="text-right px-2 py-2">Disc</th>
                      <th className="text-right px-2 py-2">GST</th>
                      <th className="text-right px-2 py-2">Comm%</th>
                      <th className="text-right px-2 py-2">Total</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.lines.map((it, idx) => (
                      <tr key={`${it.product_id}-${idx}`} className="border-t border-[color:var(--sc-border)]" data-testid={`pos-line-${idx}`}>
                        <td className="px-3 py-2">
                          <div className="font-semibold">{it.name}</div>
                          <div className="text-[10px] text-[color:var(--sc-ink-muted)]">Stock: {it.stock_before}</div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="inline-flex items-center gap-1 border border-[color:var(--sc-border)] rounded-lg">
                            <button onClick={() => decQty(idx)} data-testid={`pos-dec-${idx}`} className="px-1.5 py-1 hover:bg-[color:var(--sc-accent-light)]"><Minus size={12} /></button>
                            <input
                              type="number"
                              data-testid={`pos-qty-${idx}`}
                              value={it.qty}
                              onChange={(e) => updateItem(idx, { qty: Math.max(0, Math.min(Number(e.target.value || 0), it.stock_before)) })}
                              className="w-10 text-center text-xs outline-none bg-transparent"
                            />
                            <button onClick={() => incQty(idx)} data-testid={`pos-inc-${idx}`} className="px-1.5 py-1 hover:bg-[color:var(--sc-accent-light)]"><Plus size={12} /></button>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            data-testid={`pos-price-${idx}`}
                            value={it.price}
                            onChange={(e) => updateItem(idx, { price: Number(e.target.value || 0) })}
                            className="w-20 text-right border border-[color:var(--sc-border)] rounded px-1 py-0.5 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            data-testid={`pos-disc-${idx}`}
                            value={it.discount || ""}
                            onChange={(e) => updateItem(idx, { discount: e.target.value })}
                            placeholder="0 or 5%"
                            className="w-16 text-right border border-[color:var(--sc-border)] rounded px-1 py-0.5 text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <select
                            data-testid={`pos-gst-${idx}`}
                            value={Number(it.gst_pct)}
                            onChange={(e) => updateItem(idx, { gst_pct: Number(e.target.value) })}
                            className="w-16 text-right border border-[color:var(--sc-border)] rounded px-1 py-1 text-xs bg-white"
                          >
                            {GST_SLABS.map((g) => <option key={g} value={g}>{g}%</option>)}
                            {!GST_SLABS.includes(Number(it.gst_pct)) && <option value={Number(it.gst_pct)}>{it.gst_pct}%</option>}
                          </select>
                          <div className="text-[10px] text-[color:var(--sc-ink-muted)]">{formatINR(it.tax_amount)}</div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            data-testid={`pos-comm-${idx}`}
                            value={it.commission || ""}
                            onChange={(e) => updateItem(idx, { commission: e.target.value })}
                            placeholder="0"
                            className="w-14 text-right border border-[color:var(--sc-border)] rounded px-1 py-0.5 text-xs"
                          />
                          {it.commission_amount > 0 && <div className="text-[10px] text-[color:var(--sc-ink-muted)]">{formatINR(it.commission_amount)}</div>}
                        </td>
                        <td className="px-2 py-2 text-right font-bold">{formatINR(it.line_total)}</td>
                        <td className="px-2 py-2">
                          <button onClick={() => removeItem(idx)} data-testid={`pos-del-${idx}`} className="text-[color:var(--sc-error)]"><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ============================ RIGHT: totals + checkout ============================ */}
        <div className="space-y-3">
          <div className="sc-card p-4" data-testid="pos-totals">
            <div className="font-extrabold text-sm mb-2">Totals</div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold">{formatINR(totals.display_subtotal)}</span></div>
              {totals.commission_total > 0 && <div className="flex justify-between"><span>Commission</span><span className="font-semibold">{formatINR(totals.commission_total)}</span></div>}
              {totals.discount_total > 0 && <div className="flex justify-between"><span>Discount</span><span className="font-semibold text-[color:var(--sc-error)]">-{formatINR(totals.discount_total)}</span></div>}
              <div className="flex justify-between"><span>GST total</span><span className="font-semibold">{formatINR(totals.gst_total)}</span></div>
              {totals.round_off !== 0 && <div className="flex justify-between"><span>Round off</span><span className="font-semibold">{formatINR(totals.round_off)}</span></div>}
              {gstInclusive && <div className="text-[10px] text-[color:var(--sc-ink-muted)]">Prices are GST-inclusive · grand total = MRP shown on items.</div>}
              <div className="flex justify-between text-base border-t border-[color:var(--sc-border)] pt-1.5 mt-1.5"><span className="font-extrabold">Grand total</span><span className="font-extrabold text-[color:var(--sc-primary)]" data-testid="pos-grand-total">{formatINR(totals.grand_total)}</span></div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input
                data-testid="pos-bill-discount"
                value={billDiscount}
                onChange={(e) => setBillDiscount(e.target.value)}
                placeholder="Bill discount (₹ or %)"
                className="sc-input text-xs"
              />
            </div>
            <label className="text-xs mt-2 inline-flex items-center gap-1.5">
              <input type="checkbox" data-testid="pos-round-off" checked={roundOff} onChange={(e) => setRoundOff(e.target.checked)} />
              Round-off grand total
            </label>
          </div>

          <div className="sc-card p-4" data-testid="pos-customer">
            <div className="font-extrabold text-sm mb-2">Customer</div>
            <div className="flex flex-wrap gap-2 mb-2">
              <button data-testid="pos-cust-walkin" onClick={() => setCustomer({ ...customer, kind: "walkin" })} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${customer.kind === "walkin" ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}>Walk-in</button>
              <button data-testid="pos-cust-named" onClick={() => setCustomer({ ...customer, kind: "named" })} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${customer.kind === "named" ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}>Named customer</button>
              {customerBook.length > 0 && (
                <button data-testid="pos-cust-select" onClick={() => setCustomer({ ...customer, kind: "select" })} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${customer.kind === "select" ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}>Select customer</button>
              )}
            </div>
            {customer.kind === "select" && (
              <select
                data-testid="pos-cust-book-select"
                className="sc-input text-xs mb-2"
                defaultValue=""
                onChange={(e) => {
                  const c = customerBook.find((x) => x.id === e.target.value);
                  if (c) setCustomer({ kind: "named", name: c.name || "", phone: c.phone || "", gstin: c.gstin || "", address: c.address || "" });
                }}
              >
                <option value="" disabled>Pick a saved customer…</option>
                {customerBook.map((c) => (
                  <option key={c.id} value={c.id}>{c.name || "—"}{c.phone ? ` · ${c.phone}` : ""}</option>
                ))}
              </select>
            )}
            {customer.kind === "named" ? (
              <div className="space-y-2">
                <input data-testid="pos-cust-name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Name" className="sc-input text-xs" />
                <input data-testid="pos-cust-phone" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="Phone" className="sc-input text-xs" />
                <input data-testid="pos-cust-gstin" value={customer.gstin} onChange={(e) => setCustomer({ ...customer, gstin: e.target.value })} placeholder="GSTIN (optional)" className="sc-input text-xs" />
                <input data-testid="pos-cust-address" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="Address" className="sc-input text-xs" />
                <div className="text-[10px] text-[color:var(--sc-primary)] inline-flex items-center gap-1"><BookUser size={11} /> Saved to your Customer Book on complete.</div>
              </div>
            ) : null}
          </div>

          <button
            data-testid="pos-checkout-open"
            disabled={items.length === 0}
            onClick={openCheckout}
            className="sc-btn-primary w-full text-sm inline-flex items-center justify-center gap-1.5"
          >
            <IndianRupee size={14} /> Collect & complete · {formatINR(totals.grand_total)}
          </button>

          {error && !showCheckout && <div data-testid="pos-error" className="sc-card p-3 text-xs font-semibold text-[color:var(--sc-error)] bg-red-50 border-red-100">{error}</div>}
        </div>
      </div>

      {/* ============================ Collect Payment — hero card ============================ */}
      {showCheckout && !success && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setShowCheckout(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden sc-fade-in shadow-2xl" data-testid="pos-checkout-modal" onClick={(e) => e.stopPropagation()}>
            {/* Hero header */}
            <div className="relative p-6 text-white" style={{ background: "linear-gradient(135deg,#0F6E4F 0%,#0B5A40 100%)" }}>
              <button onClick={() => setShowCheckout(false)} className="absolute top-4 right-4 text-white/80 hover:text-white" data-testid="pos-checkout-close"><X size={18} /></button>
              <div className="text-[11px] uppercase tracking-widest font-bold opacity-80">Amount to collect</div>
              <div className="text-4xl font-extrabold mt-1" data-testid="pos-hero-amount">{formatINR(totals.grand_total)}</div>
              <div className="text-[11px] opacity-80 mt-1">
                {customer.kind === "named" ? (customer.name || "Named customer") : "Walk-in customer"} · {items.length} item{items.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Payment mode chooser */}
              <div>
                <div className="text-[11px] uppercase tracking-widest font-bold text-[color:var(--sc-ink-muted)] mb-2">Payment mode</div>
                <div className="grid grid-cols-3 gap-2" data-testid="pos-pay-modes">
                  {PAY_OPTIONS.map((o) => {
                    const active = payMode === o.key;
                    return (
                      <button
                        key={o.key}
                        data-testid={`pos-pay-mode-${o.key}`}
                        onClick={() => { setPayMode(o.key); setPayRef(""); }}
                        className={`rounded-2xl border-2 p-3 flex flex-col items-center gap-1.5 transition ${active ? "text-white shadow-md" : "bg-white text-[color:var(--sc-ink)] border-[color:var(--sc-border)] hover:border-[color:var(--sc-primary)]"}`}
                        style={active ? { background: o.color, borderColor: o.color } : {}}
                      >
                        <o.icon size={20} />
                        <span className="text-xs font-bold">{o.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reference (UPI / Card only) */}
              {activeOption.refLabel && (
                <div>
                  <label className="text-[11px] uppercase tracking-widest font-bold text-[color:var(--sc-ink-muted)]">{activeOption.refLabel}</label>
                  <input
                    data-testid="pos-pay-ref"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder={activeOption.key === "upi" ? "e.g. 4021XXXX / UTR" : "e.g. **** 1234"}
                    className="sc-input text-sm mt-1"
                  />
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="text-[11px] uppercase tracking-widest font-bold text-[color:var(--sc-ink-muted)]">Remarks (optional)</label>
                <textarea
                  data-testid="pos-pay-remarks"
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  rows={2}
                  placeholder="Any note for this bill…"
                  className="sc-input text-sm mt-1 resize-none"
                />
              </div>

              {error && <div data-testid="pos-checkout-error" className="text-xs font-semibold text-[color:var(--sc-error)] bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">{error}</div>}

              <button
                data-testid="pos-checkout-confirm"
                disabled={saving}
                onClick={checkout}
                className="sc-btn-primary w-full inline-flex items-center justify-center gap-1.5 py-3 text-sm"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                Confirm {activeOption.label} · {formatINR(totals.grand_total)}
              </button>
              <div className="text-[10px] text-[color:var(--sc-ink-muted)] text-center">Stock will be deducted from your live inventory once the bill is saved.</div>
            </div>
          </div>
        </div>
      )}

      {/* ============================ Success modal ============================ */}
      {success && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 text-center sc-fade-in" data-testid="pos-success-modal">
            <CheckCircle2 size={42} className="text-[color:var(--sc-primary)] mx-auto mb-2" />
            <div className="font-extrabold text-lg">Invoice {success.invoice_no}</div>
            <div className="text-xs text-[color:var(--sc-ink-muted)] mb-3">Saved · {formatINR(success.totals?.grand_total)} · stock updated</div>
            <div className="flex flex-col gap-2">
              <button data-testid="pos-print" onClick={() => printInvoice(success, settings)} className="sc-btn-primary inline-flex items-center justify-center gap-1.5"><Printer size={14} /> Print / save PDF</button>
              <button data-testid="pos-new" onClick={() => { setSuccess(null); reset(); }} className="sc-btn-outline">New sale</button>
              <button onClick={() => nav("/vendor/invoices")} className="text-xs font-semibold text-[color:var(--sc-primary)]">Open invoice history →</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
