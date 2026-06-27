import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { CheckCircle2, Clock, Power, HelpCircle } from "lucide-react";
import { log } from "@/lib/log";

function Stat({ icon: Icon, label, value, testid, accent }) {
  return (
    <div data-testid={testid} className="sc-card p-5">
      <div className={`w-10 h-10 rounded-xl grid place-items-center ${accent || "bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary)]"}`}>
        <Icon size={18} />
      </div>
      <div className="mt-3 text-xs font-semibold text-[color:var(--sc-ink-muted)]">{label}</div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

export default function AdminServiceAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/service-analytics");
      setData(data);
    } catch (error) { log.error("AdminServiceAnalytics.load failed", error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Layout title="Admin · Service analytics"><Spinner /></Layout>;

  const avail = data?.availability || {};
  const categories = data?.categories || [];

  return (
    <Layout title="Admin · Service analytics">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat testid="sva-available" icon={CheckCircle2} label="Available providers" value={avail.available ?? 0} accent="bg-green-100 text-green-700" />
        <Stat testid="sva-busy" icon={Clock} label="Busy providers" value={avail.busy ?? 0} accent="bg-amber-100 text-amber-700" />
        <Stat testid="sva-offline" icon={Power} label="Offline providers" value={avail.offline ?? 0} accent="bg-slate-100 text-slate-700" />
        <Stat testid="sva-unset" icon={HelpCircle} label="Not set" value={avail.unset ?? 0} />
      </div>

      <div className="sc-card mt-5 p-5">
        <div className="font-extrabold mb-3">By category</div>
        {categories.length === 0 ? (
          <div className="text-sm text-[color:var(--sc-ink-muted)] text-center py-4">No categories.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="sva-by-cat">
            {categories.map((c) => (
              <div key={c.id || c.name} className="border border-[color:var(--sc-border)] rounded-xl p-3 flex items-center gap-3" data-testid={`sva-cat-${c.id || c.name}`}>
                <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ backgroundColor: (c.color || "#E5F2EC") + "33", color: c.color || "var(--sc-primary)" }}>
                  <span className="text-[10px] font-bold uppercase">{(c.name || "?").slice(0, 2)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-[color:var(--sc-ink-muted)]">{c.provider_count ?? 0} providers · {c.active ? "active" : "inactive"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
