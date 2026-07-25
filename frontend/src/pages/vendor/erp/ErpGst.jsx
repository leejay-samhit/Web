import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import DashboardCard from "@/components/erp/DashboardCard";
import BackendPendingBanner from "@/components/erp/BackendPendingBanner";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import { gstDashboard, paiseToRupees } from "@/lib/erp";
import { formatINR, formatDate } from "@/lib/utils";
import { Percent, AlertTriangle, Info, Calendar } from "lucide-react";

export default function ErpGst() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6" data-testid="erp-gst">
        <VendorNav />
        <ErpNav />
        <OwnerLockGate title="GST Dashboard — Owner verification required">
          {(pwd) => <Inner ownerPassword={pwd} period={period} setPeriod={setPeriod} />}
        </OwnerLockGate>
      </div>
    </Layout>
  );
}

function Inner({ ownerPassword, period, setPeriod }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const d = await gstDashboard({ period }, ownerPassword);
        setData(d);
      } catch { setPending(true); }
      setLoading(false);
    })();
  }, [ownerPassword, period]);

  const d = data || {};

  return (
    <>
      <div className="sc-card p-4 mb-4 flex items-center gap-3 flex-wrap">
        <div className="text-sm font-extrabold inline-flex items-center gap-1.5"><Percent size={14} /> GST period</div>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm"
          data-testid="gst-period-picker"
        />
      </div>

      {pending && <BackendPendingBanner endpoint="/api/erp/gst/dashboard" note="Preview values. Real GST once billing goes live." />}

      <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 mb-4 flex items-start gap-3 text-sm">
        <AlertTriangle size={16} className="mt-[2px]" />
        <div>
          <div className="font-semibold">Estimates only</div>
          <div className="text-xs">All figures here are computed from your bills. Please verify with your CA before filing your GST return.</div>
        </div>
      </div>

      {loading ? (
        <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            <DashboardCard label="Taxable sales" value={formatINR(paiseToRupees(d.taxableSales_paise))} tone="sales" testId="gst-taxable" />
            <DashboardCard label="Exempt sales"  value={formatINR(paiseToRupees(d.exemptSales_paise))} tone="default" testId="gst-exempt" />
            <DashboardCard label="Input GST"     value={formatINR(paiseToRupees(d.inputGst_paise))} tone="gst" testId="gst-input" />
            <DashboardCard label="Output GST"    value={formatINR(paiseToRupees(d.outputGst_paise))} tone="gst" testId="gst-output" />
            <DashboardCard label="GST payable (est.)" value={formatINR(paiseToRupees(d.gstPayableEstimate_paise))} tone="danger" testId="gst-payable" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <DashboardCard label="CGST" value={formatINR(paiseToRupees(d.cgst_paise))} tone="gst" testId="gst-cgst" />
            <DashboardCard label="SGST" value={formatINR(paiseToRupees(d.sgst_paise))} tone="gst" testId="gst-sgst" />
            <DashboardCard label="IGST" value={formatINR(paiseToRupees(d.igst_paise))} tone="gst" testId="gst-igst" />
            <DashboardCard label="Refund (est.)" value={formatINR(paiseToRupees(d.gstRefundEstimate_paise))} tone="profit" testId="gst-refund" />
          </div>

          <div className="sc-card p-4 flex items-center gap-3">
            <Calendar size={16} className="text-[color:var(--sc-primary)]" />
            <div className="text-sm">
              <div className="font-semibold">Filing status: <span className="uppercase">{d.filingStatus || "PENDING"}</span></div>
              <div className="text-xs text-[color:var(--sc-ink-muted)]">Next return due: {d.nextReturnDueDate ? formatDate(d.nextReturnDueDate) : "—"}</div>
            </div>
          </div>

          <div className="mt-4 text-xs text-[color:var(--sc-ink-muted)] inline-flex items-center gap-1"><Info size={12} /> HSN → GST rate mapping is Super Admin editable in /admin/erp-settings.</div>
        </>
      )}
    </>
  );
}
