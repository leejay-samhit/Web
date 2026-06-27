import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import EmptyState from "@/components/EmptyState";
import { Bell } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { log } from "@/lib/log";

function NotifList({ items }) {
  return (
    <div className="divide-y divide-[color:var(--sc-border)]" data-testid="notif-page-list">
      {items.map((n) => (
        <div key={n.id} className="py-3 flex items-start gap-3">
          <div className={`mt-1 w-2 h-2 rounded-full ${n.read ? "bg-[color:var(--sc-border)]" : "bg-[color:var(--sc-primary)]"}`} />
          <div className="flex-1">
            <div className="font-semibold">{n.title}</div>
            <div className="text-sm text-[color:var(--sc-ink-muted)]">{n.body}</div>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-1">{formatDateTime(n.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function renderNotifs(loading, items) {
  if (loading) return null;
  if (items.length === 0) return <EmptyState icon={Bell} title="You're all caught up" />;
  return <NotifList items={items} />;
}

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications/me");
      setItems(Array.isArray(data) ? data : data?.items || []);
    } catch (error) {
      log.error("Notifications.load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const markAll = async () => {
    try {
      await api.post("/notifications/me/read-all");
    } catch (error) {
      log.error("Notifications.markAll failed", error);
    }
    load();
  };

  return (
    <Layout title="Notifications">
      <div className="sc-card p-5">
        <div className="flex justify-end mb-2">
          <button onClick={markAll} data-testid="notif-mark-all" className="text-sm font-semibold text-[color:var(--sc-primary)]">
            Mark all read
          </button>
        </div>
        {renderNotifs(loading, items)}
      </div>
    </Layout>
  );
}
