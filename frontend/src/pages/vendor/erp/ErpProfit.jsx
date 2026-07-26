import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import DashboardCard from "@/components/erp/DashboardCard";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import { profitDashboard, paiseToRupees } from "@/lib/erp";
import { formatINR } from "@/lib/utils";
import { TrendingUp, TrendingDown, Trophy, Award, Star } from "lucide-react";

export default function ErpProfit() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6" data-testid="erp-profit">
        <VendorNav />
        <ErpNav />
        <OwnerLockGate title="Profit Dashboard — Owner verification required">
          {(pwd) => <Inner ownerPassword={pwd} />}
        </OwnerLockGate>
      </div>
    </Layout>
  );
}

function Inner({ ownerPassword }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await profitDashboard({}, ownerPassword);
        setData(d);
      } catch { setPending(true); }
      setLoading(false);
    })();
  }, [ownerPassword]);

  if (loading) return <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading…</div>;
  const d = data || {};

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <DashboardCard label="Total Purchase" value={formatINR(paiseToRupees(d.totalPurchaseValue_paise))} tone="purchase" testId="pd-purchase" />
        <DashboardCard label="Total Sales"    value={formatINR(paiseToRupees(d.totalSalesValue_paise))}    tone="sales"    testId="pd-sales" />
        <DashboardCard label="Gross Profit"   value={formatINR(paiseToRupees(d.grossProfit_paise))}       tone="profit"   testId="pd-gross" />
        <DashboardCard label="Net Profit"     value={formatINR(paiseToRupees(d.netProfit_paise))}         tone="profit"   testId="pd-net" />
        <DashboardCard label="Profit %"       value={`${(d.profitPct || 0).toFixed(1)}%`}                 tone="profit"   testId="pd-pct" />
        <DashboardCard label="Avg Margin"     value={`${(d.avgMarginPct || 0).toFixed(1)}%`}              tone="profit"   testId="pd-margin" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <ProductHighlight icon={Trophy}      label="Best selling"   product={d.bestSelling}   tone="text-emerald-700" />
        <ProductHighlight icon={TrendingDown} label="Lowest selling" product={d.lowestSelling} tone="text-red-700" />
        <ProductHighlight icon={Award}       label="Highest profit" product={d.highestProfit} tone="text-emerald-700" />
        <ProductHighlight icon={Star}        label="Lowest profit"  product={d.lowestProfit}  tone="text-amber-700" />
      </div>
    </>
  );
}

function ProductHighlight({ icon: Icon, label, product, tone }) {
  return (
    <div className="sc-card p-4">
      <div className={`text-xs font-extrabold inline-flex items-center gap-1.5 uppercase tracking-wider ${tone}`}><Icon size={14} /> {label}</div>
      <div className="mt-2 font-semibold text-sm">{product?.name || "—"}</div>
      <div className="text-[11px] text-[color:var(--sc-ink-muted)]">
        {product?.qtySold != null ? `${product.qtySold} units` : ""} {product?.revenue_paise != null ? ` · ${formatINR(paiseToRupees(product.revenue_paise))}` : ""} {product?.profit_paise != null ? ` · profit ${formatINR(paiseToRupees(product.profit_paise))}` : ""}
      </div>
    </div>
  );
}
