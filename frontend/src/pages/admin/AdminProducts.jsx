import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatINR } from "@/lib/utils";
import { Plus, Trash2, X, Loader2 } from "lucide-react";
import { log } from "@/lib/log";
import DeviceIdentitySection, { validateDeviceIdentity } from "@/components/DeviceIdentitySection";

const initial = {
  name: "",
  price: "",
  image_url: "",
  description: "",
  stock: 0,
  category: "",
  sub_category: "",
  brand: "",
  is_published: true,
  // Device identity (optional; validated with Luhn if provided)
  serial_number: "",
  imei_1: "",
  imei_2: "",
  // extended attributes (mobile app parity)
  sub_features: "",       // newline-separated bullet points
  images: [],             // array of additional image data-urls
  attrs_brand: "",
  attrs_os: "",
  attrs_ram: "",
  attrs_cpu_model: "",
  attrs_cpu_speed: "",
  attrs_storage: "",
  clothing_size: "",
  extra_attrs: "",        // free-form key:value lines
  price_summary: "",
  protection_summary: "",
  warranty_summary: "",
  delivery_summary: "",
  whats_in_box: "",       // newline-separated names
  spec_tabs: "",          // structured spec tabs (one "Tab Name|Label:Value;..." per line)
};

export default function AdminProducts() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/products");
      setList(Array.isArray(data) ? data : data?.items || []);
    } catch (error) {
      log.error("AdminProducts.load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const set = (k) => (e) => {
    const v = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const onImg = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setForm((s) => ({ ...s, image_url: r.result?.toString() || "" }));
    r.readAsDataURL(f);
  };

  const onExtraImgs = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 8);
    const urls = await Promise.all(files.map((f) => new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result?.toString() || "");
      r.readAsDataURL(f);
    })));
    setForm((s) => ({ ...s, images: [...(s.images || []), ...urls].slice(0, 8) }));
  };

  // Helpers: convert UI text fields into the API's structured shapes.
  const parseLines = (txt) => (txt || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const parseExtraAttrs = (txt) => {
    const out = {};
    for (const line of parseLines(txt)) {
      const [k, ...rest] = line.split(":");
      if (k && rest.length) out[k.trim()] = rest.join(":").trim();
    }
    return out;
  };
  const toStyled = (txt) => txt ? { text: txt } : null;
  // Parse the spec_tabs textarea into the backend's SpecTab[] shape.
  // Format per line: "Tab Name | label1:value1; label2:value2"
  // (separators are flexible — "|" splits tab name from rows, ";" separates rows).
  const parseSpecTabs = (txt) => {
    const out = [];
    for (const line of parseLines(txt)) {
      const [name, rowsRaw = ""] = line.split("|").map((s) => s.trim());
      const rows = rowsRaw
        .split(";")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const [label, ...vv] = p.split(":");
          return { label: (label || "").trim(), value: vv.join(":").trim() };
        })
        .filter((r) => r.label || r.value);
      if (name || rows.length) out.push({ name: name || "", rows });
    }
    return out;
  };

  const create = async () => {
    // Device identity block — enforce Luhn + no duplicates before hitting the API.
    const idErr = validateDeviceIdentity(form);
    if (idErr) { setErr(idErr); return; }
    setSaving(true);
    setErr("");
    try {
      const payload = {
        name: form.name,
        price: Number(form.price),
        image_url: form.image_url,
        description: form.description || null,
        stock: Number(form.stock || 0),
        category: form.category || null,
        sub_category: form.sub_category || null,
        brand: form.brand || null,
        is_published: form.is_published,
        serial_number: form.serial_number || null,
        imei_1: form.imei_1 || null,
        imei_2: form.imei_2 || null,
        sub_features: parseLines(form.sub_features),
        images: form.images || [],
        attrs_brand: form.attrs_brand || null,
        attrs_os: form.attrs_os || null,
        attrs_ram: form.attrs_ram || null,
        attrs_cpu_model: form.attrs_cpu_model || null,
        attrs_cpu_speed: form.attrs_cpu_speed || null,
        attrs_storage: form.attrs_storage || null,
        clothing_size: form.clothing_size || null,
        extra_attrs: parseExtraAttrs(form.extra_attrs),
        price_summary: toStyled(form.price_summary),
        protection_summary: toStyled(form.protection_summary),
        warranty_summary: toStyled(form.warranty_summary),
        delivery_summary: toStyled(form.delivery_summary),
        // Backend schema: WhatsInBoxItem = { name, image_data_url } — NOT { label }
        whats_in_box: parseLines(form.whats_in_box).map((name) => ({ name, image_data_url: "" })),
        spec_tabs: parseSpecTabs(form.spec_tabs),
      };
      await api.post("/admin/products", payload);
      setOpen(false);
      setForm(initial);
      load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not create product");
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await api.delete(`/admin/products/${id}`);
      load();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed");
    }
  };

  return (
    <Layout title="Admin · Products">
      <div className="flex justify-end mb-3">
        <button data-testid="ap-new" onClick={() => setOpen(true)} className="sc-btn-primary inline-flex items-center gap-1.5">
          <Plus size={16} /> New product
        </button>
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="ap-list">
          {list.map((p) => (
            <div key={p.id} className="sc-card overflow-hidden flex flex-col" data-testid={`ap-card-${p.id}`}>
              <div className="aspect-square bg-[color:var(--sc-accent-light)]">
                {p.image_url && (
                  <img alt="" src={p.image_url} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <div className="font-semibold text-sm line-clamp-2">{p.name}</div>
                <div className="text-xs text-[color:var(--sc-ink-muted)] mt-0.5">Stock: {p.stock ?? "—"}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-extrabold">{formatINR(p.price)}</span>
                  <button data-testid={`ap-del-${p.id}`} onClick={() => del(p.id)} className="text-[color:var(--sc-error)]">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {list.length === 0 && <div className="col-span-full text-center text-[color:var(--sc-ink-muted)] py-10">No products.</div>}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 sc-fade-in" data-testid="ap-modal">
            <div className="flex justify-between items-center mb-3">
              <div className="font-extrabold">Create product</div>
              <button onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              <input className="sc-input" data-testid="ap-name" placeholder="Name *" value={form.name} onChange={set("name")} />
              <div className="grid grid-cols-2 gap-2">
                <input className="sc-input" data-testid="ap-price" type="number" placeholder="Price (₹) *" value={form.price} onChange={set("price")} />
                <input className="sc-input" data-testid="ap-stock" type="number" placeholder="Stock" value={form.stock} onChange={set("stock")} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="sc-input" data-testid="ap-brand" placeholder="Brand" value={form.brand} onChange={set("brand")} />
                <input className="sc-input" data-testid="ap-category" placeholder="Category" value={form.category} onChange={set("category")} />
              </div>
              <input className="sc-input" data-testid="ap-sub-category" placeholder="Sub-category" value={form.sub_category} onChange={set("sub_category")} />
              <textarea className="sc-input min-h-[80px]" data-testid="ap-desc" placeholder="Description" value={form.description} onChange={set("description")} />

              <div>
                <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Primary image *</label>
                <input type="file" accept="image/*" onChange={onImg} className="block mt-1 text-sm" data-testid="ap-image" />
                {form.image_url && <img alt="" src={form.image_url} className="mt-2 h-24 rounded-lg border border-[color:var(--sc-border)]" />}
              </div>

              <div>
                <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Additional images (up to 8)</label>
                <input type="file" accept="image/*" multiple onChange={onExtraImgs} className="block mt-1 text-sm" data-testid="ap-extra-images" />
                {form.images?.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {form.images.map((u, i) => (
                      <div key={`${u.slice(-16)}-${i}`} className="relative" data-testid={`ap-extra-${i}`}>
                        <img alt="" src={u} className="h-14 w-14 rounded border border-[color:var(--sc-border)] object-cover" />
                        <button type="button" onClick={() => setForm((s) => ({ ...s, images: s.images.filter((_, ii) => ii !== i) }))} className="absolute -top-1 -right-1 bg-[color:var(--sc-error)] text-white rounded-full w-4 h-4 grid place-items-center text-[10px]">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <details>
                <summary className="text-xs font-bold uppercase text-[color:var(--sc-ink-muted)] cursor-pointer py-1">Key features &amp; box contents</summary>
                <div className="space-y-2 mt-2">
                  <textarea className="sc-input min-h-[60px]" data-testid="ap-sub-features" placeholder={"Key features (one per line)"} value={form.sub_features} onChange={set("sub_features")} />
                  <textarea className="sc-input min-h-[60px]" data-testid="ap-whats-in-box" placeholder={"What's in the box (one item per line)"} value={form.whats_in_box} onChange={set("whats_in_box")} />
                </div>
              </details>

              <details>
                <summary className="text-xs font-bold uppercase text-[color:var(--sc-ink-muted)] cursor-pointer py-1">Spec tabs (advanced)</summary>
                <div className="space-y-1 mt-2">
                  <textarea
                    className="sc-input min-h-[80px] font-mono text-xs"
                    data-testid="ap-spec-tabs"
                    placeholder={"One tab per line.\nFormat: Tab Name | Label1:Value1; Label2:Value2\nExample:\nGeneral | Color:Black; Weight:250g\nDisplay | Size:6.5; Refresh:120Hz"}
                    value={form.spec_tabs}
                    onChange={set("spec_tabs")}
                  />
                  <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Each tab becomes a section on the product detail page.</div>
                </div>
              </details>

              <details>
                <summary className="text-xs font-bold uppercase text-[color:var(--sc-ink-muted)] cursor-pointer py-1">Specifications</summary>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input className="sc-input" data-testid="ap-attrs-brand" placeholder="Brand (attr)" value={form.attrs_brand} onChange={set("attrs_brand")} />
                  <input className="sc-input" data-testid="ap-attrs-os" placeholder="OS" value={form.attrs_os} onChange={set("attrs_os")} />
                  <input className="sc-input" data-testid="ap-attrs-ram" placeholder="RAM" value={form.attrs_ram} onChange={set("attrs_ram")} />
                  <input className="sc-input" data-testid="ap-attrs-cpu" placeholder="CPU model" value={form.attrs_cpu_model} onChange={set("attrs_cpu_model")} />
                  <input className="sc-input" data-testid="ap-attrs-speed" placeholder="CPU speed" value={form.attrs_cpu_speed} onChange={set("attrs_cpu_speed")} />
                  <input className="sc-input" data-testid="ap-attrs-storage" placeholder="Storage" value={form.attrs_storage} onChange={set("attrs_storage")} />
                  <input className="sc-input col-span-2" data-testid="ap-clothing-size" placeholder="Clothing size (if apparel)" value={form.clothing_size} onChange={set("clothing_size")} />
                  <textarea className="sc-input col-span-2 min-h-[60px]" data-testid="ap-extra-attrs" placeholder={"Other specs (one per line, key:value)\nExample:\nColor: Black\nWeight: 250g"} value={form.extra_attrs} onChange={set("extra_attrs")} />
                </div>
              </details>

              <DeviceIdentitySection form={form} setForm={setForm} testIdPrefix="ap" />

              <details>
                <summary className="text-xs font-bold uppercase text-[color:var(--sc-ink-muted)] cursor-pointer py-1">Price / Protection / Warranty / Delivery summaries</summary>
                <div className="space-y-2 mt-2">
                  <input className="sc-input" data-testid="ap-price-summary" placeholder="Price summary text" value={form.price_summary} onChange={set("price_summary")} />
                  <input className="sc-input" data-testid="ap-protection-summary" placeholder="Protection summary" value={form.protection_summary} onChange={set("protection_summary")} />
                  <input className="sc-input" data-testid="ap-warranty-summary" placeholder="Warranty summary" value={form.warranty_summary} onChange={set("warranty_summary")} />
                  <input className="sc-input" data-testid="ap-delivery-summary" placeholder="Delivery summary" value={form.delivery_summary} onChange={set("delivery_summary")} />
                </div>
              </details>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_published} onChange={(e) => set("is_published")(e.target.checked)} /> Publish immediately
              </label>
              {err && <div className="text-sm font-semibold text-[color:var(--sc-error)]">{err}</div>}
              <button data-testid="ap-save" onClick={create} disabled={saving || !form.name || !form.price || !form.image_url} className="sc-btn-primary w-full inline-flex items-center justify-center gap-1.5">
                {saving && <Loader2 size={14} className="animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
