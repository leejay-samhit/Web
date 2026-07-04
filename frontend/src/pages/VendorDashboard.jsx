import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { formatINR, formatDateTime } from "@/lib/utils";
import { Store, Package, TrendingUp, MessageSquare, Plus, X, Loader2, Pencil, Trash2, Search, Sparkles, Check, Info } from "lucide-react";
import { log } from "@/lib/log";
import VendorNav from "@/components/vendor/VendorNav";
import DeviceIdentitySection, { validateDeviceIdentity } from "@/components/DeviceIdentitySection";
import { searchMaster, getMaster, reportMasterHit } from "@/lib/productMaster";

const CONDITIONS = [
  { key: "new", label: "New" },
  { key: "refurbished", label: "Refurbished" },
  { key: "used_like_new", label: "Used · like new" },
  { key: "used_good", label: "Used · good" },
  { key: "used_fair", label: "Used · fair" },
];

const TABS = [
  { key: "products", label: "Products", icon: Package },
  { key: "sales", label: "Sales", icon: TrendingUp },
  { key: "questions", label: "Q&A", icon: MessageSquare },
];

function Stats({ stats }) {
  if (!stats) return null;
  const items = [
    { label: "Total products", val: stats.total_products ?? 0 },
    { label: "Total sales", val: formatINR(stats.total_sales ?? 0) },
    { label: "Pending questions", val: stats.pending_questions ?? 0 },
    { label: "Orders", val: stats.total_orders ?? 0 },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5" data-testid="vd-stats">
      {items.map((s) => (
        <div key={s.label} className="sc-card p-4">
          <div className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">{s.label}</div>
          <div className="text-xl font-extrabold mt-1">{s.val}</div>
        </div>
      ))}
    </div>
  );
}

