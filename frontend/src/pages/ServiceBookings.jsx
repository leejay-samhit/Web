import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { formatINR, formatDateTime } from "@/lib/utils";
import { Calendar, MapPin } from "lucide-react";
import { log } from "@/lib/log";

const ROLES = [
  { key: "customer", label: "As customer" },
  { key: "provider", label: "As provider" },
];

export default function ServiceBookings() {
  const [role, setRole] = useState("customer");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/services/bookings/me", { params: { role } });
      setItems(Array.isArray(data) ? data : data?.items || []);
    } catch (error) {
      log.error("ServiceBookings.load failed", error);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { load(); }, [load]);

  return (
    <Layout title="My service bookings">
      <div className="flex gap-2 mb-4">
        {ROLES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRole(r.key)}
            data-testid={`sb-role-${r.key}`}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border ${role === r.key ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={Calendar} title="No bookings yet" hint={role === "customer" ? "Book a service from the Services page." : "Bookings sent to you will appear here."} />
      ) : (
        <div className="space-y-2" data-testid="sb-list">
          {items.map((b) => (
            <div key={b.id} className="sc-card p-4" data-testid={`sb-${b.id}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-extrabold">{b.service_name || b.provider_name || "Booking"}</div>
                  <div className="text-xs text-[color:var(--sc-ink-muted)] flex items-center gap-2">
                    <Calendar size={12} /> {formatDateTime(b.created_at)}
                    {b.pincode && (<><MapPin size={12} /> {b.pincode}</>)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold">{formatINR(b.charge || b.amount)}</div>
                  <span className="sc-chip">{b.status}</span>
                </div>
              </div>
              {b.notes && <div className="text-sm text-[color:var(--sc-ink-muted)] mt-2">{b.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
