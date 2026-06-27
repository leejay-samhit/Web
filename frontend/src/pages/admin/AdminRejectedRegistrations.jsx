import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Trash2, Download } from "lucide-react";
import { initials, formatDateTime } from "@/lib/utils";
import { log } from "@/lib/log";

export default function AdminRejectedRegistrations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/rejected-registrations", { params: { q, limit: 100 } });
      setItems(data?.items || (Array.isArray(data) ? data : []));
    } catch (error) { log.error("AdminRejectedRegistrations.load failed", error); }
    finally { setLoading(false); }
  }, [q]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    try {
      const res = await api.get("/admin/rejected-registrations/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "rejected-registrations.csv"; a.click();
    } catch (e) { alert("Export failed"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    try { await api.delete(`/admin/rejected-registrations/${id}`); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <Layout title="Admin · Rejected registrations">
      <div className="flex gap-2 mb-3">
        <input className="sc-input flex-1" data-testid="rr-q" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <button data-testid="rr-search" onClick={load} className="sc-btn-primary text-sm">Search</button>
        <button data-testid="rr-export" onClick={exportCsv} className="sc-btn-outline text-sm inline-flex items-center gap-1.5"><Download size={14} /> CSV</button>
      </div>

      {loading ? <Spinner /> : (
        <div className="sc-card overflow-x-auto" data-testid="rr-table">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr><th className="text-left px-4 py-2.5">User</th><th className="text-left px-4 py-2.5">Email</th><th className="text-left px-4 py-2.5">Reason</th><th className="text-left px-4 py-2.5">Rejected at</th><th className="text-right px-4 py-2.5">Actions</th></tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id || u._id} className="border-t border-[color:var(--sc-border)]" data-testid={`rr-row-${u.id || u._id}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full sc-avatar text-white text-[11px] font-bold grid place-items-center">{initials(u.name)}</div>
                      <div className="font-semibold">{u.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{u.email}</td>
                  <td className="px-4 py-2.5 text-xs">{u.reject_reason || u.reason || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(u.rejected_at || u.created_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button data-testid={`rr-del-${u.id || u._id}`} onClick={() => remove(u.id || u._id)} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center gap-1">
                      <Trash2 size={12} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No records.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
