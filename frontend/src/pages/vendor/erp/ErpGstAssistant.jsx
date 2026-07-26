import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import { gstAssistant } from "@/lib/erp";
import { Sparkles, ShieldAlert, Info, ArrowRight } from "lucide-react";

// Icon per line type
const TYPES = {
  collected: { icon: ArrowRight, bg: "bg-sky-50 border-sky-200 text-sky-800" },
  paid:      { icon: ArrowRight, bg: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  payable:   { icon: ShieldAlert, bg: "bg-amber-50 border-amber-200 text-amber-900" },
  itc:       { icon: Sparkles, bg: "bg-violet-50 border-violet-200 text-violet-800" },
  disclaimer:{ icon: Info,     bg: "bg-slate-50 border-slate-200 text-slate-700" },
};

export default function ErpGstAssistant() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6" data-testid="erp-gst-assistant">
        <VendorNav />
        <ErpNav />
        <OwnerLockGate title="Smart GST Assistant — Owner verification required">
          {(pwd) => <Inner ownerPassword={pwd} period={period} setPeriod={setPeriod} />}
        </OwnerLockGate>
      </div>
    </Layout>
  );
}

function Inner({ ownerPassword, period, setPeriod }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const d = await gstAssistant({ period }, ownerPassword);
        setLines(d?.lines || []);
      } catch {
        setPending(true);
        // fallback static demo lines
        setLines([
          { type: "collected", text: "You collected ₹0 GST from customers." },
          { type: "paid", text: "You paid ₹0 GST while purchasing products." },
          { type: "payable", text: "Estimated GST payable is ₹0." },
          { type: "itc", text: "You may be eligible to claim Input Tax Credit on eligible purchases." },
          { type: "disclaimer", text: "Please verify these figures before filing your GST return." },
        ]);
      }
      setLoading(false);
    })();
  }, [ownerPassword, period]);

  return (
    <>
      <div className="sc-card p-4 mb-4 flex items-center gap-3 flex-wrap">
        <div className="text-sm font-extrabold inline-flex items-center gap-1.5"><Sparkles size={14} /> Explain my GST for</div>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm"
          data-testid="gst-assistant-period"
        />
      </div>


      {loading ? (
        <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Preparing your GST summary…</div>
      ) : (
        <div className="space-y-2" data-testid="gst-assistant-lines">
          {lines.map((line, i) => {
            const spec = TYPES[line.type] || TYPES.disclaimer;
            const Icon = spec.icon;
            return (
              <div key={i} className={`rounded-xl border ${spec.bg} px-4 py-3 flex items-start gap-3`}>
                <Icon size={16} className="mt-0.5 shrink-0" />
                <div className="text-sm">{line.text}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
