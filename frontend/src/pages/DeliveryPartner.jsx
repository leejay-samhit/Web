import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/utils";
import { log } from "@/lib/log";
import {
  Truck, Bike, MapPin, Phone, IndianRupee, Wallet, Package, Store,
  CheckCircle2, Clock, RefreshCw, ShieldCheck, User as UserIcon,
} from "lucide-react";

const TABS = [
  { key: "available", label: "Available", icon: Package },
  { key: "assigned", label: "Assigned", icon: Clock },
  { key: "out_for_delivery", label: "Out for delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const money = (v) => formatINR(Number(v || 0));

function StatusPill({ ok, children }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${ok ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
      {ok ? <CheckCircle2 size={12} /> : <Clock size={12} />} {children}
    </span>
  );
}

function OrderCard({ o }) {
  const id = o.order_id || o.id || "";
  const customer = o.buyer_name || o.customer_name || o.user_name || o.shipping_address?.name || "Customer";
  const phone = o.buyer_phone || o.customer_phone || o.shipping_address?.phone || o.phone;
  const addr = o.shipping_address || o.address || {};
  const line = [addr.line1, addr.line2, addr.city, addr.pincode].filter(Boolean).join(", ");
  const amount = o.total || o.amount || o.grand_total || 0;
  const vendor = o.vendor_name || o.shop_name || o.store_name;
  const status = o.status || o.delivery_status || "placed";
  return (
    <div className="sc-card p-4" data-testid={`dp-order-${id}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-mono text-[color:var(--sc-ink-muted)]">#{String(id).slice(0, 8).toUpperCase()}</div>
          <div className="font-extrabold text-sm mt-0.5">{customer}</div>
        </div>
        <span className="sc-chip bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] capitalize">{String(status).replace(/_/g, " ")}</span>
      </div>
      {vendor && <div className="text-xs mt-2 inline-flex items-center gap-1 text-[color:var(--sc-ink-muted)]"><Store size={12} /> {vendor}</div>}
      {line && <div className="text-xs mt-1 inline-flex items-start gap-1 text-[color:var(--sc-ink-muted)]"><MapPin size={12} className="mt-0.5 shrink-0" /> {line}</div>}
      <div className="flex items-center justify-between mt-3">
        <div className="font-extrabold text-[color:var(--sc-primary)]">{money(amount)}</div>
        {phone && (
          <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--sc-primary)]" data-testid={`dp-call-${id}`}>
            <Phone size={12} /> Call
          </a>
        )}
      </div>
    </div>
  );
}

export default function DeliveryPartner() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [mappedVendors, setMappedVendors] = useState(0);
  const [tab, setTab] = useState("available");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get("/delivery-partner/me");
      setProfile(data);
    } catch (e) { log.error("DP.loadProfile failed", e); }
  }, []);

  const loadOrders = useCallback(async ({ silent } = {}) => {
    if (silent) setSyncing(true);
    try {
      const { data } = await api.get("/delivery-partner/me/orders", { params: { status: tab } });
      setOrders(Array.isArray(data?.items) ? data.items : []);
      setCounts(data?.counts || {});
      setMappedVendors(data?.mapped_vendors || 0);
    } catch (e) { log.error("DP.loadOrders failed", e); }
    finally { if (silent) setSyncing(false); }
  }, [tab]);

  useEffect(() => {
    (async () => { setLoading(true); await Promise.all([loadProfile(), loadOrders()]); setLoading(false); })();
  }, [loadProfile, loadOrders]);

  // Live refresh every 30s so new deliveries appear without a manual reload.
  useEffect(() => {
    const t = setInterval(() => loadOrders({ silent: true }), 30000);
    return () => clearInterval(t);
  }, [loadOrders]);

  const app = profile?.application || {};
  const isApproved = profile?.is_approved ?? user?.is_delivery_partner_approved;
  const online = user?.delivery_available;
  const pincodes = app.pincodes || user?.delivery_pincodes || [];
  const radius = app.delivery_radius_km ?? user?.delivery_radius_km;
  const vehicle = app.vehicle_type || user?.dp_vehicle_type;

  const kpis = useMemo(() => ([
    { label: "Wallet balance", value: money(user?.wallet_balance), icon: Wallet, color: "#0F6E4F" },
    { label: "Total earned", value: money(user?.total_earned), icon: IndianRupee, color: "#0891B2" },
    { label: "Mapped vendors", value: mappedVendors, icon: Store, color: "#7C3AED" },
    { label: "Active deliveries", value: (counts.assigned || 0) + (counts.out_for_delivery || 0), icon: Truck, color: "#F59E0B" },
  ]), [user, mappedVendors, counts]);

  if (!user?.is_delivery_partner) {
    return (
      <Layout title="Delivery Partner">
        <EmptyState icon={Truck} title="Not a delivery partner" hint="This area is for approved Slangcart delivery partners. Apply from the mobile app to get started." />
      </Layout>
    );
  }

  if (loading) return <Layout title="Delivery Partner"><Spinner /></Layout>;

  return (
    <Layout title="Delivery Partner">
      {/* Hero */}
      <div className="rounded-3xl p-5 mb-4 text-white" style={{ background: "linear-gradient(135deg,#0F6E4F 0%,#0B5A40 100%)" }} data-testid="dp-hero">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-widest font-bold opacity-80 flex items-center gap-1.5"><Bike size={13} /> Delivery Partner</div>
            <div className="text-2xl font-extrabold mt-1">{app.full_name || user?.name}</div>
            <div className="text-xs opacity-85 mt-1 flex items-center gap-2 flex-wrap">
              {app.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {app.phone}</span>}
              {vehicle && <span className="inline-flex items-center gap-1 capitalize"><Truck size={11} /> {vehicle}</span>}
              {(app.city || user?.city) && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {app.city || user?.city}{app.state ? `, ${app.state}` : ""}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusPill ok={isApproved}>{isApproved ? "Approved" : (profile?.status || "Pending")}</StatusPill>
            <StatusPill ok={online}>{online ? "Available" : "Offline"}</StatusPill>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4" data-testid="dp-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="sc-card p-4">
            <div className="w-9 h-9 rounded-xl grid place-items-center text-white mb-2" style={{ background: k.color }}><k.icon size={16} /></div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--sc-ink-muted)]">{k.label}</div>
            <div className="text-xl font-extrabold tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Coverage */}
      <div className="sc-card p-4 mb-4" data-testid="dp-coverage">
        <div className="text-sm font-extrabold flex items-center gap-1.5 mb-2"><ShieldCheck size={15} /> Delivery coverage</div>
        <div className="text-xs text-[color:var(--sc-ink-muted)] mb-2">Service radius: <b className="text-[color:var(--sc-ink)]">{radius ? `${radius} km` : "—"}</b></div>
        <div className="flex flex-wrap gap-1.5">
          {pincodes.length ? pincodes.map((p) => (
            <span key={p} className="px-2 py-1 rounded-full bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] text-[11px] font-bold">{p}</span>
          )) : <span className="text-xs text-[color:var(--sc-ink-muted)]">No pincodes set.</span>}
        </div>
      </div>

      {/* Orders */}
      <div className="sc-card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-[color:var(--sc-border)] flex items-center justify-between">
          <div className="font-extrabold text-sm flex items-center gap-1.5"><Package size={15} /> My deliveries</div>
          <button onClick={() => loadOrders({ silent: true })} className="text-xs inline-flex items-center gap-1 text-[color:var(--sc-primary)] font-semibold" data-testid="dp-refresh">
            <RefreshCw size={12} className={syncing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        <div className="flex gap-1 p-2 overflow-x-auto border-b border-[color:var(--sc-border)]">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-testid={`dp-tab-${t.key}`}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${tab === t.key ? "bg-[color:var(--sc-primary)] text-white" : "bg-white text-[color:var(--sc-ink)] border border-[color:var(--sc-border)]"}`}
            >
              <t.icon size={13} /> {t.label}{counts[t.key] ? ` (${counts[t.key]})` : ""}
            </button>
          ))}
        </div>
        <div className="p-4">
          {orders.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No deliveries here yet"
              hint={mappedVendors === 0
                ? "You're not mapped to any vendor's delivery zone yet. Once a nearby shop assigns you, orders will appear here automatically."
                : `No ${TABS.find((t) => t.key === tab)?.label.toLowerCase()} orders right now.`}
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3" data-testid="dp-orders">
              {orders.map((o) => <OrderCard key={o.order_id || o.id} o={o} />)}
            </div>
          )}
        </div>
      </div>

      <div className="text-[11px] text-[color:var(--sc-ink-muted)] text-center mt-3 flex items-center justify-center gap-1">
        <UserIcon size={11} /> Delivery data syncs live with the Slangcart app.
      </div>
    </Layout>
  );
}
