import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { formatDateTime } from "@/lib/utils";
import { LifeBuoy, Loader2, Plus } from "lucide-react";
import { log } from "@/lib/log";

const CATEGORIES = ["account", "payment", "shop", "service", "chat", "other"];

export default function Tickets() {
  const nav = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "account", message: "", attachment_b64: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/tickets/me");
      setTickets(Array.isArray(data) ? data : data?.items || []);
    } catch (error) {
      log.error("Tickets.load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onAttach = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return alert("Attachment must be under 2 MB");
    const r = new FileReader();
    r.onload = () => setForm((s) => ({ ...s, attachment_b64: r.result?.toString() || "" }));
    r.readAsDataURL(f);
  };

  const create = async () => {
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/tickets", form);
      setShowNew(false);
      setForm({ subject: "", category: "account", message: "", attachment_b64: "" });
      load();
      if (data?.id) nav(`/support/${data.id}`);
    } catch (error) {
      log.error("Tickets.create failed", error);
      setErr(error?.response?.data?.detail || "Could not create ticket.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Support tickets">
      <div className="flex justify-end mb-3">
        <button data-testid="tk-new" onClick={() => setShowNew(true)} className="sc-btn-primary inline-flex items-center gap-1.5">
          <Plus size={16} /> New ticket
        </button>
      </div>
      {loading ? <Spinner /> : tickets.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No tickets yet" hint="Open one any time we can help." />
      ) : (
        <div className="space-y-2" data-testid="tk-list">
          {tickets.map((t) => (
            <Link key={t.id} to={`/support/${t.id}`} className="sc-card p-4 block hover:border-[color:var(--sc-primary)]/40" data-testid={`tk-${t.id}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-extrabold truncate">{t.subject || "(no subject)"}</div>
                  <div className="text-xs text-[color:var(--sc-ink-muted)]">#{(t.id || "").slice(0, 8)} · {t.category}</div>
                </div>
                <span className="sc-chip">{t.status}</span>
              </div>
              <div className="text-xs text-[color:var(--sc-ink-muted)] mt-1">{formatDateTime(t.updated_at || t.created_at)}</div>
            </Link>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 sc-fade-in" data-testid="tk-modal">
            <div className="font-extrabold mb-3">New ticket</div>
            <input className="sc-input mb-2" data-testid="tk-subject" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <select className="sc-input mb-2" data-testid="tk-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea className="sc-input min-h-[120px] mb-2" data-testid="tk-message" placeholder="Describe your issue…" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <input type="file" accept="image/*,application/pdf" onChange={onAttach} data-testid="tk-attach" className="block text-sm mb-2" />
            {err && <div data-testid="tk-err" className="text-sm font-semibold text-[color:var(--sc-error)] mb-2">{err}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="sc-btn-outline text-sm">Cancel</button>
              <button data-testid="tk-create" onClick={create} disabled={busy || !form.subject || !form.message} className="sc-btn-primary text-sm inline-flex items-center gap-1.5">
                {busy && <Loader2 size={14} className="animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
