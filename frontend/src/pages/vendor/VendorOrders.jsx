import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import apiLocal from "@/lib/apiLocal";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import Spinner from "@/components/Spinner";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDateTime, resolveImageUrl } from "@/lib/utils";
import { log } from "@/lib/log";
import { Download, Search, ArrowRight, Package, Phone, MapPin, User as UserIcon, RefreshCw } from "lucide-react";
import {
  ORDER_STAGES, stageChipClass, stageMeta, nextStages,
  orderCustomerName, orderCustomerPhone, orderAmount, orderProductName,
  exportOrdersToExcel,
} from "@/lib/orders";

/**
 * Vendor · Orders — the vendor's inbox of orders that contain their products.
 * Vendor advances the stage via a tap-to-advance button (no tracking-ID modal
 * per product decision 04-Jul-2026).
 *
 * Backend contract (see /app/memory/ORDER_MANAGEMENT_BACKEND_SPEC.md):
 *   GET   /api/vendor/me/orders  → { items: [ Order, ... ] }
 *   PATCH /api/vendor/orders/{id}/status  { status: "packed" }
 *
 * If those endpoints aren't live yet, the page shows a graceful "Backend not
 * ready" banner with the exact endpoint names to hand to the backend dev.
 */
export default function VendorOrders() {
  const { user, refreshMe } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [backendReady, setBackendReady] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  // Confirmation modal for the Delivered transition — vendor must acknowledge
  // that cash (COD) or payout (UPI) has been collected before marking as done.
  const [deliverConfirm, setDeliverConfirm] = useState(null);
  // Auto-sync polling — silently refetch every 30s so vendors see mobile-app
  // status changes without manual refresh. Tracks last-sync timestamp and
  // toasts on new orders / status changes (per user decision Feb-2026).
  const [lastSynced, setLastSynced] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const prevOrdersRef = useRef(new Map());
  const initialLoadedRef = useRef(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    else setSyncing(true);
    setErrorMsg("");
    // Primary source = the external backend's real shop-order feed
    // (`/vendor/me/sales`) — this is exactly what the mobile app shows under
    // "Shop Orders". We key each row on `order_id` so the status PATCH targets
    // the same order the app manages. Local mirror orders (web checkout) are
    // merged in as a supplement.
    let merged = [];
    let sawAny = false;
    try {
      const { data } = await api.get("/vendor/me/sales");
      const sales = Array.isArray(data) ? data : data?.items || data?.sales || [];
      merged = sales.map((s) => ({
        ...s,
        id: s.order_id || s.id,   // PATCH /vendor/orders/{order_id}/status
        sale_id: s.id,
        source: "app",
      }));
      sawAny = true;
    } catch (error) {
      const status = error?.response?.status;
      if (status && status !== 404 && status !== 405 && status !== 501) {
        if (!silent) setErrorMsg(error?.response?.data?.detail || "Could not load orders.");
      }
    }
    try {
      const { data } = await apiLocal.get("/vendor/me/orders");
      const local = Array.isArray(data?.items) ? data.items : [];
      const seen = new Set(merged.map((o) => o.id));
      merged = [...merged, ...local.filter((o) => !seen.has(o.id)).map((o) => ({ ...o, source: "web" }))];
      sawAny = sawAny || local.length > 0;
    } catch { /* local backend may be offline */ }

    // Client-side status filter (the sales feed doesn't accept a status param).
    if (statusFilter) merged = merged.filter((o) => o.status === statusFilter);

    // Diff against previous snapshot to notify on new orders / status changes.
    const prev = prevOrdersRef.current;
    if (initialLoadedRef.current && prev.size > 0) {
      let newCount = 0;
      const changes = [];
      merged.forEach((o) => {
        const before = prev.get(o.id);
        if (!before) newCount += 1;
        else if (before !== o.status) changes.push({ id: o.id, from: before, to: o.status });
      });
      if (newCount > 0) {
        toast.success(`${newCount} new order${newCount > 1 ? "s" : ""} received`, { id: "vo-new-orders" });
      }
      changes.slice(0, 3).forEach((c) => {
        toast.info(`Order ${c.id.slice(0, 8)} · ${c.from || "?"} → ${c.to}`, { id: `vo-status-${c.id}` });
      });
      if (changes.length > 3) {
        toast.info(`+${changes.length - 3} more status updates`, { id: "vo-status-overflow" });
      }
    }
    prevOrdersRef.current = new Map(merged.map((o) => [o.id, o.status]));
    initialLoadedRef.current = true;

    setOrders(merged);
    setBackendReady(sawAny || merged.length === 0);
    setLastSynced(new Date());
    if (!silent) setLoading(false);
    else setSyncing(false);
  }, [statusFilter]);

  // Initial load whenever the filter changes.
  useEffect(() => {
    initialLoadedRef.current = false;
    prevOrdersRef.current = new Map();
    load();
  }, [load]);

  // 30s background polling — paused when the tab is hidden to save quota.
  useEffect(() => {
    const POLL_MS = 30000;
    let timer = null;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      load({ silent: true });
    };
    timer = setInterval(tick, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") load({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  const advance = async (orderId, nextStatus, orderRef) => {
    // Delivered → require confirmation (COD-cash-collected / UPI-payout ack)
    if (nextStatus === "delivered" && orderRef) {
      setDeliverConfirm({ orderId, order: orderRef });
      return;
    }
    setBusy(orderId);
    try {
      // The external Slangcart backend owns order status
      // (`PATCH /vendor/orders/{order_id}/status`). Fall back to the local
      // mirror only for web-placed orders it doesn't know about.
      try {
        await api.patch(`/vendor/orders/${orderId}/status`, { status: nextStatus });
      } catch (e) {
        const st = e?.response?.status;
        if (st === 404 || st === 405 || st === 501) {
          await apiLocal.patch(`/vendor/orders/${orderId}/status`, { status: nextStatus });
        } else {
          throw e;
        }
      }
      await load({ silent: true });
      toast.success(`Order updated → ${stageMeta(nextStatus).label}`, { id: `vo-adv-${orderId}` });
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404 || status === 405) {
        setBackendReady(false);
      } else {
        toast.error(e?.response?.data?.detail || "Could not update this order status.");
      }
    } finally {
      setBusy(null);
    }
  };

  const confirmDelivered = async () => {
    if (!deliverConfirm) return;
    const { orderId } = deliverConfirm;
    setDeliverConfirm(null);
    setBusy(orderId);
    try {
      // Also flip payment status to paid/collected on delivery.
      try {
        await api.patch(`/vendor/orders/${orderId}/status`, { status: "delivered", mark_paid: true });
      } catch (e) {
        const st = e?.response?.status;
        if (st === 404 || st === 405 || st === 501) {
          await apiLocal.patch(`/vendor/orders/${orderId}/status`, { status: "delivered", mark_paid: true });
        } else {
          throw e;
        }
      }
      await load({ silent: true });
      toast.success("Order marked delivered", { id: `vo-deliver-${orderId}` });
      // Delivery credits the vendor's wallet on the backend — pull the fresh
      // balance so the web wallet reflects it immediately, matching the app.
      refreshMe?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not update status.");
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((o) => {
      const bag = [
        o.id, orderCustomerName(o), orderCustomerPhone(o), orderProductName(o),
      ].join(" ").toLowerCase();
      return bag.includes(needle);
    });
  }, [orders, q]);

  const download = () => {
    const shopName = user?.vendor?.shop_name || user?.shop_name || "shop";
    // Attach vendor identity to every row for the Excel — data may not include it.
    const enriched = filtered.map((o) => ({
      ...o,
      vendor_name: o.vendor_name || o.shop_name || shopName,
      vendor_email: o.vendor_email || user?.email || "",
      vendor_phone: o.vendor_phone || o.vendor_mobile || user?.phone || "",
    }));
    const filename = exportOrdersToExcel(enriched, { role: "vendor", shopName });
    log.info?.("VendorOrders.download →", filename);
  };

  return (
    <Layout title="Vendor · Orders">
      <VendorNav />

      {!backendReady && (
        <div className="sc-card p-4 mb-3 bg-[color:var(--sc-accent-light)]/40 border-[color:var(--sc-border)] text-[color:var(--sc-ink)] text-sm" data-testid="vo-backend-missing">
          <div className="font-extrabold mb-1">Order inbox will populate here</div>
          <div className="text-[13px] text-[color:var(--sc-ink-muted)]">
            You (the vendor) manage every order from placed → delivered. Admin sees this data as read-only.
            The backend is preparing the vendor-scoped feed — once live, orders will appear automatically.
          </div>
        </div>
      )}

      <div className="sc-card p-3 mb-3 flex flex-wrap items-center gap-2" data-testid="vo-toolbar">
        <div className="flex-1 min-w-[220px] flex items-center gap-1.5 border border-[color:var(--sc-border)] rounded-lg px-2 py-1">
          <Search size={14} className="text-[color:var(--sc-ink-muted)]" />
          <input
            data-testid="vo-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by user, product, order ID"
            className="flex-1 text-sm bg-transparent outline-none"
          />
        </div>
        <button
          data-testid="vo-refresh"
          onClick={() => load({ silent: true })}
          disabled={syncing}
          title={lastSynced ? `Last synced ${lastSynced.toLocaleTimeString()}` : "Sync now"}
          className="sc-btn-outline inline-flex items-center gap-1.5 text-sm disabled:opacity-60"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing…" : "Sync"}
        </button>
        <button
          data-testid="vo-download"
          onClick={download}
          disabled={filtered.length === 0}
          className="sc-btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-60"
        >
          <Download size={14} /> Download Excel ({filtered.length})
        </button>
      </div>

      {lastSynced && (
        <div className="text-[11px] text-[color:var(--sc-ink-muted)] mb-2 flex items-center gap-1.5" data-testid="vo-last-synced">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Auto-syncing every 30s · last checked {lastSynced.toLocaleTimeString()}
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-3">
        <button
          onClick={() => setStatusFilter("")}
          data-testid="vo-filter-all"
          className={
            "text-xs font-bold px-3 py-1.5 rounded-full border " +
            (!statusFilter ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]")
          }
        >
          All
        </button>
        {ORDER_STAGES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            data-testid={`vo-filter-${s.key}`}
            className={
              "text-xs font-bold px-3 py-1.5 rounded-full border capitalize " +
              (statusFilter === s.key ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : errorMsg ? (
        <div className="sc-card p-4 text-sm text-[color:var(--sc-error)]" data-testid="vo-error">{errorMsg}</div>
      ) : filtered.length === 0 ? (
        <div className="sc-card p-8 text-center text-[color:var(--sc-ink-muted)]" data-testid="vo-empty">
          <Package size={28} className="mx-auto opacity-40" />
          <div className="mt-2 text-sm">No orders yet.</div>
          <div className="text-xs mt-1">When a customer buys one of your products, the order will appear here for you to pack & ship.</div>
        </div>
      ) : (
        <div className="space-y-3" data-testid="vo-list">
          {filtered.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              busy={busy === o.id}
              onAdvance={(s) => advance(o.id, s, o)}
            />
          ))}
        </div>
      )}

      {deliverConfirm && (
        <DeliveredConfirmModal
          order={deliverConfirm.order}
          onConfirm={confirmDelivered}
          onCancel={() => setDeliverConfirm(null)}
        />
      )}
    </Layout>
  );
}

/* -------------------------------------------------------------------------- */
/*  Delivered confirmation modal — "Cash of ₹X collected?"                     */
/* -------------------------------------------------------------------------- */
function DeliveredConfirmModal({ order, onConfirm, onCancel }) {
  const amt = orderAmount(order);
  const isCOD = String(order?.paid_via || order?.payment_method || order?.mode || "").toLowerCase().includes("cod");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="vo-deliver-confirm"
      >
        <div className="font-extrabold text-lg text-[color:var(--sc-ink)]">Confirm delivery</div>
        <p className="text-sm text-[color:var(--sc-ink-muted)] mt-2">
          {isCOD
            ? <>Did you collect the <b className="text-[color:var(--sc-primary)]">Cash amount of {formatINR(amt)}</b> from {orderCustomerName(order) || "the customer"} on delivery?</>
            : <>Confirm that the parcel has been handed over to {orderCustomerName(order) || "the customer"} for the <b className="text-[color:var(--sc-primary)]">UPI-paid order of {formatINR(amt)}</b>.</>}
        </p>
        <div className="mt-2 text-[11px] text-[color:var(--sc-ink-muted)] italic">
          Marking as delivered will also flag the payment as {isCOD ? "collected (COD)" : "settled (UPI)"} on the invoice.
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            data-testid="vo-deliver-cancel"
            onClick={onCancel}
            className="sc-btn-outline text-sm"
          >
            Not yet
          </button>
          <button
            data-testid="vo-deliver-confirm-yes"
            onClick={onConfirm}
            className="sc-btn-primary text-sm inline-flex items-center gap-1.5"
          >
            {isCOD ? `Yes, collected ${formatINR(amt)}` : "Yes, delivered"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  One vendor-facing order card                                              */
/* -------------------------------------------------------------------------- */
function OrderCard({ order, busy, onAdvance }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const addr = order.shipping_address || {};
  const nexts = nextStages(order.status);
  const totalAmt = orderAmount(order);

  return (
    <div className="sc-card p-4 sm:p-5 space-y-3" data-testid={`vo-order-${order.id}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-extrabold text-[color:var(--sc-ink)]">Order · {(order.id || "").slice(0, 8)}</div>
          <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Placed {formatDateTime(order.created_at)}</div>
        </div>
        <span className={stageChipClass(order.status)} data-testid={`vo-order-${order.id}-stage`}>{stageMeta(order.status).label}</span>
      </div>

      {/* Customer + address (always visible per business rule) */}
      <div className="grid sm:grid-cols-2 gap-3 rounded-xl bg-[color:var(--sc-accent-light)]/40 p-3 border border-[color:var(--sc-border)]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] flex items-center gap-1"><UserIcon size={10} /> Customer</div>
          <div className="font-extrabold text-[color:var(--sc-ink)]">{orderCustomerName(order) || "—"}</div>
          {orderCustomerPhone(order) && (
            <a href={`tel:${orderCustomerPhone(order)}`} className="text-xs text-[color:var(--sc-primary)] inline-flex items-center gap-1 hover:underline">
              <Phone size={11} /> {orderCustomerPhone(order)}
            </a>
          )}
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] flex items-center gap-1"><MapPin size={10} /> Delivery address</div>
          <div className="text-xs text-[color:var(--sc-ink)]">
            {[addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ") || "—"}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.length === 0 && <div className="text-xs text-[color:var(--sc-ink-muted)]">No item lines returned by backend.</div>}
        {items.map((it, i) => (
          <div key={`${it.product_id || it.id || i}`} className="flex items-center gap-3 p-2 border border-[color:var(--sc-border)] rounded-lg">
            <div className="w-12 h-12 rounded-lg bg-[color:var(--sc-accent-light)] overflow-hidden shrink-0 grid place-items-center border border-[color:var(--sc-border)]">
              {it.image_url ? <img alt="" src={resolveImageUrl(it.image_url)} className="w-full h-full object-cover" /> : <Package size={18} className="text-[color:var(--sc-primary)]/60" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm text-[color:var(--sc-ink)] truncate">{it.product_name || it.name || "Product"}</div>
              <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Qty {it.qty || 1} · {formatINR(it.price || 0)}</div>
            </div>
            <div className="font-extrabold ml-2 whitespace-nowrap">{formatINR((it.price || 0) * (it.qty || 1))}</div>
          </div>
        ))}
      </div>

      {/* Footer: total + advance stage */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[color:var(--sc-border)] pt-3">
        <div className="text-sm">
          <span className="text-[color:var(--sc-ink-muted)]">Total:</span>{" "}
          <span className="text-lg font-extrabold text-[color:var(--sc-primary)]">{formatINR(totalAmt)}</span>
        </div>

        {nexts.length === 0 ? (
          <div className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Stage is final — no further action.</div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5" data-testid={`vo-order-${order.id}-actions`}>
            {nexts.slice(0, 4).map((s) => (
              <button
                key={s.key}
                onClick={() => onAdvance(s.key)}
                disabled={busy}
                data-testid={`vo-order-${order.id}-advance-${s.key}`}
                className={
                  "text-xs font-bold px-3 py-1.5 rounded-full border inline-flex items-center gap-1 " +
                  (s.final && s.key === "cancelled"
                    ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                    : "bg-[color:var(--sc-primary)] border-[color:var(--sc-primary)] text-white hover:bg-[color:var(--sc-primary-700)]") +
                  " disabled:opacity-50"
                }
              >
                {s.label} <ArrowRight size={11} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
