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

  const s = data?.summary || data || {};
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
        <Stat testid="aa-users" icon={Users} label="Total users" value={s.total_users ?? s.users ?? 0} />
        <Stat testid="aa-new-users" icon={Users} label={`New users (${days}d)`} value={s.new_users ?? 0} />
        <Stat testid="aa-orders" icon={ShoppingBag} label={`Orders (${days}d)`} value={s.orders ?? s.order_count ?? 0} />
        <Stat testid="aa-revenue" icon={TrendingUp} label={`Revenue (${days}d)`} value={formatINR(s.revenue ?? s.gmv ?? 0)} />
        <Stat testid="aa-services" icon={Wrench} label="Active providers" value={s.active_providers ?? 0} />
        <Stat testid="aa-wallet" icon={Wallet} label="Wallet liability" value={formatINR(s.wallet_liability ?? s.total_wallet ?? 0)} />
        <Stat testid="aa-payouts" icon={Wallet} label={`Withdrawals (${days}d)`} value={formatINR(s.withdrawals ?? 0)} />
        <Stat testid="aa-tickets" icon={LifeBuoy} label="Open tickets" value={s.open_tickets ?? 0} />
        <Stat testid="aa-pending-kyc" icon={LifeBuoy} label="Pending KYC" value={s.pending_kyc ?? 0} />
      </div>
    </Layout>
  );
}
