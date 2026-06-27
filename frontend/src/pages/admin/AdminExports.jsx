import { useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import { Download, Loader2 } from "lucide-react";

const EXPORTS = [
  { kind: "users", label: "Users CSV", desc: "All users with referral & wallet info." },
  { kind: "transactions", label: "Transactions CSV", desc: "Wallet + payment transactions." },
  { kind: "withdrawals", label: "Withdrawals CSV", desc: "Payout / withdrawal requests." },
  { kind: "orders", label: "Orders CSV", desc: "Shop orders with line items." },
];

export default function AdminExports() {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const run = async (kind) => {
    setBusy(kind); setErr("");
    try {
      const res = await api.get(`/admin/export/${kind}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = `${kind}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setErr(e?.response?.data?.detail || `Export ${kind} failed`);
    } finally {
      setBusy("");
    }
  };

  return (
    <Layout title="Admin · Export data">
      <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4" data-testid="ex-grid">
        {EXPORTS.map((e) => (
          <div key={e.kind} className="sc-card p-5" data-testid={`ex-card-${e.kind}`}>
            <div className="font-extrabold">{e.label}</div>
            <div className="text-sm text-[color:var(--sc-ink-muted)] mt-1">{e.desc}</div>
            <button data-testid={`ex-${e.kind}`} disabled={busy === e.kind} onClick={() => run(e.kind)} className="sc-btn-primary mt-3 inline-flex items-center gap-1.5">
              {busy === e.kind ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />} Download
            </button>
          </div>
        ))}
      </div>
      {err && <div data-testid="ex-err" className="mt-3 text-sm font-semibold text-[color:var(--sc-error)]">{err}</div>}
    </Layout>
  );
}
