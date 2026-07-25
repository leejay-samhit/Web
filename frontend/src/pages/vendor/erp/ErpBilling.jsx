import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import BackendPendingBanner from "@/components/erp/BackendPendingBanner";
import { Receipt, ArrowRight, CheckCircle2 } from "lucide-react";

const FLOW = [
  "Sales — total revenue this month",
  "Stock — decreased automatically after every bill",
  "Purchase Book — cost of goods matched to bill",
  "Inventory — real-time available vs reserved",
  "GST — CGST/SGST/IGST split per line",
  "Profit — margin locked at bill time",
  "Customer history — visit count & lifetime value",
  "Dashboard — today / month / lifetime figures",
];

export default function ErpBilling() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6" data-testid="erp-billing">
        <VendorNav />
        <ErpNav />
        <BackendPendingBanner endpoint="/api/erp/bills" note="Deltas will flow into every ERP dashboard once wired." />

        <div className="sc-card p-5 mb-4 bg-gradient-to-r from-sky-50 to-white ring-1 ring-sky-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 grid place-items-center"><Receipt size={18} /></div>
            <div>
              <div className="font-extrabold">Billing (Point of Sale)</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)]">Every bill auto-updates the entire ERP — sales, stock, GST, profit, customer history — no manual refresh needed.</div>
            </div>
            <Link to="/vendor/pos" className="ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 bg-[color:var(--sc-primary)] text-white text-sm font-semibold" data-testid="billing-open-pos">
              Open POS <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="sc-card p-5">
          <div className="text-sm font-extrabold mb-2">What auto-updates when you generate a bill</div>
          <ul className="space-y-1.5 text-sm">
            {FLOW.map((f) => (
              <li key={f} className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> {f}</li>
            ))}
          </ul>
        </div>
      </div>
    </Layout>
  );
}
