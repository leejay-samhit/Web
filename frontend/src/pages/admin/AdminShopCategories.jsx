import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { log } from "@/lib/log";

export default function AdminShopCategories() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", image_url: "", sort_order: 0 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/shop-categories");
      setCats(data?.items || (Array.isArray(data) ? data : []));
    } catch (error) { log.error("AdminShopCategories.load failed", error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const seed = async () => {
    if (!window.confirm("Seed default shop categories?")) return;
    try { await api.post("/admin/shop-categories/seed"); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const add = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await api.post("/admin/shop-categories", form);
      setForm({ name: "", image_url: "", sort_order: 0 });
      load();
    } catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete category?")) return;
    try { await api.delete(`/admin/shop-categories/${id}`); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <Layout title="Admin · Shop categories">
      <div className="flex gap-2 mb-4">
        <button data-testid="sc-seed" onClick={seed} className="sc-btn-outline text-sm">Seed defaults</button>
      </div>

      <div className="sc-card p-4 mb-4" data-testid="sc-add">
        <div className="font-extrabold mb-3">Add category</div>
        <div className="grid md:grid-cols-3 gap-2">
          <input className="sc-input" data-testid="sc-name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="sc-input" data-testid="sc-icon" placeholder="Image URL" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          <input className="sc-input" type="number" data-testid="sc-order" placeholder="Sort order" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
        </div>
        <button data-testid="sc-add-btn" disabled={saving || !form.name} onClick={add} className="sc-btn-primary mt-3 inline-flex items-center gap-1.5">
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Add
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="sc-card overflow-x-auto" data-testid="sc-list">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr><th className="text-left px-4 py-2.5">Name</th><th className="text-left px-4 py-2.5">Order</th><th className="text-right px-4 py-2.5">Actions</th></tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id} className="border-t border-[color:var(--sc-border)]" data-testid={`sc-row-${c.id}`}>
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    {c.image_url && <img alt="" src={c.image_url} className="w-7 h-7 rounded object-cover" />}
                    <span className="font-semibold">{c.name}</span>
                  </td>
                  <td className="px-4 py-2.5">{c.sort_order ?? 0}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button data-testid={`sc-del-${c.id}`} onClick={() => remove(c.id)} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center gap-1">
                      <Trash2 size={12} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
              {cats.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No categories.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
