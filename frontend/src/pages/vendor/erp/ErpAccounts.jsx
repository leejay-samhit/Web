import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import DashboardCard from "@/components/erp/DashboardCard";
import BackendPendingBanner from "@/components/erp/BackendPendingBanner";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import { accountsDashboard, paiseToRupees } from "@/lib/erp";
import { formatINR } from "@/lib/utils";
import { IndianRupee, ShoppingCart, ShoppingBag, TrendingUp, Percent, Wallet, Coins, Calendar } from "lucide-react";

const EMPTY = { sales_paise: 0, purchase_paise: 0, orders: 0, profit_paise: 0, gst_paise: 0, expenses_paise: 0, netEarnings_paise: 0 };

export default function ErpAccounts() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6" data-testid="erp-accounts">
        <VendorNav />
        <ErpNav />
        <OwnerLockGate title="Accounts Dashboard — Owner verification required">
          {(pwd) => <Inner ownerPassword={pwd} />}
        </OwnerLockGate>
      </div>
    </Layout>
  );
}

function Inner({ ownerPassword }) {
  const [data, setData] = useState({ today: EMPTY, month: EMPTY, lifetime: EMPTY });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const d = await accountsDashboard(ownerPassword);
        if (mounted) setData({ today: { ...EMPTY, ...d.today }, month: { ...EMPTY, ...d.month }, lifetime: { ...EMPTY, ...d.lifetime } });
      } catch (e) {
        setPending(true);
      }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [ownerPassword]);

  if (loading) return <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading dashboard…</div>;

  return (
    <>
      {pending && <BackendPendingBanner endpoint="/api/erp/accounts/dashboard" note="Real numbers will appear once billing is wired." />}
      <Section icon={Calendar} title="Today's business" data={data.today} testPrefix="acc-today" />
      <Section icon={Calendar} title="Monthly business" data={data.month} testPrefix="acc-month" />
      <Section icon={Calendar} title="Lifetime business" data={data.lifetime} testPrefix="acc-lifetime" />
    </>
  );
}

function Section({ icon: Icon, title, data, testPrefix }) {
  return (
    <div className="mb-5">
      <div className="text-sm font-extrabold mb-2 inline-flex items-center gap-1.5"><Icon size={14} /> {title}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <DashboardCard icon={IndianRupee} label="Sales"        value={formatINR(paiseToRupees(data.sales_paise))}       tone="sales"    testId={`${testPrefix}-sales`} />
        <DashboardCard icon={ShoppingBag} label="Purchase"     value={formatINR(paiseToRupees(data.purchase_paise))}    tone="purchase" testId={`${testPrefix}-purchase`} />
        <DashboardCard icon={ShoppingCart} label="Orders"      value={data.orders}                                       tone="orders"   testId={`${testPrefix}-orders`} />
        <DashboardCard icon={TrendingUp}  label="Profit"       value={formatINR(paiseToRupees(data.profit_paise))}      tone="profit"   testId={`${testPrefix}-profit`} />
        <DashboardCard icon={Percent}     label="GST"          value={formatINR(paiseToRupees(data.gst_paise))}         tone="gst"      testId={`${testPrefix}-gst`} />
        <DashboardCard icon={Wallet}      label="Expenses"     value={formatINR(paiseToRupees(data.expenses_paise))}    tone="danger"   testId={`${testPrefix}-expenses`} />
        <DashboardCard icon={Coins}       label="Net earnings" value={formatINR(paiseToRupees(data.netEarnings_paise))} tone="profit"   testId={`${testPrefix}-net`} />
      </div>
    </div>
  );
}
