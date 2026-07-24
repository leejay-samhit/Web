import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import BlockEditor from "@/components/admin/BlockEditor";
import { BLOCK_TYPE_BY_KEY } from "@/constants/shopBlocks";
import { Plus, Trash2, ArrowUp, ArrowDown, Edit3, Eye, EyeOff } from "lucide-react";
import { log } from "@/lib/log";

export default function AdminShopLayout() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {id,...} = edit

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/shop-layout");
      setBlocks(data?.items || data?.blocks || (Array.isArray(data) ? data : []));
    } catch (error) { log.error("AdminShopLayout.load failed", error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const seedDefault = async () => {
    if (!window.confirm("Seed default home layout?")) return;
    try { await api.post("/admin/shop-layout/seed-default-home"); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const migrateBanners = async () => {
    if (!window.confirm("Migrate legacy promo banners into the new shop-layout blocks?")) return;
    try { await api.post("/admin/shop-layout/migrate-banners"); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete block?")) return;
    try { await api.delete(`/admin/shop-layout/${id}`); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const toggleActive = async (b) => {
    // Backend uses PATCH for partial updates (PUT returned 405 in prod).
    try { await api.patch(`/admin/shop-layout/${b.id}`, { active: !b.active }); load(); }
    catch (e) {
      // Some backends still use PUT — fall back so we don't 405-loop.
      try { await api.put(`/admin/shop-layout/${b.id}`, { ...b, active: !b.active }); load(); }
      catch (e2) { alert(e2?.response?.data?.detail || e?.response?.data?.detail || "Failed"); }
    }
  };

  const reorder = async (idx, delta) => {
    const newOrder = [...blocks];
    const target = idx + delta;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    setBlocks(newOrder);
    // Try the two most common shapes: /reorder POST { ids } and PATCH bulk.
    try {
      await api.post("/admin/shop-layout/reorder", { ids: newOrder.map((b) => b.id) });
    } catch (e) {
      try {
        await api.patch("/admin/shop-layout/reorder", { ids: newOrder.map((b) => b.id) });
      } catch (e2) {
        // Last-ditch: update each row's sort_order individually.
        try {
          await Promise.all(newOrder.map((b, i) => api.patch(`/admin/shop-layout/${b.id}`, { sort_order: i })));
        } catch {
          alert(e?.response?.data?.detail || "Reorder failed"); load();
        }
      }
    }
  };

  return (
    <Layout title="Admin · Shop layout">
      <div className="flex flex-wrap gap-2 mb-4">
        <button data-testid="sl-new" onClick={() => setEditing({})} className="sc-btn-primary inline-flex items-center gap-1.5"><Plus size={14} /> Add block</button>
        <button data-testid="sl-seed" onClick={seedDefault} className="sc-btn-outline text-sm">Seed default home</button>
        <button data-testid="sl-migrate" onClick={migrateBanners} className="sc-btn-outline text-sm">Migrate legacy banners</button>
        <div className="ml-auto text-xs text-[color:var(--sc-ink-muted)] self-center">{blocks.length} block(s)</div>
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-2" data-testid="sl-list">
          {blocks.length === 0 && <div className="sc-card p-6 text-center text-[color:var(--sc-ink-muted)]">No blocks. Click &ldquo;Add block&rdquo; or &ldquo;Seed default home&rdquo;.</div>}
          {blocks.map((b, i) => {
            const cfg = BLOCK_TYPE_BY_KEY[b.block_type] || { label: b.block_type };
            return (
              <div key={b.id} className={`sc-card p-3 flex items-center gap-3 ${!b.active ? "opacity-60" : ""}`} data-testid={`sl-row-${b.id}`}>
                {b.image_data_url ? (
                  <img alt="" src={b.image_data_url} className="w-14 h-14 rounded-lg object-cover border border-[color:var(--sc-border)]" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)] text-[10px] font-bold uppercase text-center">{cfg.label?.split(" ")[0]}</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="sc-chip uppercase">{cfg.label}</span>
                    {b.scope && b.scope !== "home" && <span className="sc-chip text-[10px]">{b.scope}{b.scope_category ? `:${b.scope_category}` : ""}</span>}
                    <div className="font-semibold truncate">{b.title || "(no title)"}</div>
                  </div>
                  <div className="text-xs text-[color:var(--sc-ink-muted)] truncate">
                    {b.subtitle || cfg.description}
                    {b.items?.length ? ` · ${b.items.length} items` : ""}
                    {b.product_ids?.length ? ` · ${b.product_ids.length} products` : ""}
                  </div>
                </div>
                <button data-testid={`sl-toggle-${b.id}`} title={b.active ? "Disable" : "Enable"} onClick={() => toggleActive(b)} className="p-1.5 rounded-lg border border-[color:var(--sc-border)]">
                  {b.active ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button data-testid={`sl-up-${b.id}`} onClick={() => reorder(i, -1)} className="p-1.5 rounded-lg border border-[color:var(--sc-border)]"><ArrowUp size={14} /></button>
                <button data-testid={`sl-down-${b.id}`} onClick={() => reorder(i, 1)} className="p-1.5 rounded-lg border border-[color:var(--sc-border)]"><ArrowDown size={14} /></button>
                <button data-testid={`sl-edit-${b.id}`} onClick={() => setEditing(b)} className="p-1.5 rounded-lg border border-[color:var(--sc-border)]"><Edit3 size={14} /></button>
                <button data-testid={`sl-del-${b.id}`} onClick={() => remove(b.id)} className="p-1.5 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)]"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <BlockEditor block={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </Layout>
  );
}
