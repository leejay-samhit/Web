import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { log } from "@/lib/log";

export default function AdminServiceCategories() {
  const [cats, setCats] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCat, setNewCat] = useState({ name: "", icon_url: "" });
  const [newSub, setNewSub] = useState({ category_id: "", name: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        api.get("/admin/service-categories"),
        api.get("/admin/service-subcategories"),
      ]);
      const aData = a.data?.categories || a.data?.items || (Array.isArray(a.data) ? a.data : []);
      const bData = b.data?.subcategories || b.data?.items || (Array.isArray(b.data) ? b.data : []);
      setCats(aData);
      setSubs(bData);
    } catch (error) { log.error("AdminServiceCategories.load failed", error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const addCat = async () => {
    if (!newCat.name) return;
    setSaving(true);
    try { await api.post("/admin/service-categories", newCat); setNewCat({ name: "", icon_url: "" }); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const delCat = async (id) => {
    if (!window.confirm("Delete category and its subcategories?")) return;
    try { await api.delete(`/admin/service-categories/${id}`); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const addSub = async () => {
    if (!newSub.name || !newSub.category_id) return;
    setSaving(true);
    try { await api.post("/admin/service-subcategories", newSub); setNewSub({ category_id: "", name: "" }); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const delSub = async (id) => {
    if (!window.confirm("Delete subcategory?")) return;
    try { await api.delete(`/admin/service-subcategories/${id}`); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <Layout title="Admin · Service categories">
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="sc-card p-4" data-testid="sc-cat-panel">
          <div className="font-extrabold mb-3">Categories</div>
          <div className="grid grid-cols-2 gap-2">
            <input className="sc-input" data-testid="sc-cat-name" placeholder="Name" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
            <input className="sc-input" data-testid="sc-cat-icon" placeholder="Icon URL" value={newCat.icon_url} onChange={(e) => setNewCat({ ...newCat, icon_url: e.target.value })} />
          </div>
          <button data-testid="sc-cat-add" disabled={saving || !newCat.name} onClick={addCat} className="sc-btn-primary mt-2 inline-flex items-center gap-1.5">
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Add category
          </button>
          {loading ? <Spinner /> : (
            <div className="mt-3 space-y-2" data-testid="sc-cat-list">
              {cats.map((c) => (
                <div key={c.id} className="flex items-center gap-2 border border-[color:var(--sc-border)] rounded-lg p-2" data-testid={`sc-cat-${c.id}`}>
                  {c.icon_url && <img alt="" src={c.icon_url} className="w-7 h-7 rounded object-cover" />}
                  <div className="font-semibold flex-1 truncate">{c.name}</div>
                  <button data-testid={`sc-cat-del-${c.id}`} onClick={() => delCat(c.id)} className="text-[color:var(--sc-error)]"><Trash2 size={14} /></button>
                </div>
              ))}
              {cats.length === 0 && <div className="text-sm text-[color:var(--sc-ink-muted)] py-4 text-center">No categories.</div>}
            </div>
          )}
        </div>

        <div className="sc-card p-4" data-testid="sc-sub-panel">
          <div className="font-extrabold mb-3">Subcategories</div>
          <div className="grid grid-cols-2 gap-2">
            <select className="sc-input" data-testid="sc-sub-cat" value={newSub.category_id} onChange={(e) => setNewSub({ ...newSub, category_id: e.target.value })}>
              <option value="">Pick category…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="sc-input" data-testid="sc-sub-name" placeholder="Name" value={newSub.name} onChange={(e) => setNewSub({ ...newSub, name: e.target.value })} />
          </div>
          <button data-testid="sc-sub-add" disabled={saving || !newSub.name || !newSub.category_id} onClick={addSub} className="sc-btn-primary mt-2 inline-flex items-center gap-1.5">
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Add subcategory
          </button>
          {loading ? <Spinner /> : (
            <div className="mt-3 space-y-2" data-testid="sc-sub-list">
              {subs.map((s) => (
                <div key={s.id} className="flex items-center gap-2 border border-[color:var(--sc-border)] rounded-lg p-2" data-testid={`sc-sub-${s.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{s.name}</div>
                    <div className="text-xs text-[color:var(--sc-ink-muted)] truncate">{cats.find((c) => c.id === s.category_id)?.name || s.category_id}</div>
                  </div>
                  <button data-testid={`sc-sub-del-${s.id}`} onClick={() => delSub(s.id)} className="text-[color:var(--sc-error)]"><Trash2 size={14} /></button>
                </div>
              ))}
              {subs.length === 0 && <div className="text-sm text-[color:var(--sc-ink-muted)] py-4 text-center">No subcategories.</div>}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
