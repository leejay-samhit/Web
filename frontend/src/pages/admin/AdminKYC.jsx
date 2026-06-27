import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Check, Loader2, X, FileText } from "lucide-react";
import { formatDateTime, initials } from "@/lib/utils";
import { log } from "@/lib/log";

const STATUSES = ["pending", "approved", "rejected"];

export default function AdminKYC() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/kyc", { params: { status } });
      setItems(Array.isArray(data) ? data : data?.items || []);
    } catch (error) {
      log.error("AdminKYC.load failed", error);
    } finally {
      setLoading(false);
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const view = async (u) => {
    try {
      const { data } = await api.get(`/admin/kyc/${u.user_id || u.id}`);
      setViewing(data);
    } catch (error) {
      log.error("AdminKYC.view failed", error);
    }
  };

  const act = async (u, action) => {
    const uid = u.user_id || u.id;
    setActing(uid);
    try {
      await api.post(`/admin/kyc/${uid}/${action}`);
      setViewing(null);
      load();
    } catch (error) {
      log.error(`AdminKYC.${action} failed`, error);
      alert(error?.response?.data?.detail || "Action failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <Layout title="Admin · KYC review">
      <div className="flex gap-2 mb-3">
        {STATUSES.map((s) => (
          <button key={s} data-testid={`kyca-tab-${s}`} onClick={() => setStatus(s)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border capitalize ${status === s ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}
          >{s}</button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <div className="sc-card overflow-x-auto" data-testid="kyca-table">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]"><tr>
              <th className="text-left px-4 py-2.5">User</th>
              <th className="text-left px-4 py-2.5 hidden md:table-cell">Aadhaar</th>
              <th className="text-left px-4 py-2.5 hidden md:table-cell">PAN</th>
              <th className="text-left px-4 py-2.5">Submitted</th>
              <th className="text-right px-4 py-2.5">Actions</th>
            </tr></thead>
            <tbody>
              {items.map((k) => (
                <tr key={k.id || k.user_id} className="border-t border-[color:var(--sc-border)]" data-testid={`kyca-row-${k.user_id || k.id}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full sc-avatar text-white text-[11px] font-bold grid place-items-center">{initials(k.full_name || k.name)}</div>
                      <div className="font-semibold">{k.full_name || k.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell font-mono text-xs">{k.aadhaar || "—"}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell font-mono text-xs">{k.pan || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(k.created_at || k.submitted_at)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button data-testid={`kyca-view-${k.user_id || k.id}`} onClick={() => view(k)} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] inline-flex items-center gap-1 mr-1">
                      <FileText size={12} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No KYC records.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 sc-fade-in max-h-[90vh] overflow-y-auto" data-testid="kyca-modal">
            <div className="flex justify-between items-center mb-3">
              <div className="font-extrabold">{viewing.full_name}</div>
              <button onClick={() => setViewing(null)}><X size={18} /></button>
            </div>
            <div className="text-xs text-[color:var(--sc-ink-muted)] grid grid-cols-2 gap-2 mb-3">
              <div>Aadhaar: <b className="text-[color:var(--sc-ink)]">{viewing.aadhaar}</b></div>
              <div>PAN: <b className="text-[color:var(--sc-ink)]">{viewing.pan}</b></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {["aadhaar_front", "aadhaar_back", "pan_image", "selfie"].map((k) => viewing[k] && (
                <div key={k}>
                  <div className="text-[11px] font-semibold text-[color:var(--sc-ink-muted)] mb-1">{k.replace(/_/g, " ")}</div>
                  <img alt="" src={viewing[k]} className="w-full rounded-xl border border-[color:var(--sc-border)]" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button data-testid="kyca-reject" disabled={acting} onClick={() => act(viewing, "reject")} className="sc-btn-outline text-sm inline-flex items-center gap-1">
                <X size={14} /> Reject
              </button>
              <button data-testid="kyca-approve" disabled={acting} onClick={() => act(viewing, "approve")} className="sc-btn-primary text-sm inline-flex items-center gap-1">
                {acting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
