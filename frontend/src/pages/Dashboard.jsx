import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import useDashboardData from "@/hooks/useDashboardData";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDateTime } from "@/lib/utils";
import { log } from "@/lib/log";
import {
  Wallet,
  Users,
  ShoppingBag,
  Wrench,
  ArrowRight,
  Copy,
  Check,
  TrendingUp,
  Award,
} from "lucide-react";

function StatCard({ icon: Icon, label, value, tint = "primary", testid }) {
  const tints = {
    primary: "bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]",
    amber: "bg-amber-50 text-amber-800",
    blue: "bg-blue-50 text-blue-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div data-testid={testid} className="sc-card p-5">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl ${tints[tint]} grid place-items-center`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-4 text-sm font-semibold text-[color:var(--sc-ink-muted)]">{label}</div>
      <div className="text-2xl font-extrabold text-[color:var(--sc-ink)]">{value}</div>
    </div>
  );
}

function ReferralHero({ user, wallet, referralLink, copied, onCopy }) {
  return (
    <div
      data-testid="dashboard-hero"
      className="rounded-3xl p-6 lg:p-8 bg-gradient-to-br from-[color:var(--sc-primary)] to-[color:var(--sc-primary-700)] text-white relative overflow-hidden"
    >
      <div className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full bg-white/5" />
      <div className="absolute right-8 top-6 w-24 h-24 rounded-full bg-white/5" />
      <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-sm font-semibold text-white/75">Welcome back,</div>
          <div className="text-3xl font-extrabold mt-1">{user.name || "User"} 👋</div>
          <div className="mt-4 text-white/85 text-sm max-w-md">
            Your referral code is{" "}
            <span data-testid="referral-code" className="font-extrabold text-white">
              {user.referral_code || "—"}
            </span>
            . Share it and earn on every signup.
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur border border-white/15 rounded-2xl p-4 min-w-[260px]">
          <div className="text-xs font-semibold text-white/75">Wallet balance</div>
          <div data-testid="hero-wallet" className="text-3xl font-extrabold">
            {formatINR(wallet)}
          </div>
          <Link
            to="/wallet"
            data-testid="hero-wallet-link"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-white hover:underline"
          >
            Open wallet <ArrowRight size={14} />
          </Link>
        </div>
      </div>
      {referralLink && (
        <div className="relative z-10 mt-6 flex items-center gap-2 max-w-xl bg-white/10 backdrop-blur rounded-xl px-3 py-2.5 border border-white/15">
          <span data-testid="referral-link" className="flex-1 text-xs text-white/90 truncate">{referralLink}</span>
          <button
            onClick={onCopy}
            data-testid="referral-copy"
            className="text-xs font-semibold inline-flex items-center gap-1.5 bg-white text-[color:var(--sc-primary)] rounded-lg px-2.5 py-1.5"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}

const QUICK_ACTIONS = [
  { to: "/shop", label: "Shop now", icon: ShoppingBag, testid: "qa-shop" },
  { to: "/services", label: "Find services", icon: Wrench, testid: "qa-services" },
  { to: "/network", label: "My network", icon: Users, testid: "qa-network" },
  { to: "/wallet", label: "Withdraw", icon: Wallet, testid: "qa-withdraw" },
];

function QuickActions() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {QUICK_ACTIONS.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          data-testid={a.testid}
          className="sc-card p-4 flex items-center gap-3 hover:border-[color:var(--sc-primary)]/40 hover:shadow-sm transition"
        >
          <div className="w-10 h-10 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center">
            <a.icon size={18} className="text-[color:var(--sc-primary)]" />
          </div>
          <div>
            <div className="font-extrabold text-sm text-[color:var(--sc-ink)]">{a.label}</div>
            <div className="text-xs text-[color:var(--sc-ink-muted)]">Tap to open</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function RecentOrders({ orders }) {
  return (
    <div className="sc-card p-5">
      <div className="flex items-center justify-between">
        <div className="font-extrabold text-[color:var(--sc-ink)]">Recent orders</div>
        <Link to="/orders" data-testid="see-all-orders" className="text-sm font-semibold text-[color:var(--sc-primary)]">
          See all
        </Link>
      </div>
      <div className="mt-3 divide-y divide-[color:var(--sc-border)]">
        {orders.length === 0 ? (
          <div className="text-sm text-[color:var(--sc-ink-muted)] py-6 text-center">No orders yet.</div>
        ) : (
          orders.slice(0, 5).map((o) => (
            <div key={o.id || o._id} className="py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{o.id?.slice(0, 8) || "Order"}</div>
                <div className="text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(o.created_at)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold">{formatINR(o.total || o.amount)}</div>
                <div className="text-xs text-[color:var(--sc-ink-muted)]">{o.status || "—"}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PromoBanners({ banners }) {
  if (!banners || banners.length === 0) return null;
  return (
    <div data-testid="promo-banners">
      <div className="text-sm font-extrabold text-[color:var(--sc-ink)] mb-2">For you</div>
      <div className="grid lg:grid-cols-2 gap-3">
        {banners.slice(0, 4).map((b) => (
          <div key={b.id} className="sc-card overflow-hidden">
            {b.image_data_url && <img alt="" src={b.image_data_url} className="w-full h-32 object-cover" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { dash, orders, banners, loading } = useDashboardData();
  const [copied, setCopied] = useState(false);

  const u = dash?.user || user || {};
  const wallet = Number(u.wallet_balance || 0);
  const earned = Number(u.total_earned || 0);
  const directs = Number(u.direct_referrals_count || 0);
  const payouts = Number(u.payouts_received || 0);
  const referralLink = u.referral_code ? `${window.location.origin}/register?ref=${u.referral_code}` : "";

  const copyRef = useCallback(async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      log.error("Dashboard.copyRef failed", error);
    }
  }, [referralLink]);

  if (loading) {
    return (
      <Layout title="Dashboard">
        <Spinner />
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard">
      <div className="space-y-6 sc-fade-in">
        <ReferralHero user={u} wallet={wallet} referralLink={referralLink} copied={copied} onCopy={copyRef} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard testid="stat-wallet" icon={Wallet} label="Wallet balance" value={formatINR(wallet)} />
          <StatCard testid="stat-earned" icon={TrendingUp} label="Total earned" value={formatINR(earned)} tint="amber" />
          <StatCard testid="stat-directs" icon={Users} label="Direct referrals" value={directs} tint="blue" />
          <StatCard testid="stat-payouts" icon={Award} label="Payouts received" value={payouts} tint="rose" />
        </div>
        <QuickActions />
        <PromoBanners banners={banners} />
        <RecentOrders orders={orders} />
      </div>
    </Layout>
  );
}
