import { useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { formatINR, formatDateTime } from "@/lib/utils";
import { Package, CheckCircle2, Store, Banknote } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { stageChipClass, stageMeta } from "@/lib/orders";

function OrdersList({ orders }) {
  return (
    <div className="space-y-3" data-testid="orders-list">
      {orders.map((o) => (
        <div key={o.id} className="sc-card p-4" data-testid={`order-${o.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-extrabold">#{(o.id || "").slice(0, 8)}</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(o.created_at)}</div>
            </div>
            <span className={stageChipClass(o.status)} data-testid={`order-${o.id}-stage`}>{stageMeta(o.status).label}</span>
            <div className="font-extrabold text-[color:var(--sc-primary)]">{formatINR(o.total || o.amount)}</div>
          </div>

          {/* Vendor + payment mode strip. `vendor_name` is populated by the
              backend once ORDER_MANAGEMENT_BACKEND_SPEC.md ships; falls back
              to per-item vendor if the top-level field is missing. */}
          {(o.vendor_name || o.shop_name || o.payment_method) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--sc-ink-muted)]" data-testid={`order-${o.id}-meta`}>
              {(o.vendor_name || o.shop_name) && (
                <span className="inline-flex items-center gap-1"><Store size={11} /> Sold by <b className="text-[color:var(--sc-ink)]">{o.vendor_name || o.shop_name}</b></span>
              )}
              {o.payment_method && (
                <span className="inline-flex items-center gap-1"><Banknote size={11} /> {String(o.payment_method).toUpperCase() === "COD" ? "Cash on delivery" : "Paid online"}</span>
              )}
            </div>
          )}

          {Array.isArray(o.items) && o.items.length > 0 && (
            <div className="mt-3 grid sm:grid-cols-2 gap-2">
              {o.items.slice(0, 4).map((it, i) => (
                <div
                  key={it.product_id || it.id || `${it.name || it.product_name}-${i}`}
                  className="flex items-center gap-2 text-xs text-[color:var(--sc-ink-muted)]"
                >
                  <div className="w-2 h-2 rounded-full bg-[color:var(--sc-primary)]" />
                  <div className="truncate">{it.name || it.product_name} × {it.qty || 1}</div>
                  {it.vendor_name && !o.vendor_name && (
                    <span className="text-[10px] text-[color:var(--sc-ink-muted)]">· {it.vendor_name}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function renderOrders(loading, orders) {
  if (loading) return <Spinner />;
  if (orders.length === 0) {
    return <EmptyState icon={Package} title="No orders yet" hint="Your purchases will show up here." />;
  }
  return <OrdersList orders={orders} />;
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sp] = useSearchParams();
  const successParam = sp.get("success");
  const success = successParam === "1" || successParam === "cod";
  const wasCOD = successParam === "cod";

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
            <div className="font-extrabold">{wasCOD ? "COD order placed!" : "Payment successful!"}</div>
            <div className="text-sm text-[color:var(--sc-ink-muted)]">
              {wasCOD
                ? "Your vendor will confirm and dispatch shortly. Please keep the amount ready for delivery."
                : "Your order has been placed."}
            </div>
          </div>
        </div>
      )}
      {renderOrders(loading, orders)}
    </Layout>
  );
}