export default function VendorDashboard() {
  const [tab, setTab] = useState("products");
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = create mode, id = edit mode
  // Vendors don't control the publish state — only admins can publish a
  // vendor's product to the public Shop. So `is_published` is intentionally
  // NOT part of the vendor-editable form.
  //
  // Fields split by ownership:
  //   • Master-derived (auto-filled when a product master is selected):
  //     name, brand, category, description, image_url, mrp
  //   • Vendor-only (this vendor's inventory + selling data): everything else
  const emptyForm = {
    // link to /product_master document — set when vendor picked an
    // autocomplete suggestion. Backend defaults it to null (manual entry).
    master_id: null,
    // Master-derived fields (still editable so vendors can override safely
    // when the endpoint isn't shipped yet)
    name: "", brand: "", category: "", description: "", image_url: "", mrp: 0,
    // Vendor-only pricing + inventory
    price: 0, offer_price: 0, stock: 0,
    // Vendor-only fulfilment / condition
    store_location: "", condition: "new",
    cash_on_delivery: true, delivery_available: true,
    warranty_months_override: 0, store_notes: "",
    // Vendor-only serialised-item tracking (only visible for eligible categories)
    imei_1: "", imei_2: "", serial_number: "", batch_number: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  // Autocomplete state (queried against `/api/products/master/search`).
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const debounceRef = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, sa, q] = await Promise.allSettled([
        api.get("/vendor/me/stats"),
        api.get("/vendor/me/products"),
        api.get("/vendor/me/sales"),
        api.get("/vendor/me/questions"),
      ]);
      if (s.status === "fulfilled") setStats(s.value.data);
      if (p.status === "fulfilled") setProducts(p.value.data?.items || p.value.data || []);
      if (sa.status === "fulfilled") setSales(sa.value.data?.items || sa.value.data || []);
      if (q.status === "fulfilled") setQuestions(q.value.data?.items || q.value.data || []);
    } catch (error) {
      log.error("VendorDashboard.load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onImg = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setForm((s) => ({ ...s, image_url: r.result?.toString() || "" }));
    r.readAsDataURL(f);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setQuery("");
    setSuggestions([]);
    setSuggestOpen(false);
    setShowForm(true);
  };
  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      ...emptyForm,
      master_id: p.master_id || null,
      name: p.name || "",
      brand: p.brand || "",
      category: p.category || "",
      description: p.description || "",
      image_url: p.image_url || "",
      mrp: p.mrp ?? 0,
      price: p.price ?? p.selling_price ?? 0,
      offer_price: p.offer_price ?? 0,
      stock: p.stock ?? 0,
      store_location: p.store_location || "",
      condition: p.condition || "new",
      cash_on_delivery: p.cash_on_delivery !== false,
      delivery_available: p.delivery_available !== false,
      warranty_months_override: p.warranty_months_override ?? 0,
      store_notes: p.store_notes || "",
      imei_1: p.imei_1 || "",
      imei_2: p.imei_2 || "",
      serial_number: p.serial_number || "",
      batch_number: p.batch_number || "",
    });
    setQuery(p.name || "");
    setSuggestions([]);
    setSuggestOpen(false);
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setQuery("");
    setSuggestions([]);
    setSuggestOpen(false);
  };

  // Debounced Product-Master lookup. Silently no-ops when the backend
  // endpoint isn't shipped — vendor keeps typing manually.
  useEffect(() => {
    if (!showForm) return;
    if (editingId) return; // edit mode — don't run autocomplete
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    setSuggestLoading(true);
    debounceRef.current = setTimeout(async () => {
      const hits = await searchMaster(q, { limit: 10 });
      setSuggestions(hits);
      setSuggestOpen(hits.length > 0);
      setSuggestLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, showForm, editingId]);

  const pickMaster = async (m) => {
    setSuggestOpen(false);
    reportMasterHit(m.id);
    // Optimistically fill the form from the search hit, then hydrate the
    // full record in the background.
    setForm((prev) => ({
      ...prev,
      master_id: m.id,
      name: m.name || prev.name,
      brand: m.brand || prev.brand,
      category: m.category || prev.category,
      image_url: m.thumbnail || m.image_url || prev.image_url,
      mrp: m.mrp ?? prev.mrp,
    }));
    setQuery(m.name || "");
    const full = await getMaster(m.id);
    if (full) {
      setForm((prev) => ({
        ...prev,
        master_id: full.id,
        name: full.name || prev.name,
        brand: full.brand || prev.brand,
        category: full.category || prev.category,
        description: full.description || prev.description,
        image_url:
          (full.images && (full.images[0]?.url || full.images[0])) ||
          full.image_url || prev.image_url,
        mrp: full.mrp ?? prev.mrp,
        warranty_months_override: full.warranty_months ?? prev.warranty_months_override,
      }));
    }
  };

  const submitProduct = async () => {
    // Device identity block — required for anyone who typed anything into
    // the IMEI fields. See DeviceIdentitySection.validateDeviceIdentity.
    const idErr = validateDeviceIdentity(form);
    if (idErr) { alert(idErr); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price) || 0,
        offer_price: Number(form.offer_price) || 0,
        stock: Number(form.stock) || 0,
        mrp: Number(form.mrp) || 0,
        warranty_months_override: Number(form.warranty_months_override) || 0,
      };
      // Drop empty strings so backend receives explicit nulls / omits them.
      ["imei_1", "imei_2", "serial_number", "batch_number", "store_location", "store_notes"].forEach((k) => {
        if (!payload[k]) delete payload[k];
      });
      if (editingId) {
        await api.patch(`/vendor/me/products/${editingId}`, payload);
      } else {
        await api.post("/vendor/me/products", { ...payload, is_published: false });
      }
      closeForm();
      loadAll();
    } catch (error) {
      log.error("VendorDashboard.save failed", error);
      const detail = error?.response?.data?.detail;
      if (detail === "imei_already_registered") {
        alert("This IMEI is already registered by another vendor. Please double-check the number.");
      } else {
        alert(detail || (editingId ? "Failed to update" : "Failed to create"));
      }
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await api.delete(`/vendor/me/products/${id}`);
      loadAll();
    } catch (error) {
      log.error("VendorDashboard.delete failed", error);
    }
  };

  if (loading) return <Layout title="Vendor"><Spinner /></Layout>;

  return (
    <Layout title="Vendor dashboard">
      <VendorNav />
      <div className="flex items-center gap-2 mb-4 font-extrabold text-[color:var(--sc-ink)]">
        <Store size={18} className="text-[color:var(--sc-primary)]" /> {stats?.vendor?.shop_name || "My shop"}
      </div>
      <Stats stats={stats} />

      <div className="flex gap-2 mb-3 overflow-x-auto" data-testid="vd-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            data-testid={`vd-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`text-xs font-bold px-3 py-2 rounded-full border inline-flex items-center gap-1.5 ${tab === t.key ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "products" && (
        <>
          <div className="flex justify-end mb-2">
            <button data-testid="vd-new" onClick={openNew} className="sc-btn-primary inline-flex items-center gap-1.5 text-sm">
              <Plus size={14} /> Add product
            </button>
          </div>
          {products.length === 0 ? (
            <EmptyState icon={Package} title="No products yet" hint="Add your first product to start selling." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="vd-products">
              {products.map((p) => (
                <div key={p.id} className="sc-card overflow-hidden flex flex-col" data-testid={`vd-prod-${p.id}`}>
                  <div className="aspect-square bg-[color:var(--sc-accent-light)]">{p.image_url && <img alt="" src={p.image_url} className="w-full h-full object-cover" />}</div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="text-sm font-semibold line-clamp-2">{p.name}</div>
                    <div className="text-xs text-[color:var(--sc-ink-muted)] mt-0.5">Stock: {p.stock ?? "—"}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-extrabold">{formatINR(p.price)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => openEdit(p)}
                        data-testid={`vd-edit-${p.id}`}
                        className="inline-flex items-center justify-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-primary-700)] hover:bg-[color:var(--sc-accent-light)] transition-colors"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => del(p.id)}
                        data-testid={`vd-del-${p.id}`}
                        className="inline-flex items-center justify-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "sales" && (
        sales.length === 0
          ? <EmptyState icon={TrendingUp} title="No sales yet" />
          : (
            <div className="sc-card overflow-x-auto" data-testid="vd-sales">
              <table className="w-full text-sm">
                <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
                  <tr><th className="text-left px-4 py-2">Order</th><th className="text-left px-4 py-2">Product</th><th className="text-left px-4 py-2">Amount</th><th className="text-left px-4 py-2">Date</th></tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id} className="border-t border-[color:var(--sc-border)]">
                      <td className="px-4 py-2 font-mono text-xs">{(s.order_id || s.id || "").slice(0, 8)}</td>
                      <td className="px-4 py-2">{s.product_name || "—"}</td>
                      <td className="px-4 py-2 font-extrabold">{formatINR(s.amount || s.total)}</td>
                      <td className="px-4 py-2 text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}

      {tab === "questions" && (
        questions.length === 0
          ? <EmptyState icon={MessageSquare} title="No pending questions" />
          : (
            <div className="space-y-2" data-testid="vd-questions">
              {questions.map((q) => (
                <div key={q.id} className="sc-card p-4">
                  <div className="text-xs text-[color:var(--sc-ink-muted)]">{q.product_name} · {formatDateTime(q.created_at)}</div>
                  <div className="font-semibold mt-1">{q.question || q.text}</div>
                </div>
              ))}
            </div>
          )
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 sc-fade-in" data-testid="vd-form-modal">
            <div className="flex justify-between items-center mb-3">
              <div className="font-extrabold">{editingId ? "Edit product" : "New product"}</div>
              <button onClick={closeForm} aria-label="Close" data-testid="vd-form-close"><X size={18} /></button>
            </div>
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

              {/* ---- Section 1: Smart autocomplete (create mode only) ---- */}
              {!editingId && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-1.5 flex items-center gap-1.5">
                    <Sparkles size={12} /> Smart search
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-2 sc-input">
                      <Search size={16} className="text-[color:var(--sc-ink-muted)] shrink-0" />
                      <input
                        className="flex-1 bg-transparent outline-none"
                        placeholder="Start typing a product name, e.g. iPhone 15…"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setForm((f) => ({ ...f, name: e.target.value, master_id: null })); }}
                        data-testid="vd-form-search"
                        autoFocus
                      />
                      {suggestLoading && <Loader2 size={14} className="animate-spin text-[color:var(--sc-primary)]" />}
                      {form.master_id && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
                          <Check size={10} /> Master
                        </span>
                      )}
                    </div>
                    {suggestOpen && suggestions.length > 0 && (
                      <div
                        className="absolute z-10 left-0 right-0 mt-1 rounded-xl bg-white border border-[color:var(--sc-border)] shadow-lg max-h-72 overflow-y-auto"
                        data-testid="vd-form-suggestions"
                      >
                        {suggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => pickMaster(s)}
                            className="w-full flex items-center gap-3 p-2.5 hover:bg-[color:var(--sc-accent-light)] text-left border-b border-[color:var(--sc-border)] last:border-0"
                            data-testid={`vd-form-suggestion-${s.id}`}
                          >
                            {s.thumbnail ? (
                              <img alt="" src={s.thumbnail} className="w-10 h-10 rounded-md object-cover shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-[color:var(--sc-accent-light)] grid place-items-center shrink-0">
                                <Package size={16} className="text-[color:var(--sc-primary)]" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-[color:var(--sc-ink)] truncate">{s.name}</div>
                              <div className="text-[11px] text-[color:var(--sc-ink-muted)] truncate">
                                {s.brand}{s.model_number ? ` · ${s.model_number}` : ""}{s.category ? ` · ${s.category}` : ""}
                              </div>
                            </div>
                            {s.mrp ? <div className="text-xs font-bold text-[color:var(--sc-ink)] shrink-0">{formatINR(s.mrp)}</div> : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-1.5 text-[11px] text-[color:var(--sc-ink-muted)] flex items-start gap-1">
                    <Info size={11} className="mt-0.5 shrink-0" />
                    <span>Selecting a match auto-fills name, brand, description, image & MRP — you only add your selling price, stock and (for electronics) IMEI/serial.</span>
                  </div>
                </div>
              )}

              {/* ---- Section 2: Product basics ---- */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-1.5">Product details</div>
                <div className="space-y-2">
                  {editingId && (
                    <input className="sc-input" data-testid="vd-form-name" placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input className="sc-input" data-testid="vd-form-brand" placeholder="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                    <input className="sc-input" data-testid="vd-form-category" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  </div>
                  <textarea className="sc-input min-h-[70px]" data-testid="vd-form-desc" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  <div className="flex items-center gap-3">
                    <input type="file" accept="image/*" onChange={onImg} data-testid="vd-form-img" className="block text-sm flex-1" />
                    {form.image_url && <img alt="" src={form.image_url} className="h-14 w-14 rounded-lg border border-[color:var(--sc-border)] object-cover" />}
                  </div>
                </div>
              </div>

              {/* ---- Section 3: Vendor pricing + inventory ---- */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-1.5">Your pricing & stock</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Selling price
                    <input className="sc-input mt-1" data-testid="vd-form-price" type="number" placeholder="₹" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Offer price
                    <input className="sc-input mt-1" data-testid="vd-form-offer" type="number" placeholder="₹ (optional)" value={form.offer_price} onChange={(e) => setForm({ ...form, offer_price: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    MRP
                    <input className="sc-input mt-1" data-testid="vd-form-mrp" type="number" placeholder="₹" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Stock
                    <input className="sc-input mt-1" data-testid="vd-form-stock" type="number" placeholder="Qty" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                  </label>
                </div>
              </div>

              {/* ---- Section 4: Fulfilment ---- */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-1.5">Fulfilment</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Store location
                    <input className="sc-input mt-1" data-testid="vd-form-loc" placeholder="City / area" value={form.store_location} onChange={(e) => setForm({ ...form, store_location: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Condition
                    <select className="sc-input mt-1" data-testid="vd-form-condition" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                      {CONDITIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Warranty override (months)
                    <input className="sc-input mt-1" data-testid="vd-form-warranty" type="number" placeholder="0 = use manufacturer" value={form.warranty_months_override} onChange={(e) => setForm({ ...form, warranty_months_override: e.target.value })} />
                  </label>
                  <div className="grid grid-cols-2 gap-2 items-end">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--sc-ink)] px-3 py-2 rounded-lg border border-[color:var(--sc-border)]">
                      <input type="checkbox" data-testid="vd-form-cod" checked={form.cash_on_delivery} onChange={(e) => setForm({ ...form, cash_on_delivery: e.target.checked })} />
                      Cash on delivery
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--sc-ink)] px-3 py-2 rounded-lg border border-[color:var(--sc-border)]">
                      <input type="checkbox" data-testid="vd-form-delivery" checked={form.delivery_available} onChange={(e) => setForm({ ...form, delivery_available: e.target.checked })} />
                      Delivery available
                    </label>
                  </div>
                </div>
              </div>

              {/* ---- Section 5: Device identity (always visible, collapsed by default) ---- */}
              <DeviceIdentitySection form={form} setForm={setForm} testIdPrefix="vd-form" />

              {/* ---- Section 6: Store notes ---- */}
              <label className="block text-xs font-semibold text-[color:var(--sc-ink)]">
                Store notes (private — only admins see this)
                <textarea className="sc-input mt-1 min-h-[60px]" data-testid="vd-form-notes" placeholder="Anything you want the review team to know" value={form.store_notes} onChange={(e) => setForm({ ...form, store_notes: e.target.value })} />
              </label>

              <div className="rounded-lg bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] text-[11px] px-3 py-2 leading-relaxed">
                Products you add are reviewed by our admin team and published to Slangcart Shop after approval. Publish state is managed by admins — you focus on the product details.
              </div>
              <button data-testid="vd-form-save" onClick={submitProduct} disabled={saving || !form.name || !form.price} className="sc-btn-primary inline-flex items-center gap-1.5 w-full justify-center py-2.5">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editingId ? "Save changes" : "Create product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
