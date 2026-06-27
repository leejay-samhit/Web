import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { log } from "@/lib/log";

export default function AdminPromoBanners() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", image_data_url: "", link_url: "", sort_order: 0, active: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/promo-banners");
      setItems(data?.items || (Array.isArray(data) ? data : []));
    } catch (error) { log.error("AdminPromoBanners.load failed", error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onImg = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setForm((s) => ({ ...s, image_data_url: r.result?.toString() || "" }));
    r.readAsDataURL(f);
  };

  const add = async () => {
    if (!form.image_data_url) return;
    setSaving(true);
    try {
      await api.post("/admin/promo-banners", form);
      setForm({ title: "", image_data_url: "", link_url: "", sort_order: 0, active: true });
      load();
    } catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const toggle = async (b) => {
    try { await api.patch(`/admin/promo-banners/${b.id}`, { active: !b.active }); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete banner?")) return;
    try { await api.delete(`/admin/promo-banners/${id}`); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <Layout title="Admin · Promo banners (legacy)">
      <div className="sc-card p-4 mb-4" data-testid="pb-add">
        <div className="font-extrabold mb-3">Add banner</div>
        <div className="grid md:grid-cols-2 gap-2">
          <input className="sc-input" data-testid="pb-title" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="sc-input" data-testid="pb-link" placeholder="Link URL (optional)" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
          <input className="sc-input" type="number" data-testid="pb-order" placeholder="Sort order" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          <div className="flex items-end">
            <input type="file" accept="image/*" data-testid="pb-image" onChange={onImg} className="text-sm" />
          </div>
          {form.image_data_url && <img alt="" src={form.image_data_url} className="md:col-span-2 h-24 rounded-lg border border-[color:var(--sc-border)] object-contain" />}
        </div>
        <button data-testid="pb-add-btn" disabled={saving || !form.image_data_url} onClick={add} className="sc-btn-primary mt-3 inline-flex items-center gap-1.5">
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Add banner
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="pb-list">
          {items.map((b) => (
            <div key={b.id} className="sc-card overflow-hidden" data-testid={`pb-card-${b.id}`}>
              {(b.image_data_url || b.image_url) && <img alt="" src={b.image_data_url || b.image_url} className="w-full h-32 object-cover" />}
              <div className="p-3">
                <div className="font-semibold truncate">{b.title || "(no title)"}</div>
                <div className="text-xs text-[color:var(--sc-ink-muted)] truncate">{b.link_url || "—"}</div>
                <div className="flex gap-2 mt-2">
                  <button data-testid={`pb-toggle-${b.id}`} onClick={() => toggle(b)} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)]">
                    {b.active ? "Active" : "Inactive"}
                  </button>
                  <button data-testid={`pb-del-${b.id}`} onClick={() => remove(b.id)} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center gap-1">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="sc-card p-6 text-center text-[color:var(--sc-ink-muted)] col-span-full">No banners.</div>}
        </div>
      )}
    </Layout>
  );
}
