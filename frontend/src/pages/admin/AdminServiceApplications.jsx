import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Check, X, Loader2, Edit3, UserCheck, UserX, Save } from "lucide-react";
import { formatDateTime, initials } from "@/lib/utils";
import { log } from "@/lib/log";

const STATUSES = ["pending", "approved", "rejected"];

/* -------------------------------------------------------------------------- */
/*  Edit modal — admin-editable user fields                                   */
/* -------------------------------------------------------------------------- */
const EDITABLE = [
  ["name", "Full name", "text"],
  ["email", "Email", "email"],
  ["phone", "Phone", "tel"],
  ["upi_id", "UPI ID", "text"],
  ["account_holder", "Account holder name", "text"],
  ["bank_account", "Bank account", "text"],
  ["ifsc", "IFSC", "text"],
];

function EditProviderModal({ provider, onClose, onSaved }) {
  const [form, setForm] = useState(() => Object.fromEntries(EDITABLE.map(([k]) => [k, provider?.[k] || ""])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      );
      await api.patch(`/admin/users/${provider.user_id}`, payload);
      onSaved && onSaved();
      onClose();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d) => d?.msg || JSON.stringify(d)).join("; "));
      } else {
        setError(detail || "Could not save changes.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" data-testid="sa-edit-modal">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto sc-fade-in">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-3 border-b border-[color:var(--sc-border)] z-10">
          <div>
            <div className="font-extrabold">Edit provider details</div>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Updates the underlying user record. Service-specific fields (category, charge) are edited by the provider from their app.</div>
          </div>
          <button onClick={onClose} data-testid="sa-edit-close" className="text-[color:var(--sc-ink-muted)]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          {EDITABLE.map(([k, label, type]) => (
            <div key={k}>
              <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">{label}</label>
              <input
                className="sc-input mt-1"
                type={type}
                data-testid={`sa-edit-${k}`}
                value={form[k] ?? ""}
                onChange={set(k)}
              />
            </div>
          ))}
          {error && (
            <div data-testid="sa-edit-error" className="text-sm font-semibold text-[color:var(--sc-error)] bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="sc-btn-outline text-sm">Cancel</button>
            <button
              data-testid="sa-edit-save"
              disabled={saving}
              onClick={save}
              className="sc-btn-primary text-sm inline-flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main page                                                                 */
/* -------------------------------------------------------------------------- */
export default function AdminServiceApplications() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [userMap, setUserMap] = useState({}); // user_id -> is_blocked map
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/service-applications", { params: { status } });
      const list = data?.items || (Array.isArray(data) ? data : []);
      setItems(list);
    } catch (error) { log.error("AdminServiceApplications.load failed", error); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  // Lazily fetch blocked-status by querying the admin/users endpoint by email
  // (the q= search hits name/email/phone but NOT id). Runs after items render
  // so the page never blocks on this enrichment.
  useEffect(() => {
    let cancelled = false;
    const pending = items.filter((a) => a.user_id && a.email && userMap[a.user_id] === undefined);
    if (pending.length === 0) return;
    (async () => {
      const results = await Promise.allSettled(
        pending.map((a) => api.get("/admin/users", { params: { q: a.email, limit: 5 } }))
      );
      if (cancelled) return;
      setUserMap((prev) => {
        const next = { ...prev };
        results.forEach((r, idx) => {
          const a = pending[idx];
          if (r.status === "fulfilled") {
            const users = r.value.data?.items || (Array.isArray(r.value.data) ? r.value.data : []);
            const u = users.find((x) => x.id === a.user_id);
            if (u) next[a.user_id] = { is_blocked: !!u.is_blocked, name: u.name };
            else next[a.user_id] = { is_blocked: false, name: a.name }; // safe default
          } else {
            next[a.user_id] = { is_blocked: false, name: a.name };
          }
        });
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [items, userMap]);

  const act = async (a, action) => {
    setActing(`${a.id}-${action}`);
    try {
      await api.post(`/admin/service-applications/${a.id}/${action}`);
      load();
    } catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setActing(null); }
  };

  const toggleBlock = async (a) => {
    if (!a.user_id) return;
    const blocked = !!userMap[a.user_id]?.is_blocked;
    const verb = blocked ? "unblock" : "block";
    setActing(`${a.id}-${verb}`);
    try {
      await api.post(`/admin/users/${a.user_id}/${verb}`, blocked ? {} : { reason: "Deactivated from Service Applications" });
      setUserMap((m) => ({ ...m, [a.user_id]: { ...(m[a.user_id] || {}), is_blocked: !blocked } }));
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
          {items.map((a) => {
            const blocked = !!userMap[a.user_id]?.is_blocked;
            const blockKey = `${a.id}-block`, unblockKey = `${a.id}-unblock`;
            const busy = acting?.startsWith(`${a.id}-`);
            return (
              <div key={a.id} className="sc-card p-4" data-testid={`sa-card-${a.id}`}>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full sc-avatar text-white text-[11px] font-bold grid place-items-center">{initials(a.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{a.name}</div>
                    <div className="text-xs text-[color:var(--sc-ink-muted)] truncate">{a.email || a.user_email || "—"}</div>
                  </div>
                  <span className="sc-chip capitalize">{a.status}</span>
                  {a.status === "approved" && (
                    blocked ? (
                      <span data-testid={`sa-state-${a.id}`} className="sc-chip" style={{ background: "#FDECEC", color: "#B42318" }}>Inactive</span>
                    ) : (
                      <span data-testid={`sa-state-${a.id}`} className="sc-chip" style={{ background: "#E7F6EC", color: "#0F6E4F" }}>Active</span>
                    )
                  )}
                </div>
                <div className="mt-2 text-sm space-y-0.5">
                  <div><strong>Phone:</strong> {a.phone || "—"}</div>
                  <div><strong>Service:</strong> {a.service_name || a.service_subcategory_name || "—"}</div>
                  <div><strong>Category:</strong> {a.service_category || "—"}{a.service_subcategory_name ? ` › ${a.service_subcategory_name}` : ""}</div>
                  <div><strong>Charge:</strong> ₹{a.charge ?? 0}</div>
                  <div><strong>Pincode:</strong> {a.pincode || "—"}</div>
                  <div><strong>Languages:</strong> {Array.isArray(a.languages) ? a.languages.join(", ") : (a.languages || "—")}</div>
                  {a.description && <div className="text-xs text-[color:var(--sc-ink-muted)] mt-1 line-clamp-2">{a.description}</div>}
                  <div className="text-xs text-[color:var(--sc-ink-muted)] mt-1">{formatDateTime(a.created_at)}</div>
                </div>

                {status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <button data-testid={`sa-approve-${a.id}`} disabled={busy} onClick={() => act(a, "approve")} className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-lg bg-[color:var(--sc-primary)] text-white inline-flex items-center justify-center gap-1">
                      {acting === `${a.id}-approve` ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />} Approve
                    </button>
                    <button data-testid={`sa-reject-${a.id}`} disabled={busy} onClick={() => act(a, "reject")} className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center justify-center gap-1">
                      <X size={12} /> Reject
                    </button>
                  </div>
                )}

                {status === "approved" && (
                  <div className="flex gap-2 mt-3">
                    <button
                      data-testid={`sa-edit-${a.id}`}
                      disabled={busy}
                      onClick={() => setEditing(a)}
                      className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-lg border border-[color:var(--sc-border)] inline-flex items-center justify-center gap-1"
                    >
                      <Edit3 size={12} /> Edit details
                    </button>
                    {blocked ? (
                      <button
                        data-testid={`sa-activate-${a.id}`}
                        disabled={busy}
                        onClick={() => toggleBlock(a)}
                        className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-lg bg-[color:var(--sc-primary)] text-white inline-flex items-center justify-center gap-1"
                      >
                        {acting === unblockKey ? <Loader2 className="animate-spin" size={12} /> : <UserCheck size={12} />} Activate
                      </button>
                    ) : (
                      <button
                        data-testid={`sa-inactivate-${a.id}`}
                        disabled={busy}
                        onClick={() => toggleBlock(a)}
                        className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center justify-center gap-1"
                      >
                        {acting === blockKey ? <Loader2 className="animate-spin" size={12} /> : <UserX size={12} />} Inactivate
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {items.length === 0 && <div className="sc-card p-6 text-center text-[color:var(--sc-ink-muted)] col-span-full">No applications.</div>}
        </div>
      )}

      {editing && (
        <EditProviderModal
          provider={editing}
          onClose={() => setEditing(null)}
          onSaved={() => load()}
        />
      )}
    </Layout>
  );
}
