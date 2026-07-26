import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import { complianceStatus, paiseToRupees } from "@/lib/erp";
import { formatINR } from "@/lib/utils";
import { ShieldAlert, Info, AlertTriangle, CheckCircle2 } from "lucide-react";

const LEVEL_STYLES = {
  INFO:    { icon: Info,           bg: "bg-sky-50 border-sky-200 text-sky-800" },
  WARNING: { icon: AlertTriangle,  bg: "bg-amber-50 border-amber-200 text-amber-900" },
  ACTION:  { icon: ShieldAlert,    bg: "bg-red-50 border-red-200 text-red-800" },
  OK:      { icon: CheckCircle2,   bg: "bg-emerald-50 border-emerald-200 text-emerald-800" },
};

export default function ErpCompliance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await complianceStatus();
        setData(d);
      } catch { setPending(true); }
      setLoading(false);
    })();
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6" data-testid="erp-compliance">
        <VendorNav />
        <ErpNav />

        {loading ? (
          <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading…</div>
        ) : (
          <>
            <div className="sc-card p-5 mb-4">
              <div className="text-xs uppercase font-semibold text-[color:var(--sc-ink-muted)]">Annual turnover</div>
              <div className="text-3xl font-extrabold text-[color:var(--sc-primary)] mt-1" data-testid="compliance-turnover">
                {formatINR(paiseToRupees(data?.annualTurnover_paise))}
              </div>
              <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-1">
                Thresholds are configured by Super Admin and reflect current Indian tax rules.
              </div>
            </div>

            <div className="space-y-2" data-testid="compliance-flags">
              {(data?.flags || []).length === 0 ? (
                <div className="text-sm text-[color:var(--sc-ink-muted)]">No compliance alerts.</div>
              ) : (
                (data?.flags || []).map((f, i) => {
                  const spec = LEVEL_STYLES[f.level] || LEVEL_STYLES.INFO;
                  const Icon = spec.icon;
                  return (
                    <div key={i} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${spec.bg}`}>
                      <Icon size={16} className="mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <div className="font-semibold">{f.code}</div>
                        <div className="text-xs">{f.text}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 text-[11px] text-[color:var(--sc-ink-muted)]">
              These flags are guidance only. Confirm eligibility and rules with your CA.
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
