import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatDateTime, formatINR } from "@/lib/utils";
import { Check, X, Loader2 } from "lucide-react";
import { log } from "@/lib/log";

export default function AdminUPIPayments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/payments/pending");
      setItems(data?.items || (Array.isArray(data) ? data : []));
    } catch (error) { log.error("AdminUPIPayments.load failed", error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (p, action) => {
    setActing(p.id);
    try {
      await api.post(`/admin/payments/${p.id}/${action}`);
      load();
    } catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setActing(null); }
  };

  return (
    <Layout title="Admin · UPI payments (pending)">
      {loading ? <Spinner /> : (
        <div className="grid md:grid-cols-2 gap-3" data-testid="up-list">
          {items.map((p) => (
            <div key={p.id} className="sc-card p-4" data-testid={`up-${p.id}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold">{p.user_name || p.user_email || p.user_id}</div>
                <span className="sc-chip">{p.status || "pending"}</span>
              </div>
              <div className="text-2xl font-extrabold">{formatINR(p.amount ?? 0)}</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)] mt-1">{formatDateTime(p.created_at)}</div>
              <div className="text-sm mt-1.5"><strong>UPI ref:</strong> {p.upi_ref || p.transaction_id || p.txn_id || "—"}</div>
              {p.screenshot_url && <img alt="" src={p.screenshot_url} className="mt-2 h-32 rounded-lg object-contain border border-[color:var(--sc-border)]" />}
              <div className="flex gap-2 mt-3">
                <button data-testid={`up-approve-${p.id}`} disabled={acting === p.id} onClick={() => act(p, "approve")} className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-lg bg-[color:var(--sc-primary)] text-white inline-flex items-center justify-center gap-1">
                  {acting === p.id ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Approve
                </button>
                <button data-testid={`up-reject-${p.id}`} disabled={acting === p.id} onClick={() => act(p, "reject")} className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center justify-center gap-1">
                  <X size={12} /> Reject
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="sc-card p-6 text-center text-[color:var(--sc-ink-muted)] col-span-full">No pending payments.</div>}
        </div>
      )}
    </Layout>
  );
}
