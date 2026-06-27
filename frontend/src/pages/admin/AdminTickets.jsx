import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatDateTime } from "@/lib/utils";
import { Search } from "lucide-react";
import { log } from "@/lib/log";

const STATUSES = ["open", "pending", "in_progress", "closed"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

export default function AdminTickets() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (q) params.q = q;
      const [t, s] = await Promise.allSettled([
        api.get("/admin/tickets", { params }),
        api.get("/admin/tickets/stats"),
      ]);
      if (t.status === "fulfilled") setItems(Array.isArray(t.value.data) ? t.value.data : t.value.data?.items || []);
      if (s.status === "fulfilled") setStats(s.value.data);
    } catch (error) {
      log.error("AdminTickets.load failed", error);
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => { load(); }, [load]);

  const updateTicket = async (id, patch) => {
    try {
      await api.patch(`/admin/tickets/${id}`, patch);
      load();
    } catch (error) {
      log.error("AdminTickets.update failed", error);
    }
  };

  return (
    <Layout title="Admin · Tickets">
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4" data-testid="at-stats">
          {[
            { k: "open", label: "Open" },
            { k: "in_progress", label: "In progress" },
            { k: "pending", label: "Pending" },
            { k: "closed", label: "Closed" },
          ].map((s) => (
            <div key={s.k} className="sc-card p-4">
              <div className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">{s.label}</div>
              <div className="text-2xl font-extrabold mt-1">{stats[s.k] ?? stats[`${s.k}_count`] ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <button onClick={() => setStatus("")} data-testid="at-filter-all" className={`text-xs font-bold px-3 py-1.5 rounded-full border ${!status ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}>All</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)} data-testid={`at-filter-${s}`} className={`text-xs font-bold px-3 py-1.5 rounded-full border capitalize ${status === s ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}>{s.replace("_"," ")}</button>
        ))}
        <div className="flex items-center gap-2 ml-auto sc-card px-2.5 py-1.5">
          <Search size={14} className="text-[color:var(--sc-ink-muted)]" />
          <input data-testid="at-search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="text-sm bg-transparent outline-none" />
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div className="sc-card overflow-x-auto" data-testid="at-table">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]"><tr>
              <th className="text-left px-4 py-2.5">Ticket</th>
              <th className="text-left px-4 py-2.5 hidden md:table-cell">User</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Priority</th>
              <th className="text-left px-4 py-2.5 hidden lg:table-cell">Updated</th>
            </tr></thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-[color:var(--sc-border)] hover:bg-[color:var(--sc-accent-light)]/30" data-testid={`at-row-${t.id}`}>
                  <td className="px-4 py-2.5">
                    <Link to={`/support/${t.id}`} className="font-semibold underline decoration-dotted">{t.subject || "(no subject)"}</Link>
                    <div className="text-[11px] text-[color:var(--sc-ink-muted)]">#{(t.id || "").slice(0, 8)} · {t.category}</div>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-xs">{t.user_name || t.user_email}</td>
                  <td className="px-4 py-2.5">
                    <select value={t.status || "open"} onChange={(e) => updateTicket(t.id, { status: e.target.value })} data-testid={`at-status-${t.id}`} className="text-xs border border-[color:var(--sc-border)] rounded-lg px-2 py-1">
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <select value={t.priority || "normal"} onChange={(e) => updateTicket(t.id, { priority: e.target.value })} data-testid={`at-prio-${t.id}`} className="text-xs border border-[color:var(--sc-border)] rounded-lg px-2 py-1">
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(t.updated_at || t.created_at)}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No tickets.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
