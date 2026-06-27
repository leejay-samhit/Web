import { useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatINR } from "@/lib/utils";
import { Plus, Trash2, X, Loader2 } from "lucide-react";

const initial = {
  name: "",
  price: "",
  image_url: "",
  description: "",
  stock: 0,
  category: "",
  brand: "",
  is_published: true,
};

export default function AdminProducts() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/products");
      setList(Array.isArray(data) ? data : data?.items || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

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

  const create = async () => {
    setSaving(true);
    setErr("");
    try {
      await api.post("/admin/products", {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock || 0),
      });
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
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 sc-fade-in" data-testid="ap-modal">
            <div className="flex justify-between items-center mb-3">
              <div className="font-extrabold">Create product</div>
              <button onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              <input className="sc-input" data-testid="ap-name" placeholder="Name" value={form.name} onChange={set("name")} />
              <div className="grid grid-cols-2 gap-2">
                <input className="sc-input" data-testid="ap-price" type="number" placeholder="Price (₹)" value={form.price} onChange={set("price")} />
                <input className="sc-input" data-testid="ap-stock" type="number" placeholder="Stock" value={form.stock} onChange={set("stock")} />
              </div>
              <input className="sc-input" data-testid="ap-brand" placeholder="Brand" value={form.brand} onChange={set("brand")} />
              <input className="sc-input" data-testid="ap-category" placeholder="Category" value={form.category} onChange={set("category")} />
              <textarea className="sc-input min-h-[80px]" data-testid="ap-desc" placeholder="Description" value={form.description} onChange={set("description")} />
              <div>
                <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Image</label>
                <input type="file" accept="image/*" onChange={onImg} className="block mt-1 text-sm" data-testid="ap-image" />
                {form.image_url && (
                  <img alt="" src={form.image_url} className="mt-2 h-24 rounded-lg border border-[color:var(--sc-border)]" />
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_published} onChange={(e) => set("is_published")(e.target.checked)} /> Publish immediately
              </label>
              {err && <div className="text-sm font-semibold text-[color:var(--sc-error)]">{err}</div>}
              <button data-testid="ap-save" onClick={create} disabled={saving || !form.name || !form.price} className="sc-btn-primary w-full inline-flex items-center justify-center gap-1.5">
                {saving && <Loader2 size={14} className="animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
