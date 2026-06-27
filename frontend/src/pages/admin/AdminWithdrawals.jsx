import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Check, Loader2, X, CheckCheck } from "lucide-react";
import { formatINR, formatDateTime, initials } from "@/lib/utils";
import { log } from "@/lib/log";

const STATUSES = ["pending", "approved", "completed", "rejected"];

export default function AdminWithdrawals() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/withdrawals", { params: { status, limit: 50 } });
      setItems(Array.isArray(data) ? data : data?.items || []);
    } catch (error) {
      log.error("AdminWithdrawals.load failed", error);
    } finally {
      setLoading(false);
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const act = async (w, action) => {
    setActing(w.id);
    try {
      await api.post(`/admin/withdrawals/${w.id}/${action}`);
      load();
    } catch (error) {
      log.error(`AdminWithdrawals.${action} failed`, error);
      alert(error?.response?.data?.detail || "Action failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <Layout title="Admin · Withdrawals">
      <div className="flex gap-2 mb-3 flex-wrap">
        {STATUSES.map((s) => (
          <button key={s} data-testid={`wd-tab-${s}`} onClick={() => setStatus(s)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border capitalize ${status === s ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}
          >{s}</button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <div className="sc-card overflow-x-auto" data-testid="wd-table">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]"><tr>
              <th className="text-left px-4 py-2.5">User</th>
              <th className="text-left px-4 py-2.5">Amount</th>
              <th className="text-left px-4 py-2.5 hidden md:table-cell">UPI / Account</th>
              <th className="text-left px-4 py-2.5 hidden lg:table-cell">Requested</th>
              <th className="text-right px-4 py-2.5">Actions</th>
            </tr></thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id} className="border-t border-[color:var(--sc-border)]" data-testid={`wd-row-${w.id}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full sc-avatar text-white text-[11px] font-bold grid place-items-center">{initials(w.user_name || w.name)}</div>
                      <div>
                        <div className="font-semibold">{w.user_name || w.name}</div>
                        <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{w.user_email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-extrabold text-[color:var(--sc-primary)]">{formatINR(w.amount)}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell font-mono text-xs">{w.upi_id || w.bank_account || "—"}</td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(w.created_at)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {status === "pending" && (
                      <>
                        <button data-testid={`wd-approve-${w.id}`} disabled={acting === w.id} onClick={() => act(w, "approve")} className="text-xs font-semibold px-2 py-1 rounded-lg bg-[color:var(--sc-primary)] text-white mr-1 inline-flex items-center gap-1">
                          <Check size={12} /> Approve
                        </button>
                        <button data-testid={`wd-complete-${w.id}`} disabled={acting === w.id} onClick={() => act(w, "approve-and-complete")} className="text-xs font-semibold px-2 py-1 rounded-lg bg-emerald-600 text-white mr-1 inline-flex items-center gap-1">
                          <CheckCheck size={12} /> Approve & Pay
                        </button>
                        <button data-testid={`wd-reject-${w.id}`} disabled={acting === w.id} onClick={() => act(w, "reject")} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center gap-1">
                          <X size={12} /> Reject
                        </button>
                      </>
                    )}
                    {status === "approved" && (
                      <button data-testid={`wd-mark-${w.id}`} disabled={acting === w.id} onClick={() => act(w, "complete")} className="text-xs font-semibold px-2 py-1 rounded-lg bg-emerald-600 text-white inline-flex items-center gap-1">
                        {acting === w.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />} Mark paid
                      </button>
                    )}
                    {(status === "completed" || status === "rejected") && <span className="text-xs text-[color:var(--sc-ink-muted)] capitalize">{status}</span>}
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No withdrawals.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
