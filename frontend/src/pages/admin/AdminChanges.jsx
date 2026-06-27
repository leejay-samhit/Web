import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatDateTime } from "@/lib/utils";
import { log } from "@/lib/log";

export default function AdminChanges() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/changes", { params: { limit: 100 } });
      setList(data?.items || (Array.isArray(data) ? data : []));
    } catch (error) { log.error("AdminChanges.load failed", error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Layout title="Admin · Product roadmap"><Spinner /></Layout>;

  return (
    <Layout title="Admin · Product roadmap & changes">
      <div className="text-sm text-[color:var(--sc-ink-muted)] mb-3">
        Recent admin-driven changes & system events (matches the mobile <strong>Product roadmap</strong> feed).
      </div>
      <div className="sc-card p-2" data-testid="ch-list">
        {list.length === 0 ? (
          <div className="text-sm text-[color:var(--sc-ink-muted)] py-6 text-center">No entries.</div>
        ) : (
          <div className="divide-y divide-[color:var(--sc-border)]">
            {list.map((c, i) => {
              const safe = (v) => {
                if (v == null) return "";
                if (typeof v === "object") return v.name || v.email || v.id || JSON.stringify(v);
                return String(v);
              };
              const adminLabel = safe(c.admin_email) || safe(c.admin_id) || safe(c.admin) || "—";
              const targetIdStr = safe(c.target_id);
              return (
              <div key={(typeof c.id === "string" || typeof c.id === "number") ? c.id : i} className="p-3" data-testid={`ch-${(typeof c.id === "string" || typeof c.id === "number") ? c.id : i}`}>
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="sc-chip">{safe(c.action) || "change"}</span>
                  {c.target_type && <span className="text-xs text-[color:var(--sc-ink-muted)]">on {safe(c.target_type)}{targetIdStr ? `:${targetIdStr.slice(0, 10)}` : ""}</span>}
                  <span className="ml-auto text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(c.created_at || c.date)}</span>
                </div>
                <div className="text-xs mt-1">by <strong>{adminLabel}</strong> {c.admin_role ? `· ${safe(c.admin_role)}` : ""}</div>
                {c.details && typeof c.details === "object" && Object.keys(c.details).length > 0 && (
                  <details className="mt-1">
                    <summary className="text-xs text-[color:var(--sc-primary)] cursor-pointer">Details</summary>
                    <pre className="text-[11px] mt-1 bg-[color:var(--sc-accent-light)] p-2 rounded overflow-x-auto">{JSON.stringify(c.details, null, 2)}</pre>
                  </details>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
