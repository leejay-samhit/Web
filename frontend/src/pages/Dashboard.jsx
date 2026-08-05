import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import useDashboardData from "@/hooks/useDashboardData";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDateTime, initials } from "@/lib/utils";
import { log } from "@/lib/log";
import {
  Wallet as WalletIcon,
  ShoppingBag,
  Wrench,
  ArrowRight,
  Copy,
  Check,
  TrendingUp,
  Share2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Users as UsersIcon,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Welcome hero — referral code as the star                                  */
/* -------------------------------------------------------------------------- */
function ReferralHero({ user, wallet, earned, referralLink, copied, onCopy, onShare }) {
  const code = user.referral_code || "—";
  return (
    <div
      data-testid="dashboard-hero"
      className="rounded-3xl p-6 lg:p-8 bg-gradient-to-br from-[#0F6E4F] via-[#0F6E4F] to-[#083A2A] text-white relative overflow-hidden"
    >
      {/* Decorative glow blobs */}
      <div className="absolute -right-24 -bottom-24 w-72 h-72 rounded-full bg-white/5 blur-2xl" />
      <div className="absolute right-8 top-8 w-28 h-28 rounded-full bg-emerald-300/10 blur-xl" />
      <div className="absolute left-4 -top-6 w-24 h-24 rounded-full bg-emerald-100/10 blur-lg" />

      <div className="relative z-10 grid lg:grid-cols-[1fr_320px] gap-6 items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest bg-white/10 border border-white/15 px-2.5 py-1 rounded-full">
            <Sparkles size={11} /> Welcome back
          </div>
          <div className="text-3xl lg:text-4xl font-extrabold mt-2">
            {user.name || "User"} <span className="opacity-90">👋</span>
          </div>
          <div className="mt-3 text-white/85 text-sm max-w-md">
            Share your code and earn on every signup that shops or uses services on Slangcart.
          </div>

          {/* Referral code — the emphasis piece */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div
              data-testid="referral-code-box"
              className="inline-flex items-center gap-3 bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-4 py-2.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)]"
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/70">Your code</div>
              <div data-testid="referral-code" className="text-2xl font-extrabold tracking-wider">{code}</div>
              <button
                onClick={onCopy}
                data-testid="referral-copy"
                title="Copy code"
                className="w-9 h-9 rounded-xl bg-white text-[color:var(--sc-primary)] font-bold grid place-items-center hover:scale-105 transition"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button
                onClick={onShare}
                data-testid="referral-share"
                title="Share link"
                className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 text-white grid place-items-center hover:bg-white/25 transition"
              >
                <Share2 size={16} />
              </button>
            </div>
            {copied && (
              <span data-testid="referral-copied" className="text-xs font-semibold text-emerald-100 bg-emerald-900/40 border border-emerald-300/30 rounded-full px-2 py-0.5 animate-pulse">
                Copied!
              </span>
            )}
          </div>

          {referralLink && (
            <div className="mt-3 flex items-center gap-2 max-w-xl bg-white/8 backdrop-blur rounded-xl px-3 py-2 border border-white/10">
              <span data-testid="referral-link" className="flex-1 text-[11px] text-white/80 truncate font-mono">{referralLink}</span>
            </div>
          )}
        </div>

        {/* Right-side wallet + earnings snapshot */}
        <div className="rounded-2xl bg-white/8 backdrop-blur border border-white/15 p-5 space-y-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/70">Wallet balance</div>
            <div data-testid="hero-wallet" className="text-3xl font-extrabold mt-1">{formatINR(wallet)}</div>
          </div>
          <div className="border-t border-white/15 pt-3">
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/70">Lifetime earned</div>
            <div data-testid="hero-earned" className="text-xl font-extrabold text-emerald-200 mt-1">{formatINR(earned)}</div>
          </div>
          <Link
            to="/wallet"
            data-testid="hero-wallet-link"
            className="inline-flex items-center justify-center gap-1.5 text-sm font-bold w-full rounded-xl bg-white text-[color:var(--sc-primary)] py-2 hover:bg-white/90"
          >
            Open wallet <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Downline referral tree — stylish, expandable                               */
/*  Uses an ITERATIVE flatten (not recursive JSX) — CRA's visual-editor        */
/*  babel plugin cannot traverse recursively-nested components. See            */
/*  Network.jsx for the same pattern.                                          */
/* -------------------------------------------------------------------------- */
function flattenTree(node, depth, parentKey, out) {
  if (!node) return;
  const key = `${parentKey}/${node.id || node.referral_code || node.email || "n"}-${depth}`;
  const children = node.children || node.downlines || node.referrals || [];
  out.push({ key, node, depth, hasChildren: children.length > 0, childCount: children.length });
  for (let i = 0; i < children.length; i++) flattenTree(children[i], depth + 1, key, out);
}

function ReferralRow({ row, open, onToggle }) {
  const { node, depth, hasChildren, childCount } = row;
  const barHue = depth === 0 ? "#0F6E4F" : depth === 1 ? "#3AA57A" : depth === 2 ? "#7BC8A1" : "#B7E2C6";
  return (
    <div
      className="relative flex items-center gap-3 py-2 pr-3 rounded-xl hover:bg-[color:var(--sc-accent-light)]/40 transition"
      style={{ paddingLeft: 8 + depth * 22 }}
      data-testid={`ref-row-${depth}-${node?.referral_code || node?.id || "n"}`}
    >
      {depth > 0 && (
        <>
          <span aria-hidden className="absolute top-0 bottom-1/2 border-l-2" style={{ left: depth * 22 - 4, borderColor: barHue + "55" }} />
          <span aria-hidden className="absolute top-1/2 h-px" style={{ left: depth * 22 - 4, width: 12, background: barHue }} />
        </>
      )}
      <button
        type="button"
        onClick={() => hasChildren && onToggle(row.key)}
        className={`w-6 h-6 rounded-md grid place-items-center transition ${hasChildren ? "hover:bg-[color:var(--sc-primary)]/10 text-[color:var(--sc-primary)]" : "opacity-30"}`}
        data-testid={`ref-toggle-${depth}`}
        aria-label={open ? "Collapse" : "Expand"}
      >
        {hasChildren ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      </button>
      <div
        className="w-9 h-9 rounded-full text-white text-xs font-extrabold grid place-items-center overflow-hidden ring-2 ring-white shadow"
        style={{ background: `linear-gradient(135deg, ${barHue}, #0F6E4F)` }}
      >
        {node?.profile_image ? (
          <img alt="" src={node.profile_image} className="w-full h-full object-cover" />
        ) : (
          initials(node?.name)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold truncate text-[color:var(--sc-ink)]">{node?.name || "User"}</div>
        <div className="text-[11px] text-[color:var(--sc-ink-muted)] font-mono">{node?.referral_code || node?.email || "—"}</div>
      </div>
      {hasChildren && (
        <span className="hidden sm:inline text-[11px] font-bold text-[color:var(--sc-primary)] bg-[color:var(--sc-accent-light)] rounded-full px-2 py-0.5">
          {childCount} ref{childCount > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

function ReferralTree({ root, counts }) {
  const totalNetwork = counts?.total ?? counts?.network ?? null;
  const directs = root?.direct_referrals_count ?? counts?.direct ?? (root?.children || root?.downlines || root?.referrals || []).length;

  const allRows = useMemo(() => {
    if (!root) return [];
    const out = [];
    flattenTree(root, 0, "root", out);
    return out;
  }, [root]);

  const [expanded, setExpanded] = useState({});
  // Auto-expand root on first render
  useEffect(() => {
    if (allRows.length > 0) {
      const first = allRows[0]?.key;
      setExpanded((e) => (first && !(first in e) ? { ...e, [first]: true } : e));
    }
  }, [allRows]);

  const toggle = useCallback((key) => setExpanded((e) => ({ ...e, [key]: !e[key] })), []);

  // A row is visible only if every ancestor key in its path is expanded.
  const visibleRows = useMemo(() => {
    const out = [];
    for (const r of allRows) {
      if (r.depth === 0) { out.push(r); continue; }
      const parts = r.key.split("/");
      parts.pop();
      let ok = true;
      let cur = "";
      for (let i = 0; i < parts.length; i++) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i];
        if (i === 0) continue; // "root" prefix
        if (!expanded[cur]) { ok = false; break; }
      }
      if (ok) out.push(r);
    }
    return out;
  }, [allRows, expanded]);

  return (
    <div className="sc-card p-5" data-testid="dashboard-referral-tree">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)]">
            <UsersIcon size={17} />
          </div>
          <div>
            <div className="font-extrabold text-[color:var(--sc-ink)]">Your referral tree</div>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)]">
              {directs} direct{directs === 1 ? "" : "s"}
              {totalNetwork != null && <> · {totalNetwork} total in your network</>}
            </div>
          </div>
        </div>
        <Link
          to="/network"
          data-testid="dashboard-tree-see-all"
          className="text-xs font-bold text-[color:var(--sc-primary)] inline-flex items-center gap-1 hover:underline"
        >
          Expand view <ArrowRight size={12} />
        </Link>
      </div>
      {!root ? (
        <div className="text-sm text-[color:var(--sc-ink-muted)] py-6 text-center">
          Your downline will appear here as friends sign up with your code.
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto pr-1">
          {visibleRows.map((r) => (
            <ReferralRow key={r.key} row={r} open={!!expanded[r.key]} onToggle={toggle} />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Quick actions — network tile removed                                       */
/* -------------------------------------------------------------------------- */
const QUICK_ACTIONS = [
  { to: "/shop", label: "Shop now", icon: ShoppingBag, testid: "qa-shop" },
  { to: "/services", label: "Find services", icon: Wrench, testid: "qa-services" },
  { to: "/wallet", label: "Withdraw", icon: WalletIcon, testid: "qa-withdraw" },
];

function QuickActions() {
  return (
    <div className="grid grid-cols-3 gap-3">
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

/* -------------------------------------------------------------------------- */
/*  Recent orders                                                              */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */
export default function Dashboard() {
  const { user } = useAuth();
  const { dash, orders, banners, loading } = useDashboardData();
  const [copied, setCopied] = useState(false);
  const [network, setNetwork] = useState(null);
  const [netLoading, setNetLoading] = useState(true);

  const u = dash?.user || user || {};
  const wallet = Number(u.wallet_balance || 0);
  const earned = Number(u.total_earned || 0);
  const referralLink = u.referral_code ? `${window.location.origin}/register?ref=${u.referral_code}` : "";

  const copyRef = useCallback(async () => {
    if (!u.referral_code) return;
    try {
      await navigator.clipboard.writeText(u.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      log.error("Dashboard.copyRef failed", error);
    }
  }, [u.referral_code]);

  const shareRef = useCallback(async () => {
    if (!referralLink) return;
    const share = { title: "Join me on Slangcart", text: `Use my code ${u.referral_code} on Slangcart!`, url: referralLink };
    try {
      if (navigator.share) {
        await navigator.share(share);
      } else {
        await navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch (error) {
      log.error("Dashboard.shareRef failed", error);
    }
  }, [referralLink, u.referral_code]);

  useEffect(() => {
    let alive = true;
    api.get("/users/me/network")
      .then(({ data }) => { if (alive) setNetwork(data); })
      .catch((e) => log.error("Dashboard.network failed", e))
      .finally(() => { if (alive) setNetLoading(false); });
    return () => { alive = false; };
  }, []);

  const treeRoot = useMemo(() => network?.root || network || null, [network]);
  const counts = network?.counts || {};

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
        <ReferralHero
          user={u}
          wallet={wallet}
          earned={earned}
          referralLink={referralLink}
          copied={copied}
          onCopy={copyRef}
          onShare={shareRef}
        />

        {/* Compact stat strip — kept small & focused (no Users/Network cards) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="sc-card p-5" data-testid="stat-wallet">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] grid place-items-center">
                <WalletIcon size={18} />
              </div>
            </div>
            <div className="mt-4 text-sm font-semibold text-[color:var(--sc-ink-muted)]">Wallet balance</div>
            <div className="text-2xl font-extrabold text-[color:var(--sc-ink)]">{formatINR(wallet)}</div>
          </div>
          <div className="sc-card p-5" data-testid="stat-earned">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 grid place-items-center">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="mt-4 text-sm font-semibold text-[color:var(--sc-ink-muted)]">Total earned</div>
            <div className="text-2xl font-extrabold text-[color:var(--sc-ink)]">{formatINR(earned)}</div>
          </div>
        </div>

        <QuickActions />

        {/* Downline referral tree — visual, stylish, expandable */}
        {netLoading ? (
          <div className="sc-card p-5"><Spinner /></div>
        ) : (
          <ReferralTree root={treeRoot} counts={counts} />
        )}

        <PromoBanners banners={banners} />
        <RecentOrders orders={orders} />
      </div>
    </Layout>
  );
}
