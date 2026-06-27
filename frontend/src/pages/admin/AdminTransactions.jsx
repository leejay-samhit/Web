import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatDateTime, formatINR } from "@/lib/utils";
import { Search, RotateCcw } from "lucide-react";
import { log } from "@/lib/log";

const TYPES = ["all", "credit", "debit", "refund", "withdrawal", "deposit", "commission"];

export default function AdminTransactions() {
  const [items, setItems] = useState([]);
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/transactions", { params: { limit: 100, q, type: type === "all" ? undefined : type } });
      setItems(data?.items || (Array.isArray(data) ? data : []));
    } catch (error) { log.error("AdminTransactions.load failed", error); }
    finally { setLoading(false); }
  }, [type, q]);
  useEffect(() => { load(); }, [load]);

  const reverse = async (t) => {
    if (!window.confirm("Reverse this transaction?")) return;
    try { await api.post(`/admin/transactions/${t.id}/reverse`); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <Layout title="Admin · Transactions">
      <div className="flex gap-2 mb-3 flex-wrap">
        {TYPES.map((t) => (
          <button key={t} data-testid={`tx-tab-${t}`} onClick={() => setType(t)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border capitalize ${type === t ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="sc-card p-3 flex items-center gap-2 mb-4">
        <Search size={16} className="text-[color:var(--sc-ink-muted)] ml-1" />
        <input data-testid="tx-q" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Search by user, txn id, ref…" className="flex-1 bg-transparent outline-none text-sm" />
        <button data-testid="tx-search" onClick={load} className="sc-btn-primary text-sm py-1.5">Search</button>
      </div>

      {loading ? <Spinner /> : (
        <div className="sc-card overflow-x-auto" data-testid="tx-list">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr><th className="text-left px-4 py-2.5">When</th><th className="text-left px-4 py-2.5">User</th><th className="text-left px-4 py-2.5">Type</th><th className="text-left px-4 py-2.5">Note</th><th className="text-right px-4 py-2.5">Amount</th><th className="text-right px-4 py-2.5">Actions</th></tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-[color:var(--sc-border)]" data-testid={`tx-${t.id}`}>
                  <td className="px-4 py-2 text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(t.created_at)}</td>
                  <td className="px-4 py-2 text-xs">{t.user_name || t.user_email || t.user_id}</td>
                  <td className="px-4 py-2"><span className="sc-chip capitalize">{t.type || t.kind}</span></td>
                  <td className="px-4 py-2 text-xs">{t.note || t.description || "—"}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatINR(t.amount ?? 0)}</td>
                  <td className="px-4 py-2 text-right">
                    <button data-testid={`tx-reverse-${t.id}`} onClick={() => reverse(t)} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center gap-1">
                      <RotateCcw size={12} /> Reverse
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No transactions.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
