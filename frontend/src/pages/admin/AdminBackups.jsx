import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Database, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { log } from "@/lib/log";

export default function AdminBackups() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/backups");
      setList(data?.backups || data?.items || (Array.isArray(data) ? data : []));
    } catch (error) { log.error("AdminBackups.load failed", error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setCreating(true);
    try { await api.post("/admin/backups"); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setCreating(false); }
  };

  const restore = async (id) => {
    if (!window.confirm("Restore this snapshot? This will overwrite current data.")) return;
    try { await api.post(`/admin/backups/${id}/restore`); alert("Restore started"); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete snapshot?")) return;
    try { await api.delete(`/admin/backups/${id}`); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <Layout title="Admin · Data backups">
      <div className="mb-4">
        <button data-testid="bk-create" disabled={creating} onClick={create} className="sc-btn-primary inline-flex items-center gap-1.5">
          {creating ? <Loader2 className="animate-spin" size={14} /> : <Database size={14} />} Create snapshot
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="sc-card overflow-x-auto" data-testid="bk-list">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr><th className="text-left px-4 py-2.5">Snapshot</th><th className="text-left px-4 py-2.5">Created</th><th className="text-left px-4 py-2.5">Counts</th><th className="text-right px-4 py-2.5">Actions</th></tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-t border-[color:var(--sc-border)]" data-testid={`bk-${s.id}`}>
                  <td className="px-4 py-2.5">
                    <div className="font-mono text-xs">{s.id?.slice(0, 12)}…</div>
                    <div className="text-[10px] text-[color:var(--sc-ink-muted)]">{s.kind || "manual"}{s.note ? ` · ${s.note}` : ""}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(s.created_at)}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {s.counts ? (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(s.counts).slice(0, 4).map(([k, v]) => (
                          <span key={k} className="sc-chip text-[10px]">{k}: {v}</span>
                        ))}
                      </div>
                    ) : (s.size ? `${(s.size / 1024).toFixed(1)} KB` : "—")}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button data-testid={`bk-restore-${s.id}`} onClick={() => restore(s.id)} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] inline-flex items-center gap-1 mr-1">
                      <RotateCcw size={12} /> Restore
                    </button>
                    <button data-testid={`bk-del-${s.id}`} onClick={() => remove(s.id)} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center gap-1">
                      <Trash2 size={12} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No snapshots.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
