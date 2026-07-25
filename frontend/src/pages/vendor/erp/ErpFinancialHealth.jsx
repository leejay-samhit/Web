import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import DashboardCard from "@/components/erp/DashboardCard";
import BackendPendingBanner from "@/components/erp/BackendPendingBanner";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import { financialHealth, paiseToRupees } from "@/lib/erp";
import { formatINR } from "@/lib/utils";
import { LineChart as LineChartIcon, TrendingUp, TrendingDown, Banknote, CreditCard, Smartphone, FileWarning } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export default function ErpFinancialHealth() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6" data-testid="erp-financial-health">
        <VendorNav />
        <ErpNav />
        <OwnerLockGate title="Financial Health — Owner verification required">
          {(pwd) => <Inner ownerPassword={pwd} />}
        </OwnerLockGate>
      </div>
    </Layout>
  );
}

function Inner({ ownerPassword }) {
  const [data, setData] = useState(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await financialHealth({ months: 6 }, ownerPassword);
        setData(d);
      } catch { setPending(true); }
      setLoading(false);
    })();
  }, [ownerPassword]);

  const d = data || {};
  const series = (d.monthlySeries || []).map((m) => ({
    month: m.month,
    Sales: paiseToRupees(m.sales_paise),
    Purchase: paiseToRupees(m.purchase_paise),
    Profit: paiseToRupees(m.profit_paise),
  }));

  return (
    <>
      {pending && <BackendPendingBanner endpoint="/api/erp/financial-health" note="Live data appears once billing goes live." />}

      {loading ? (
        <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            <DashboardCard icon={TrendingUp}   label="Sales growth"      value={`${(d.salesGrowthPct || 0).toFixed(1)}%`}    tone="profit"   testId="fh-sales-growth" />
            <DashboardCard icon={TrendingUp}   label="Purchase growth"   value={`${(d.purchaseGrowthPct || 0).toFixed(1)}%`} tone="purchase" testId="fh-purchase-growth" />
            <DashboardCard icon={TrendingUp}   label="Highest sales mo." value={d.highestSalesMonth || "—"}                   tone="sales"    testId="fh-high-month" />
            <DashboardCard icon={TrendingDown} label="Lowest sales mo."  value={d.lowestSalesMonth || "—"}                    tone="danger"   testId="fh-low-month" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <DashboardCard icon={Banknote}    label="Cash sales"   value={formatINR(paiseToRupees(d.cashSales_paise))} tone="sales" testId="fh-cash" />
            <DashboardCard icon={Smartphone}  label="UPI sales"    value={formatINR(paiseToRupees(d.upiSales_paise))}  tone="sales" testId="fh-upi" />
            <DashboardCard icon={CreditCard}  label="Card sales"   value={formatINR(paiseToRupees(d.cardSales_paise))} tone="sales" testId="fh-card" />
            <DashboardCard icon={FileWarning} label="Credit sales" value={formatINR(paiseToRupees(d.creditSales_paise))} tone="danger" testId="fh-credit" />
          </div>

          <div className="sc-card p-4 mb-4">
            <div className="text-sm font-extrabold inline-flex items-center gap-1.5 mb-2"><LineChartIcon size={14} /> Monthly trend</div>
            {series.length === 0 ? (
              <div className="text-xs text-[color:var(--sc-ink-muted)]">No monthly data yet.</div>
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v) => formatINR(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="Sales" stroke="#059669" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Purchase" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Profit" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <DashboardCard label="Outstanding payments" value={formatINR(paiseToRupees(d.outstandingPayments_paise))} tone="danger" testId="fh-outstanding" />
            <DashboardCard label="Inventory value" value={formatINR(paiseToRupees(d.inventoryValue_paise))} tone="stock" testId="fh-inv" />
          </div>
        </>
      )}
    </>
  );
}
