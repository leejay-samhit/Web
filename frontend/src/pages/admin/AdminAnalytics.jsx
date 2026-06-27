import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatINR } from "@/lib/utils";
import { TrendingUp, Users, ShoppingBag, Wallet, Wrench, LifeBuoy } from "lucide-react";
import { log } from "@/lib/log";

function Stat({ icon: Icon, label, value, testid }) {
  return (
    <div data-testid={testid} className="sc-card p-5">
      <div className="w-10 h-10 rounded-xl bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary)] grid place-items-center">
        <Icon size={18} />
      </div>
      <div className="mt-3 text-xs font-semibold text-[color:var(--sc-ink-muted)]">{label}</div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/analytics", { params: { days } });
      setData(data);
    } catch (error) {
      log.error("AdminAnalytics.load failed", error);
    } finally {
      setLoading(false);
    }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Layout title="Admin · Analytics"><Spinner /></Layout>;

  const k = data?.kpis || data?.summary || data || {};
  return (
    <Layout title="Admin · Analytics">
      <div className="flex gap-2 mb-4">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            data-testid={`aa-range-${d}`}
            onClick={() => setDays(d)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border ${days === d ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}
          >
            {d}d
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4" data-testid="aa-stats">
        <Stat testid="aa-new-today" icon={Users} label="New users today" value={k.new_users_today ?? 0} />
        <Stat testid="aa-new-month" icon={Users} label={`New users (month)`} value={k.new_users_month ?? 0} />
        <Stat testid="aa-paid-today" icon={Users} label="Paid users today" value={k.paid_users_today ?? 0} />
        <Stat testid="aa-revenue" icon={TrendingUp} label="Total revenue" value={formatINR(k.total_revenue ?? 0)} />
        <Stat testid="aa-system-wallet" icon={Wallet} label="System wallet" value={formatINR(k.system_wallet ?? 0)} />
        <Stat testid="aa-payouts" icon={Wallet} label="Total payouts" value={formatINR(k.total_payouts ?? 0)} />
        <Stat testid="aa-orders" icon={ShoppingBag} label="Orders" value={k.orders_count ?? 0} />
        <Stat testid="aa-orders-revenue" icon={TrendingUp} label="Orders revenue" value={formatINR(k.orders_revenue ?? 0)} />
        <Stat testid="aa-txns" icon={LifeBuoy} label="Success txns" value={k.success_txns ?? 0} />
        <Stat testid="aa-pending-txns" icon={LifeBuoy} label="Pending txns" value={k.pending_txns ?? 0} />
        <Stat testid="aa-failed-txns" icon={LifeBuoy} label="Failed txns" value={k.failed_txns ?? 0} />
        <Stat testid="aa-services" icon={Wrench} label="Refunded txns" value={k.refunded_txns ?? 0} />
      </div>
    </Layout>
  );
}
