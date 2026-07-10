import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import { formatINR, formatDateTime } from "@/lib/utils";
import { getDashboardKpis, POS_PAYMENT_MODES } from "@/lib/vendorSales";
import { log } from "@/lib/log";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import {
  TrendingUp, Receipt, Package, IndianRupee, Banknote, CreditCard, Wallet,
  FileWarning, ArrowUpRight, Smartphone, Store, RefreshCw, Clock,
} from "lucide-react";

const PAY_ICONS = { cash: Banknote, upi: IndianRupee, debit: CreditCard, credit: CreditCard, netbank: Wallet, wallet: Wallet, credit_sale: FileWarning };

/* Small KPI card ----------------------------------------------------------- */
function Card({ icon: Icon, label, value, hint, color = "var(--sc-primary)", testId, tone = "default" }) {
  const bgTone = tone === "pending" ? "from-amber-50 to-white ring-amber-200"
    : tone === "upi" ? "from-sky-50 to-white ring-sky-200"
    : tone === "cod" ? "from-emerald-50 to-white ring-emerald-200"
    : "";
  return (
    <div
      className={
        "sc-card p-4 " +
        (bgTone ? `bg-gradient-to-br ${bgTone} ring-1` : "")
      }
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-white/70 grid place-items-center border border-[color:var(--sc-border)]" style={{ color }}>
          <Icon size={14} />
        </div>
        <div className="text-[11px] uppercase tracking-wider text-[color:var(--sc-ink-muted)] font-semibold flex-1">{label}</div>
      </div>
      <div className="text-2xl font-extrabold mt-2" style={{ color }}>{value}</div>
      {hint && <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-1">{hint}</div>}
    </div>
  );
}

/* Payment-method classification for online orders --------------------------- */
/**
 * The backend order object varies — try every known key and normalise.
 * Anything that looks like Razorpay / UPI / card → "upi" (online prepaid).
 * Anything that says COD / cash-on-delivery → "cod".
 * Fallback: use `payment_status` to differentiate.
 */
function classifyOnlineOrder(o) {
  const src = String(
    o?.payment_method || o?.payment_mode || o?.method || o?.mode ||
    o?.paymentType || o?.gateway || ""
  ).toLowerCase();
  if (src.includes("cod") || src.includes("cash")) return "cod";
  if (src.includes("upi") || src.includes("razor") || src.includes("card") || src.includes("net") || src.includes("wallet") || src === "online" || src === "prepaid") return "upi";
  // fallback heuristics from status
  const status = String(o?.payment_status || o?.status || "").toLowerCase();
  if (status.includes("cod") || status.includes("cash_on_delivery")) return "cod";
  if (status.includes("paid") || status.includes("captured") || status.includes("success")) return "upi";
  return "cod"; // safest default — treat unknown as COD-pending
}

const orderAmount = (o) =>
  Number(o?.amount ?? o?.total ?? o?.grand_total ?? o?.order_total ?? o?.totals?.grand_total ?? 0);

export default function VendorSales() {
  const { user } = useAuth();
  const uid = user?.id;
  const nav = useNavigate();

  /* --- POS (offline) KPIs, localStorage-backed ---------------------------- */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    const id = setInterval(onFocus, 30000);
    return () => { window.removeEventListener("focus", onFocus); clearInterval(id); };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const k = useMemo(() => getDashboardKpis(uid), [uid, tick]);

  /* --- Online shop sales (backend `/vendor/me/sales`) --------------------- */
  const [online, setOnline] = useState({ items: [], loading: true, error: "" });
  const loadOnline = useCallback(async () => {
    setOnline((s) => ({ ...s, loading: true, error: "" }));
    try {
      const { data } = await api.get("/vendor/me/sales");
      const items = Array.isArray(data) ? data : (data?.items || data?.sales || []);
      setOnline({ items, loading: false, error: "" });
    } catch (e) {
      log.error("VendorSales.loadOnline", e);
      setOnline({ items: [], loading: false, error: e?.response?.data?.detail || "Could not load online sales." });
    }
  }, []);
  useEffect(() => { loadOnline(); }, [loadOnline]);

  /* --- Backend-provided shop rollups from `/vendor/me/stats` --------------
   *  Server truth (once backend ships ORDER_MANAGEMENT_BACKEND_SPEC.md
   *  updates). Falls back to `null` while the fields aren't present. */
  const [stats, setStats] = useState({ today_shop_sales_amount: null, today_shop_orders: null, lifetime_shop_earnings: null });
  useEffect(() => {
    let alive = true;
    api.get("/vendor/me/stats")
      .then(({ data }) => {
        if (!alive || !data) return;
        setStats({
          today_shop_sales_amount: data.today_shop_sales_amount ?? null,
          today_shop_orders: data.today_shop_orders ?? null,
          lifetime_shop_earnings: data.lifetime_shop_earnings ?? null,
        });
      })
      .catch(() => { /* stats missing — degrade silently */ });
    return () => { alive = false; };
  }, []);

  const onlineSummary = useMemo(() => {
    const out = { upi: 0, cod: 0, upi_count: 0, cod_count: 0, total: 0, count: 0, items: [] };
    for (const o of online.items || []) {
      const cls = classifyOnlineOrder(o);
      const amt = orderAmount(o);
      out[cls] += amt;
      out[`${cls}_count`] += 1;
      out.total += amt;
      out.count += 1;
      out.items.push({ ...o, _cls: cls, _amt: amt });
    }
    return out;
  }, [online.items]);

  const donutData = [
    { name: "COD (collected on delivery)", value: onlineSummary.cod, color: "#0F6E4F" },
    { name: "UPI / online — Slangcart pending", value: onlineSummary.upi, color: "#F59E0B" },
  ].filter((d) => d.value > 0);

  return (
    <Layout title="Vendor · Sales dashboard">
      <VendorNav />

      {/* -------- POS (offline / walk-in) KPIs -------------------------- */}
      <div className="text-sm font-extrabold uppercase tracking-wider text-[color:var(--sc-ink-muted)] mb-2">POS · offline / walk-in</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3" data-testid="vs-kpis">
        <Card testId="kpi-today-sales"   icon={TrendingUp}   label="Today's sales"     value={formatINR(k.today.sales)}  hint={`${k.today.bills} bills`} />
        <Card testId="kpi-today-profit"  icon={ArrowUpRight} label="Today's profit"    value={formatINR(k.today.profit)} />
        <Card testId="kpi-today-bills"   icon={Receipt}      label="Today's bills"     value={k.today.bills} />
        <Card testId="kpi-today-items"   icon={Package}      label="Items sold today"  value={k.today.items_sold} />
        <Card testId="kpi-month-sales"   icon={TrendingUp}   label="This month sales"  value={formatINR(k.month.sales)}  hint={`${k.month.bills} bills`} />
        <Card testId="kpi-month-profit"  icon={ArrowUpRight} label="This month profit" value={formatINR(k.month.profit)} />
        <Card testId="kpi-month-gst"     icon={IndianRupee}  label="GST collected (month)" value={formatINR(k.month.gst)} />
        <Card testId="kpi-credit-sales"  icon={FileWarning}  label="Credit sales (pending)" value={formatINR(k.today.by_mode.credit_sale)} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6" data-testid="vs-payments">
        {POS_PAYMENT_MODES.filter((m) => m.key !== "credit_sale").map((m) => {
          const I = PAY_ICONS[m.key] || Banknote;
          return (
            <div key={m.key} className="sc-card p-3 flex items-center gap-2" data-testid={`pay-${m.key}`}>
              <div className="w-8 h-8 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)]"><I size={14} /></div>
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wider text-[color:var(--sc-ink-muted)] font-semibold">{m.label}</div>
                <div className="text-base font-extrabold">{formatINR(k.today.by_mode[m.key] || 0)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* -------- Online Shop Sales (backend orders) -------------------- */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-extrabold uppercase tracking-wider text-[color:var(--sc-ink-muted)] flex items-center gap-2">
          <Smartphone size={14} /> Online shop sales
        </div>
        <button onClick={loadOnline} className="text-xs font-semibold text-[color:var(--sc-primary)] inline-flex items-center gap-1 hover:underline" data-testid="vs-online-refresh">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3" data-testid="vs-online-kpis">
        <Card
          testId="online-today"
          tone="cod"
          icon={Banknote}
          label="Today's shop sales"
          value={formatINR(stats.today_shop_sales_amount ?? (onlineSummary.cod + onlineSummary.upi))}
          hint={
            stats.today_shop_orders != null
              ? `${stats.today_shop_orders} orders today`
              : `${onlineSummary.count} lifetime orders (backend total)`
          }
        />
        <Card testId="online-cod"    tone="cod"     icon={Banknote}   label="Cash on delivery"                   value={formatINR(onlineSummary.cod)} hint={`${onlineSummary.cod_count} orders — collected on delivery`} />
        <Card testId="online-upi"    tone="upi"     icon={IndianRupee} label="UPI / online paid"                  value={formatINR(onlineSummary.upi)} hint={`${onlineSummary.upi_count} orders — settled by Slangcart`} />
        <Card testId="online-pending" tone="pending" icon={Clock}      label="Credit sale pending · Slangcart a/c" value={formatINR(onlineSummary.upi)} hint={onlineSummary.upi > 0 ? "Awaiting payout to your account" : "No pending payout"} color="#B45309" />
        <Card
          testId="online-lifetime"
          tone="upi"
          icon={TrendingUp}
          label="Lifetime shop earnings"
          value={formatINR(stats.lifetime_shop_earnings ?? onlineSummary.total)}
          hint={
            stats.lifetime_shop_earnings != null
              ? "From /vendor/me/stats"
              : "Aggregated from /vendor/me/sales"
          }
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-3 mb-6">
        {/* Donut chart */}
        <div className="sc-card p-4 lg:col-span-2" data-testid="vs-online-donut">
          <div className="font-extrabold text-sm mb-2">Payment mix</div>
          {online.loading ? (
            <div className="h-56 grid place-items-center text-[color:var(--sc-ink-muted)] text-sm">Loading…</div>
          ) : donutData.length === 0 ? (
            <div className="h-56 grid place-items-center text-[color:var(--sc-ink-muted)] text-sm">
              <div className="text-center">
                <Store size={28} className="mx-auto opacity-40" />
                <div className="mt-2 text-xs">No online orders yet.</div>
              </div>
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {donutData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatINR(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-2 italic">
            UPI / online amounts are held in the Slangcart account until settlement.
          </div>
        </div>

        {/* Table */}
        <div className="sc-card lg:col-span-3 overflow-hidden" data-testid="vs-online-table">
          <div className="px-4 py-2 border-b border-[color:var(--sc-border)] flex items-center justify-between">
            <div className="font-extrabold text-sm">Recent online orders</div>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{onlineSummary.count} total · {formatINR(onlineSummary.total)}</div>
          </div>
          {online.loading ? (
            <div className="p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading orders…</div>
          ) : online.error ? (
            <div className="p-6 text-center text-sm text-[color:var(--sc-error)]" data-testid="vs-online-err">{online.error}</div>
          ) : onlineSummary.items.length === 0 ? (
            <div className="p-8 text-center text-sm text-[color:var(--sc-ink-muted)]">
              No online shop orders yet. Approved products show up here once a user checks out.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Order</th>
                    <th className="text-left px-3 py-2">Product</th>
                    <th className="text-right px-3 py-2">Amount</th>
                    <th className="text-left px-3 py-2">Payment</th>
                    <th className="text-left px-3 py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {onlineSummary.items.slice(0, 50).map((s) => (
                    <tr key={s.id || s._id || `${s.order_id}-${s.product_id}`} className="border-t border-[color:var(--sc-border)]">
                      <td className="px-3 py-2 font-mono">{(s.order_id || s.id || "").toString().slice(0, 8)}</td>
                      <td className="px-3 py-2">{s.product_name || s.name || "—"}</td>
                      <td className="px-3 py-2 text-right font-extrabold">{formatINR(s._amt)}</td>
                      <td className="px-3 py-2">
                        {s._cls === "cod" ? (
                          <span className="sc-chip" style={{ background: "#E7F6EC", color: "#0F6E4F" }}>COD</span>
                        ) : (
                          <span className="sc-chip" style={{ background: "#FEF3C7", color: "#92400E" }}>UPI · pending</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[color:var(--sc-ink-muted)]">{formatDateTime(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <button onClick={() => nav("/vendor/pos")} className="sc-btn-primary inline-flex items-center gap-1.5 mb-4">
        <Receipt size={14} /> Start new sale (POS)
      </button>

      <div className="sc-card p-0 overflow-hidden" data-testid="vs-recent">
        <div className="px-4 py-2 border-b border-[color:var(--sc-border)] font-extrabold text-sm">Recent POS bills</div>
        {k.recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[color:var(--sc-ink-muted)]">No bills yet. Click <b>Start new sale (POS)</b> above to create your first invoice.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr>
                <th className="text-left px-3 py-2">Invoice #</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-right px-3 py-2">Items</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {k.recent.map((i) => (
                <tr key={i.id} className="border-t border-[color:var(--sc-border)] hover:bg-[color:var(--sc-accent-light)]/20 cursor-pointer" onClick={() => nav("/vendor/invoices")} data-testid={`recent-${i.id}`}>
                  <td className="px-3 py-2 font-mono">{i.invoice_no}</td>
                  <td className="px-3 py-2 text-[color:var(--sc-ink-muted)]">{formatDateTime(i.created_at)}</td>
                  <td className="px-3 py-2">{i.customer?.name || "Walk-in"}</td>
                  <td className="px-3 py-2 text-right">{i.items?.length || 0}</td>
                  <td className="px-3 py-2 text-right font-extrabold">{formatINR(i.totals?.grand_total)}</td>
                  <td className="px-3 py-2"><span className="sc-chip capitalize" style={i.status === "completed" ? { background: "#E7F6EC", color: "#0F6E4F" } : i.status === "cancelled" ? { background: "#FDECEC", color: "#B42318" } : { background: "#FBEDE2", color: "#A0522D" }}>{i.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
