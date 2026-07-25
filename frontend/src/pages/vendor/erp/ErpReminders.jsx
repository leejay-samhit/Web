import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import BackendPendingBanner from "@/components/erp/BackendPendingBanner";
import { listReminders } from "@/lib/erp";
import { formatDate } from "@/lib/utils";
import { BellRing, AlertTriangle, Info, ShieldAlert } from "lucide-react";

const SEVERITY = {
  INFO:    { bg: "bg-sky-50 border-sky-200 text-sky-800",       icon: Info },
  WARNING: { bg: "bg-amber-50 border-amber-200 text-amber-900", icon: AlertTriangle },
  ACTION:  { bg: "bg-red-50 border-red-200 text-red-800",       icon: ShieldAlert },
};

export default function ErpReminders() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await listReminders();
        setItems(Array.isArray(d) ? d : []);
      } catch { setPending(true); }
      setLoading(false);
    })();
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6" data-testid="erp-reminders">
        <VendorNav />
        <ErpNav />
        {pending && <BackendPendingBanner endpoint="/api/erp/reminders" note="No reminders will appear until the backend is wired." />}
        <div className="sc-card p-4 mb-3 flex items-center gap-2">
          <BellRing size={16} className="text-[color:var(--sc-primary)]" />
          <div className="font-extrabold">Reminders</div>
        </div>
        {loading ? (
          <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="sc-card p-8 text-center text-sm text-[color:var(--sc-ink-muted)]" data-testid="reminders-empty">All caught up. No pending reminders.</div>
        ) : (
          <div className="space-y-2">
            {items.map((r, i) => {
              const spec = SEVERITY[r.severity] || SEVERITY.INFO;
              const Icon = spec.icon;
              return (
                <div key={i} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${spec.bg}`}>
                  <Icon size={16} className="mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <div className="font-semibold uppercase text-xs tracking-wider">{r.kind}</div>
                    <div className="text-sm">{r.text}</div>
                    {r.dueDate && <div className="text-[11px] mt-0.5">Due {formatDate(r.dueDate)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
