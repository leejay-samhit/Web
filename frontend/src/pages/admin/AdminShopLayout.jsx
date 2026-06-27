import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { log } from "@/lib/log";

const TYPES = ["hero", "banner", "category_strip", "product_grid", "carousel", "promo", "text"];

export default function AdminShopLayout() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newBlock, setNewBlock] = useState({ type: "hero", title: "", subtitle: "", image_url: "", link_url: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/shop-layout");
      setBlocks(data?.items || data?.blocks || (Array.isArray(data) ? data : []));
    } catch (error) {
      log.error("AdminShopLayout.load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const seedDefault = async () => {
    if (!window.confirm("Seed default home layout?")) return;
    try {
      await api.post("/admin/shop-layout/seed-default-home");
      load();
    } catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const addBlock = async () => {
    if (!newBlock.title) return;
    setAdding(true);
    try {
      await api.post("/admin/shop-layout", newBlock);
      setNewBlock({ type: "hero", title: "", subtitle: "", image_url: "", link_url: "" });
      load();
    } catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setAdding(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete block?")) return;
    try {
      await api.delete(`/admin/shop-layout/${id}`);
      load();
    } catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const reorder = async (idx, delta) => {
    const newOrder = [...blocks];
    const target = idx + delta;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    setBlocks(newOrder);
    try {
      await api.post("/admin/shop-layout/reorder", { ids: newOrder.map((b) => b.id) });
    } catch (e) { alert("Reorder failed"); load(); }
  };

  return (
    <Layout title="Admin · Shop layout">
      <div className="flex gap-2 mb-4">
        <button data-testid="sl-seed" onClick={seedDefault} className="sc-btn-outline text-sm">Seed default home</button>
      </div>

      <div className="sc-card p-4 mb-4" data-testid="sl-add">
        <div className="font-extrabold mb-3">Add block</div>
        <div className="grid md:grid-cols-2 gap-2">
          <select className="sc-input" data-testid="sl-type" value={newBlock.type} onChange={(e) => setNewBlock({ ...newBlock, type: e.target.value })}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="sc-input" data-testid="sl-title" placeholder="Title" value={newBlock.title} onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })} />
          <input className="sc-input" data-testid="sl-subtitle" placeholder="Subtitle" value={newBlock.subtitle} onChange={(e) => setNewBlock({ ...newBlock, subtitle: e.target.value })} />
          <input className="sc-input" data-testid="sl-image" placeholder="Image URL" value={newBlock.image_url} onChange={(e) => setNewBlock({ ...newBlock, image_url: e.target.value })} />
          <input className="sc-input md:col-span-2" data-testid="sl-link" placeholder="Link URL" value={newBlock.link_url} onChange={(e) => setNewBlock({ ...newBlock, link_url: e.target.value })} />
        </div>
        <button data-testid="sl-add-btn" disabled={adding || !newBlock.title} onClick={addBlock} className="sc-btn-primary mt-3 inline-flex items-center gap-1.5">
          {adding ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Add block
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-2" data-testid="sl-list">
          {blocks.length === 0 && <div className="sc-card p-6 text-center text-[color:var(--sc-ink-muted)]">No blocks. Seed defaults or add a block.</div>}
          {blocks.map((b, i) => (
            <div key={b.id} className="sc-card p-3 flex items-center gap-3" data-testid={`sl-row-${b.id}`}>
              {b.image_url && <img alt="" src={b.image_url} className="w-14 h-14 rounded-lg object-cover border border-[color:var(--sc-border)]" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="sc-chip uppercase">{b.type}</span>
                  <div className="font-semibold truncate">{b.title || "(no title)"}</div>
                </div>
                <div className="text-xs text-[color:var(--sc-ink-muted)] truncate">{b.subtitle || b.link_url || "—"}</div>
              </div>
              <button data-testid={`sl-up-${b.id}`} onClick={() => reorder(i, -1)} className="p-1.5 rounded-lg border border-[color:var(--sc-border)]"><ArrowUp size={14} /></button>
              <button data-testid={`sl-down-${b.id}`} onClick={() => reorder(i, 1)} className="p-1.5 rounded-lg border border-[color:var(--sc-border)]"><ArrowDown size={14} /></button>
              <button data-testid={`sl-del-${b.id}`} onClick={() => remove(b.id)} className="p-1.5 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)]"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
