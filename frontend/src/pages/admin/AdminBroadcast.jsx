import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatDateTime } from "@/lib/utils";
import { Send, Loader2 } from "lucide-react";
import { log } from "@/lib/log";

const AUDIENCES = ["all", "approved", "blocked", "pending"];

export default function AdminBroadcast() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ title: "", message: "", audience: "all", link_url: "", image_data_url: "" });
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/broadcasts", { params: { limit: 30 } });
      setList(Array.isArray(data) ? data : data?.items || []);
    } catch (error) {
      log.error("AdminBroadcast.load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target?.value ?? e }));

  const onImg = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setForm((s) => ({ ...s, image_data_url: r.result?.toString() || "" }));
    r.readAsDataURL(f);
  };

  const submit = async () => {
    setErr("");
    setSending(true);
    try {
      await api.post("/admin/broadcasts", form);
      setForm({ title: "", message: "", audience: "all", link_url: "", image_data_url: "" });
      load();
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) {
        setErr("Session expired or this action was rejected. Please re-login and try again.");
      } else {
        setErr(e?.response?.data?.detail || "Could not send broadcast");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout title="Admin · Broadcast">
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="sc-card p-5" data-testid="bc-form">
          <div className="font-extrabold mb-3">Compose broadcast</div>
          <input className="sc-input" data-testid="bc-title" placeholder="Title" value={form.title} onChange={set("title")} />
          <textarea className="sc-input mt-2 min-h-[120px]" data-testid="bc-msg" placeholder="Message" value={form.message} onChange={set("message")} />
          <input className="sc-input mt-2" data-testid="bc-link" placeholder="Link URL (optional)" value={form.link_url} onChange={set("link_url")} />
          <div className="mt-2">
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Image (optional)</label>
            <input type="file" accept="image/*" onChange={onImg} data-testid="bc-image" className="block mt-1 text-sm" />
            {form.image_data_url && (
              <img alt="" src={form.image_data_url} className="mt-2 h-24 rounded-lg border border-[color:var(--sc-border)]" />
            )}
          </div>
          <div className="mt-3">
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Audience</label>
            <select className="sc-input mt-1" data-testid="bc-aud" value={form.audience} onChange={set("audience")}>
              {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {err && <div data-testid="bc-err" className="text-sm font-semibold text-[color:var(--sc-error)] mt-2">{err}</div>}
          <button data-testid="bc-send" disabled={sending || !form.title || !form.message} onClick={submit} className="sc-btn-primary mt-3 inline-flex items-center gap-1.5">
            {sending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} Send
          </button>
        </div>

        <div className="sc-card p-5">
          <div className="font-extrabold mb-3">Past broadcasts</div>
          {loading ? <Spinner /> : (
            <div className="divide-y divide-[color:var(--sc-border)] max-h-[70vh] overflow-y-auto" data-testid="bc-list">
              {list.length === 0 ? (
                <div className="text-sm text-[color:var(--sc-ink-muted)] py-4 text-center">Nothing yet.</div>
              ) : list.map((b) => (
                <div key={b.id} className="py-3" data-testid={`bc-${b.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{b.title}</div>
                    <span className="sc-chip">{b.audience || "all"}</span>
                  </div>
                  <div className="text-xs text-[color:var(--sc-ink-muted)] mt-0.5">{formatDateTime(b.created_at)}</div>
                  <div className="text-sm mt-1">{b.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
