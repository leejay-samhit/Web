import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Check, X, Loader2 } from "lucide-react";
import { formatDateTime, initials } from "@/lib/utils";
import { log } from "@/lib/log";

const STATUSES = ["pending", "approved", "rejected"];

export default function AdminServiceApplications() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/service-applications", { params: { status } });
      setItems(data?.items || (Array.isArray(data) ? data : []));
    } catch (error) { log.error("AdminServiceApplications.load failed", error); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const act = async (a, action) => {
    setActing(a.id);
    try {
      await api.post(`/admin/service-applications/${a.id}/${action}`);
      load();
    } catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setActing(null); }
  };

  return (
    <Layout title="Admin · Service applications">
      <div className="flex gap-2 mb-3">
        {STATUSES.map((s) => (
          <button key={s} data-testid={`sa-tab-${s}`} onClick={() => setStatus(s)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border capitalize ${status === s ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="grid md:grid-cols-2 gap-3" data-testid="sa-list">
          {items.map((a) => (
            <div key={a.id} className="sc-card p-4" data-testid={`sa-card-${a.id}`}>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full sc-avatar text-white text-[11px] font-bold grid place-items-center">{initials(a.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{a.name}</div>
                  <div className="text-xs text-[color:var(--sc-ink-muted)] truncate">{a.email || a.user_email || "—"}</div>
                </div>
                <span className="sc-chip capitalize">{a.status}</span>
              </div>
              <div className="mt-2 text-sm space-y-0.5">
                <div><strong>Phone:</strong> {a.phone || "—"}</div>
                <div><strong>Service:</strong> {a.service_name || a.service_subcategory_name || "—"}</div>
                <div><strong>Category:</strong> {a.service_category || "—"}</div>
                <div><strong>Charge:</strong> ₹{a.charge ?? 0}</div>
                <div><strong>Pincode:</strong> {a.pincode || "—"}</div>
                <div><strong>Languages:</strong> {Array.isArray(a.languages) ? a.languages.join(", ") : (a.languages || "—")}</div>
                {a.description && <div className="text-xs text-[color:var(--sc-ink-muted)] mt-1 line-clamp-2">{a.description}</div>}
                <div className="text-xs text-[color:var(--sc-ink-muted)] mt-1">{formatDateTime(a.created_at)}</div>
              </div>
              {status === "pending" && (
                <div className="flex gap-2 mt-3">
                  <button data-testid={`sa-approve-${a.id}`} disabled={acting === a.id} onClick={() => act(a, "approve")} className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-lg bg-[color:var(--sc-primary)] text-white inline-flex items-center justify-center gap-1">
                    {acting === a.id ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Approve
                  </button>
                  <button data-testid={`sa-reject-${a.id}`} disabled={acting === a.id} onClick={() => act(a, "reject")} className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center justify-center gap-1">
                    <X size={12} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && <div className="sc-card p-6 text-center text-[color:var(--sc-ink-muted)] col-span-full">No applications.</div>}
        </div>
      )}
    </Layout>
  );
}
