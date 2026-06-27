import { useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { formatINR, formatDateTime } from "@/lib/utils";
import { Package, CheckCircle2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sp] = useSearchParams();
  const success = sp.get("success") === "1";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/orders/me");
        if (alive) setOrders(Array.isArray(data) ? data : data?.items || []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Layout title="My orders">
      {success && (
        <div data-testid="order-success" className="sc-card p-4 mb-4 flex items-center gap-3 border-l-4 border-l-[color:var(--sc-success)]">
          <CheckCircle2 className="text-[color:var(--sc-success)]" />
          <div>
            <div className="font-extrabold">Payment successful!</div>
            <div className="text-sm text-[color:var(--sc-ink-muted)]">Your order has been placed.</div>
          </div>
        </div>
      )}
      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState icon={Package} title="No orders yet" hint="Your purchases will show up here." />
      ) : (
        <div className="space-y-3" data-testid="orders-list">
          {orders.map((o) => (
            <div key={o.id} className="sc-card p-4" data-testid={`order-${o.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold">#{(o.id || "").slice(0, 8)}</div>
                  <div className="text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(o.created_at)}</div>
                </div>
                <span className="sc-chip">{o.status || "placed"}</span>
                <div className="font-extrabold text-[color:var(--sc-primary)]">{formatINR(o.total || o.amount)}</div>
              </div>
              {Array.isArray(o.items) && o.items.length > 0 && (
                <div className="mt-3 grid sm:grid-cols-2 gap-2">
                  {o.items.slice(0, 4).map((it, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[color:var(--sc-ink-muted)]">
                      <div className="w-2 h-2 rounded-full bg-[color:var(--sc-primary)]" />
                      <div className="truncate">{it.name || it.product_name} × {it.qty || 1}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
