import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Check, Loader2, X } from "lucide-react";
import { formatDateTime, initials } from "@/lib/utils";
import { log } from "@/lib/log";

const STATUSES = ["pending", "approved", "rejected"];

export default function AdminApprovals() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/approvals", { params: { status } });
      setItems(Array.isArray(data) ? data : data?.items || []);
    } catch (error) {
      log.error("AdminApprovals.load failed", error);
    } finally {
      setLoading(false);
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const act = async (u, action) => {
    setActing(u.id);
    try {
      await api.post(`/admin/approvals/${u.id}/${action}`);
      load();
    } catch (error) {
      log.error(`AdminApprovals.${action} failed`, error);
      alert(error?.response?.data?.detail || "Action failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <Layout title="Admin · Approvals">
      <div className="flex gap-2 mb-3">
        {STATUSES.map((s) => (
          <button
            key={s}
            data-testid={`ap-tab-${s}`}
            onClick={() => setStatus(s)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border capitalize ${status === s ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="sc-card overflow-x-auto" data-testid="ap-table">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr><th className="text-left px-4 py-2.5">User</th><th className="text-left px-4 py-2.5 hidden md:table-cell">Email</th><th className="text-left px-4 py-2.5">Code</th><th className="text-left px-4 py-2.5">Joined</th><th className="text-right px-4 py-2.5">Actions</th></tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t border-[color:var(--sc-border)]" data-testid={`ap-row-${u.id}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full sc-avatar text-white text-[11px] font-bold grid place-items-center">{initials(u.name)}</div>
                      <div><div className="font-semibold">{u.name}</div></div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">{u.email}</td>
                  <td className="px-4 py-2.5"><span className="sc-chip">{u.referral_code}</span></td>
                  <td className="px-4 py-2.5 text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(u.created_at)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {status === "pending" ? (
                      <>
                        <button data-testid={`ap-approve-${u.id}`} disabled={acting === u.id} onClick={() => act(u, "approve")} className="text-xs font-semibold px-2 py-1 rounded-lg bg-[color:var(--sc-primary)] text-white inline-flex items-center gap-1 mr-1">
                          {acting === u.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve
                        </button>
                        <button data-testid={`ap-reject-${u.id}`} disabled={acting === u.id} onClick={() => act(u, "reject")} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center gap-1">
                          <X size={12} /> Reject
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-[color:var(--sc-ink-muted)]">{status}</span>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No items.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
