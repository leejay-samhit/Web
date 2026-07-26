import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import DashboardCard from "@/components/erp/DashboardCard";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import { incomeTaxDashboard, paiseToRupees } from "@/lib/erp";
import { formatINR } from "@/lib/utils";
import { Info, IndianRupee } from "lucide-react";

function fyOptions() {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return [`${y - 1}-${String(y).slice(2)}`, `${y}-${String(y + 1).slice(2)}`];
}

export default function ErpIncomeTax() {
  const [fy, setFy] = useState(fyOptions()[1]);
  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6" data-testid="erp-income-tax">
        <VendorNav />
        <ErpNav />
        <OwnerLockGate title="Income Tax Dashboard — Owner verification required">
          {(pwd) => <Inner ownerPassword={pwd} fy={fy} setFy={setFy} />}
        </OwnerLockGate>
      </div>
    </Layout>
  );
}

function Inner({ ownerPassword, fy, setFy }) {
  const [data, setData] = useState(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const d = await incomeTaxDashboard({ financialYear: fy }, ownerPassword);
        setData(d);
      } catch { setPending(true); }
      setLoading(false);
    })();
  }, [ownerPassword, fy]);

  const d = data || {};
  return (
    <>
      <div className="sc-card p-4 mb-4 flex items-center gap-3 flex-wrap">
        <div className="text-sm font-extrabold inline-flex items-center gap-1.5"><IndianRupee size={14} /> Financial year</div>
        <select value={fy} onChange={(e) => setFy(e.target.value)} className="rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm" data-testid="it-fy-picker">
          {fyOptions().map((y) => <option key={y} value={y}>FY {y}</option>)}
        </select>
      </div>


      <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 mb-4 flex items-start gap-3 text-sm">
        <Info size={16} className="mt-[2px]" />
        <div className="text-xs">These are estimates for business accounting only. Please verify with your CA before filing taxes.</div>
      </div>

      {loading ? (
        <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <DashboardCard label="Annual sales"      value={formatINR(paiseToRupees(d.annualSales_paise))}      tone="sales"    testId="it-sales" />
          <DashboardCard label="Annual purchases"  value={formatINR(paiseToRupees(d.annualPurchases_paise))}  tone="purchase" testId="it-purchase" />
          <DashboardCard label="Gross profit"      value={formatINR(paiseToRupees(d.grossProfit_paise))}     tone="profit"   testId="it-gross" />
          <DashboardCard label="Business expenses" value={formatINR(paiseToRupees(d.businessExpenses_paise))} tone="danger"   testId="it-expenses" />
          <DashboardCard label="Net income"        value={formatINR(paiseToRupees(d.netBusinessIncome_paise))} tone="profit" testId="it-net" />
          <DashboardCard label="Est. taxable income" value={formatINR(paiseToRupees(d.estimatedTaxableIncome_paise))} tone="gst" testId="it-taxable" />
        </div>
      )}
    </>
  );
}
