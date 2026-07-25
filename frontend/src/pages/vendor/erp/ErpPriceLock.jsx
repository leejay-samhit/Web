import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import { Link } from "react-router-dom";
import { Lock, Shield, EyeOff, ArrowRight, CheckCircle2 } from "lucide-react";

const LOCKED_ACTIONS = [
  "Edit purchase cost",
  "Edit selling price",
  "Delete products",
  "Adjust stock",
  "Edit GST %",
  "Edit purchase invoice details",
];

const HIDDEN_FIELDS = [
  "Purchase cost columns (Cashier & Staff cannot see)",
  "Purchase Book view (Owner-only)",
  "Supplier prices",
  "Profit dashboard",
];

export default function ErpPriceLock() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6" data-testid="erp-price-lock">
        <VendorNav />
        <ErpNav />

        <div className="sc-card p-5 mb-4 bg-gradient-to-r from-amber-50 to-white ring-1 ring-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 grid place-items-center"><Lock size={18} /></div>
            <div>
              <div className="font-extrabold">Price Lock is ON</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)]">Purchase cost stays hidden. Selling price editing needs owner verification.</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="sc-card p-5">
            <div className="font-extrabold text-sm mb-2 inline-flex items-center gap-1.5"><Shield size={14} /> Only owner can</div>
            <ul className="space-y-1.5 text-sm">
              {LOCKED_ACTIONS.map((a) => <li key={a} className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> {a}</li>)}
            </ul>
            <Link to="/vendor/erp/security" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--sc-primary)]">
              Manage owner settings <ArrowRight size={12} />
            </Link>
          </div>

          <div className="sc-card p-5">
            <div className="font-extrabold text-sm mb-2 inline-flex items-center gap-1.5"><EyeOff size={14} /> Hidden from staff</div>
            <ul className="space-y-1.5 text-sm">
              {HIDDEN_FIELDS.map((a) => <li key={a} className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> {a}</li>)}
            </ul>
            <Link to="/vendor/erp/roles" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--sc-primary)]">
              Configure roles <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        <div className="sc-card p-5 mt-4">
          <div className="font-extrabold text-sm mb-2">Every change is audited</div>
          <div className="text-xs text-[color:var(--sc-ink-muted)]">
            Old value, new value, user, date, time and reason are stored automatically. Review them in the Audit Log.
          </div>
          <Link to="/vendor/erp/audit" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--sc-primary)]">
            Open audit log <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </Layout>
  );
}
