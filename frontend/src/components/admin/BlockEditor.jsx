// Block-editor modal used by AdminShopLayout. Renders the appropriate fields
// for each of the 12 block types, mirroring the mobile-app editor.
import { useState, useEffect, useCallback, useMemo } from "react";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { BLOCK_TYPES, BLOCK_TYPE_BY_KEY, LAYOUT_STYLES, SIZES, TEXT_ALIGNS, DATA_SOURCES } from "@/constants/shopBlocks";
import { log } from "@/lib/log";

const emptyItem = () => ({ _key: `it_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, label: "", subtitle: "", image_data_url: "", link_type: "", link_value: "", color: "" });

function readFileAsDataUrl(f) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result?.toString() || "");
    r.readAsDataURL(f);
  });
}

export default function BlockEditor({ block, onClose, onSaved }) {
  const isEdit = !!block?.id;
  const [type, setType] = useState(block?.block_type || "banner_slider");
  const [form, setForm] = useState({
    title: "", subtitle: "", body: "", cta_label: "", sort_order: 0, active: true,
    size: "medium", image_data_url: "", text_color: "", bg_color: "", font_size: null,
    text_align: "left", button_color: "", button_text_color: "", height: null,
    product_ids: [], data_source: "manual", product_count: 10, layout_style: "grid",
    category_filter: "", items: [], flash_sale_ends_at: "", products_per_row: 2,
    show_view_all: false, view_all_link: "", scope: "home", scope_category: "",
    ...(block || {}),
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [products, setProducts] = useState([]);
  const [productPick, setProductPick] = useState("");

  useEffect(() => {
    api.get("/products", { params: { limit: 200 } }).then((r) => {
      setProducts(Array.isArray(r.data) ? r.data : r.data?.items || []);
    }).catch((e) => log.error("BlockEditor products fetch failed", e));
  }, []);

  const cfg = BLOCK_TYPE_BY_KEY[type] || BLOCK_TYPES[0];
  const needs = cfg.needs;

  // Memoize the product dropdown options so we don't re-filter/slice on every
  // keystroke in other fields. Only re-runs when products or already-picked
  // IDs change.
  const pickableProducts = useMemo(
    () => products.filter((p) => !form.product_ids?.includes(p.id)).slice(0, 100),
    [products, form.product_ids],
  );

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const onImg = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    set("image_data_url", await readFileAsDataUrl(f));
  };

  const onItemImg = async (idx, e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = await readFileAsDataUrl(f);
    setForm((s) => {
      const items = [...(s.items || [])];
      items[idx] = { ...items[idx], image_data_url: url };
      return { ...s, items };
    });
  };

  const addItem = () => setForm((s) => ({ ...s, items: [...(s.items || []), emptyItem()] }));
  const updItem = (idx, k, v) => setForm((s) => {
    const items = [...(s.items || [])];
    items[idx] = { ...items[idx], [k]: v };
    return { ...s, items };
  });
  const delItem = (idx) => setForm((s) => ({ ...s, items: (s.items || []).filter((_, i) => i !== idx) }));

  const togglePid = (id) => setForm((s) => {
    const arr = s.product_ids || [];
    return { ...s, product_ids: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] };
  });

  const submit = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const payload = { ...form, block_type: type };
      // Only send needed fields to keep payload lean; but extras are harmless.
      if (isEdit) await api.put(`/admin/shop-layout/${block.id}`, payload);
      else await api.post("/admin/shop-layout", payload);
      onSaved?.();
      onClose?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Save failed");
    } finally { setBusy(false); }
  }, [form, type, isEdit, block?.id, onSaved, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" data-testid="sl-editor">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[color:var(--sc-border)] px-5 py-3 flex items-center justify-between">
          <div className="font-extrabold">{isEdit ? "Edit block" : "New block"}</div>
          <button data-testid="sl-editor-close" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[color:var(--sc-accent-light)]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Type picker */}
          <div>
            <label className="text-[11px] font-bold text-[color:var(--sc-ink-muted)] uppercase">Block type</label>
            <select disabled={isEdit} className="sc-input mt-1" data-testid="sl-type" value={type} onChange={(e) => setType(e.target.value)}>
              {BLOCK_TYPES.map((b) => <option key={b.type} value={b.type}>{b.label}</option>)}
            </select>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-1">{cfg.description}</div>
          </div>

          {/* Scope */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-[color:var(--sc-ink-muted)] uppercase">Scope</label>
              <select className="sc-input mt-1" data-testid="sl-scope" value={form.scope} onChange={(e) => set("scope", e.target.value)}>
                <option value="home">Home</option>
                <option value="category">Category</option>
              </select>
            </div>
            {form.scope === "category" && (
              <div>
                <label className="text-[11px] font-bold text-[color:var(--sc-ink-muted)] uppercase">Category slug</label>
                <input className="sc-input mt-1" data-testid="sl-scope-cat" value={form.scope_category} onChange={(e) => set("scope_category", e.target.value)} />
              </div>
            )}
          </div>

          {/* Title / subtitle */}
          {needs.title && (
            <div className="grid grid-cols-2 gap-2">
              <input className="sc-input" data-testid="sl-title" placeholder="Title" value={form.title} onChange={(e) => set("title", e.target.value)} />
              <input className="sc-input" data-testid="sl-subtitle" placeholder="Subtitle (optional)" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
            </div>
          )}

          {/* Body */}
          {needs.body && (
            <textarea className="sc-input" rows={3} data-testid="sl-body" placeholder="Body text" value={form.body} onChange={(e) => set("body", e.target.value)} />
          )}

          {/* CTA */}
          {needs.cta && (
            <input className="sc-input" data-testid="sl-cta" placeholder="CTA label (e.g. Shop now)" value={form.cta_label} onChange={(e) => set("cta_label", e.target.value)} />
          )}

          {/* Image */}
          {needs.image && (
            <div>
              <label className="text-[11px] font-bold text-[color:var(--sc-ink-muted)] uppercase">Image</label>
              <input type="file" accept="image/*" data-testid="sl-image" onChange={onImg} className="sc-input mt-1" />
              {form.image_data_url && <img alt="" src={form.image_data_url} className="mt-2 h-32 rounded-lg border border-[color:var(--sc-border)] object-contain" />}
            </div>
          )}

          {/* Sub-items (banner_slider, category_circles, brand_slider, offer_cards) */}
          {needs.items && (
            <div data-testid="sl-items">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-bold text-[color:var(--sc-ink-muted)] uppercase">Items ({form.items?.length || 0})</div>
                <button data-testid="sl-add-item" onClick={addItem} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] inline-flex items-center gap-1"><Plus size={12} /> Add item</button>
              </div>
              <div className="space-y-2">
                {(form.items || []).map((it, idx) => (
                  <div key={it._key || `existing_${idx}`} className="border border-[color:var(--sc-border)] rounded-xl p-3 grid grid-cols-2 gap-2" data-testid={`sl-item-${idx}`}>
                    <input className="sc-input" placeholder="Label" value={it.label} onChange={(e) => updItem(idx, "label", e.target.value)} />
                    <input className="sc-input" placeholder="Subtitle" value={it.subtitle} onChange={(e) => updItem(idx, "subtitle", e.target.value)} />
                    <input className="sc-input" placeholder="Link type (url/product/category)" value={it.link_type} onChange={(e) => updItem(idx, "link_type", e.target.value)} />
                    <input className="sc-input" placeholder="Link value" value={it.link_value} onChange={(e) => updItem(idx, "link_value", e.target.value)} />
                    <input className="sc-input" placeholder="Color (#hex)" value={it.color} onChange={(e) => updItem(idx, "color", e.target.value)} />
                    <input type="file" accept="image/*" onChange={(e) => onItemImg(idx, e)} className="sc-input" />
                    {it.image_data_url && <img alt="" src={it.image_data_url} className="col-span-2 h-20 rounded-lg object-contain border border-[color:var(--sc-border)]" />}
                    <button onClick={() => delItem(idx)} className="col-span-2 text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center justify-center gap-1"><Trash2 size={12} /> Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product picker */}
          {needs.products && (
            <div data-testid="sl-products">
              <div className="text-[11px] font-bold text-[color:var(--sc-ink-muted)] uppercase mb-1">Products</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <select className="sc-input" data-testid="sl-data-source" value={form.data_source} onChange={(e) => set("data_source", e.target.value)}>
                  {DATA_SOURCES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <input className="sc-input" type="number" data-testid="sl-product-count" placeholder="Auto count" value={form.product_count} onChange={(e) => set("product_count", Number(e.target.value))} />
                {needs.layout && <select className="sc-input" data-testid="sl-layout-style" value={form.layout_style} onChange={(e) => set("layout_style", e.target.value)}>{LAYOUT_STYLES.map((l) => <option key={l} value={l}>{l}</option>)}</select>}
                <input className="sc-input" type="number" data-testid="sl-ppr" placeholder="Products per row" value={form.products_per_row} onChange={(e) => set("products_per_row", Number(e.target.value))} />
                <input className="sc-input col-span-2" placeholder="Category filter (slug)" value={form.category_filter} onChange={(e) => set("category_filter", e.target.value)} />
              </div>
              {form.data_source === "manual" && (
                <div>
                  <div className="flex gap-2 mb-2">
                    <select className="sc-input flex-1" data-testid="sl-product-pick" value={productPick} onChange={(e) => setProductPick(e.target.value)}>
                      <option value="">Pick a product…</option>
                      {pickableProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button data-testid="sl-product-add" onClick={() => { if (productPick) { togglePid(productPick); setProductPick(""); } }} className="sc-btn-outline text-sm"><Plus size={14} /></button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(form.product_ids || []).map((id) => {
                      const p = products.find((x) => x.id === id);
                      return (
                        <span key={id} className="sc-chip text-[10px] inline-flex items-center gap-1" data-testid={`sl-pid-${id}`}>
                          {p?.name || id.slice(0, 8)}
                          <button onClick={() => togglePid(id)} className="text-[color:var(--sc-error)]"><X size={10} /></button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Flash sale */}
          {needs.flash && (
            <div>
              <label className="text-[11px] font-bold text-[color:var(--sc-ink-muted)] uppercase">Flash sale ends at (ISO)</label>
              <input className="sc-input mt-1" type="datetime-local" data-testid="sl-flash-end" value={form.flash_sale_ends_at?.replace("Z", "")?.slice(0, 16) || ""} onChange={(e) => set("flash_sale_ends_at", e.target.value)} />
            </div>
          )}

          {/* View all */}
          {needs.viewall && (
            <div className="grid grid-cols-2 gap-2">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" data-testid="sl-view-all" checked={!!form.show_view_all} onChange={(e) => set("show_view_all", e.target.checked)} /> Show &ldquo;View all&rdquo;</label>
              <input className="sc-input" placeholder="View all link" value={form.view_all_link} onChange={(e) => set("view_all_link", e.target.value)} />
            </div>
          )}

          {/* Colors / styling */}
          {needs.colors && (
            <details className="border border-[color:var(--sc-border)] rounded-xl p-3">
              <summary className="text-xs font-semibold cursor-pointer">Colors & styling</summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input className="sc-input" placeholder="Background (#hex)" value={form.bg_color} onChange={(e) => set("bg_color", e.target.value)} />
                <input className="sc-input" placeholder="Text color" value={form.text_color} onChange={(e) => set("text_color", e.target.value)} />
                <input className="sc-input" placeholder="Button color" value={form.button_color} onChange={(e) => set("button_color", e.target.value)} />
                <input className="sc-input" placeholder="Button text color" value={form.button_text_color} onChange={(e) => set("button_text_color", e.target.value)} />
                <select className="sc-input" value={form.text_align} onChange={(e) => set("text_align", e.target.value)}>{TEXT_ALIGNS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                <input className="sc-input" type="number" placeholder="Font size (px)" value={form.font_size ?? ""} onChange={(e) => set("font_size", e.target.value ? Number(e.target.value) : null)} />
                {needs.height && <input className="sc-input col-span-2" type="number" placeholder="Height (px)" value={form.height ?? ""} onChange={(e) => set("height", e.target.value ? Number(e.target.value) : null)} />}
              </div>
            </details>
          )}

          {/* Common settings */}
          <div className="grid grid-cols-3 gap-2">
            <select className="sc-input" value={form.size} onChange={(e) => set("size", e.target.value)}>{SIZES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <input className="sc-input" type="number" placeholder="Sort order" value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} />
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" data-testid="sl-active" checked={!!form.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>
          </div>

          {err && <div data-testid="sl-err" className="text-sm font-semibold text-[color:var(--sc-error)]">{err}</div>}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-[color:var(--sc-border)] px-5 py-3 flex justify-end gap-2">
          <button data-testid="sl-cancel" onClick={onClose} className="sc-btn-outline">Cancel</button>
          <button data-testid="sl-save" disabled={busy} onClick={submit} className="sc-btn-primary inline-flex items-center gap-1.5">
            {busy && <Loader2 className="animate-spin" size={14} />} Save block
          </button>
        </div>
      </div>
    </div>
  );
}
