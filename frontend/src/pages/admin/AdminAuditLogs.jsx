import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatDateTime } from "@/lib/utils";
import { Search } from "lucide-react";
import { log } from "@/lib/log";

export default function AdminAuditLogs() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/audit-logs", { params: { q, limit: 100 } });
      setItems(data?.items || (Array.isArray(data) ? data : []));
    } catch (error) { log.error("AdminAuditLogs.load failed", error); }
    finally { setLoading(false); }
  }, [q]);
  useEffect(() => { load(); }, [load]);

  return (
    <Layout title="Admin · Audit log">
      <div className="sc-card p-3 flex items-center gap-2 mb-4">
        <Search size={16} className="text-[color:var(--sc-ink-muted)] ml-1" />
        <input data-testid="al-q" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Search by admin, action, target" className="flex-1 bg-transparent outline-none text-sm" />
        <button data-testid="al-search" onClick={load} className="sc-btn-primary text-sm py-1.5">Search</button>
      </div>

      {loading ? <Spinner /> : (
        <div className="sc-card overflow-x-auto" data-testid="al-list">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr><th className="text-left px-4 py-2.5">When</th><th className="text-left px-4 py-2.5">Admin</th><th className="text-left px-4 py-2.5">Action</th><th className="text-left px-4 py-2.5">Target</th><th className="text-left px-4 py-2.5">Details</th></tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-t border-[color:var(--sc-border)]" data-testid={`al-${a.id}`}>
                  <td className="px-4 py-2 text-xs text-[color:var(--sc-ink-muted)] whitespace-nowrap">{formatDateTime(a.created_at || a.timestamp)}</td>
                  <td className="px-4 py-2 text-xs">
                    <div className="font-semibold">{a.admin_email || a.actor_email || a.actor_name || "—"}</div>
                    <div className="text-[10px] text-[color:var(--sc-ink-muted)]">{a.admin_role || a.actor_role || ""}</div>
                  </td>
                  <td className="px-4 py-2"><span className="sc-chip">{a.action}</span></td>
                  <td className="px-4 py-2 text-xs">{a.target_type ? `${a.target_type}:${(a.target_id || "").slice(0, 12)}` : (a.target || "—")}</td>
                  <td className="px-4 py-2 text-xs text-[color:var(--sc-ink-muted)] max-w-md truncate">{a.details && typeof a.details === "object" ? JSON.stringify(a.details) : (a.details || a.note || "—")}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No entries.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
