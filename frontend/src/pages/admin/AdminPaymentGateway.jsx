import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Save, TestTube2, Trash2, Loader2 } from "lucide-react";
import { log } from "@/lib/log";

export default function AdminPaymentGateway() {
  const [data, setData] = useState({});
  const [form, setForm] = useState({ key_id: "", key_secret: "", webhook_secret: "", is_test_mode: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cfg } = await api.get("/admin/payment-gateway");
      setData(cfg || {});
    } catch (error) { log.error("AdminPaymentGateway.load failed", error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const payload = { key_id: form.key_id, key_secret: form.key_secret, is_test_mode: form.is_test_mode };
      if (form.webhook_secret) payload.webhook_secret = form.webhook_secret;
      await api.put("/admin/payment-gateway", payload);
      setMsg("Saved successfully.");
      load();
    } catch (e) { setMsg(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setMsg("");
    try {
      const { data: r } = await api.post("/admin/payment-gateway/test");
      setMsg(r?.message || r?.status || "Test successful");
    } catch (e) { setMsg(e?.response?.data?.detail || "Test failed"); }
    finally { setTesting(false); }
  };

  const clear = async () => {
    if (!window.confirm("Clear payment gateway DB override?")) return;
    try { await api.delete("/admin/payment-gateway"); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  if (loading) return <Layout title="Admin · Payment gateway"><Spinner /></Layout>;

  return (
    <Layout title="Admin · Payment gateway (Razorpay)">
      <div className="sc-card p-5 max-w-2xl mb-4" data-testid="pg-status">
        <div className="font-extrabold mb-3">Current config</div>
        <div className="text-sm space-y-1">
          <div><strong>Source:</strong> {data.source || "—"}</div>
          <div><strong>Key ID:</strong> <span className="font-mono">{data.key_id || "—"}</span></div>
          <div><strong>Secret:</strong> <span className="font-mono">{data.key_secret_masked || "—"}</span></div>
          <div><strong>Mode:</strong> {data.is_test_mode ? "TEST" : "LIVE"} {data.is_mock ? "(mock)" : ""}</div>
          <div><strong>DB override:</strong> {data.has_db_override ? "Yes" : "No"}</div>
          <div><strong>Env fallback:</strong> {data.has_env_fallback ? "Yes" : "No"}</div>
          {data.updated_at && <div className="text-xs text-[color:var(--sc-ink-muted)]">Updated {data.updated_at} by {data.updated_by || "—"}</div>}
        </div>
      </div>

      <div className="sc-card p-5 max-w-2xl" data-testid="pg-form">
        <div className="font-extrabold mb-3">Override / update keys</div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Key ID</label>
            <input className="sc-input mt-1" data-testid="pg-key-id" placeholder="rzp_test_…" value={form.key_id} onChange={(e) => setForm({ ...form, key_id: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Key Secret</label>
            <input className="sc-input mt-1" type="password" data-testid="pg-key-secret" value={form.key_secret} onChange={(e) => setForm({ ...form, key_secret: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Webhook Secret (optional)</label>
            <input className="sc-input mt-1" type="password" data-testid="pg-webhook-secret" value={form.webhook_secret} onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })} />
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" data-testid="pg-test-mode" checked={form.is_test_mode} onChange={(e) => setForm({ ...form, is_test_mode: e.target.checked })} />
            Test mode
          </label>
        </div>

        {msg && <div data-testid="pg-msg" className="mt-3 text-sm font-semibold text-[color:var(--sc-primary)]">{msg}</div>}

        <div className="flex flex-wrap gap-2 mt-4">
          <button data-testid="pg-save" disabled={saving} onClick={save} className="sc-btn-primary inline-flex items-center gap-1.5">
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save
          </button>
          <button data-testid="pg-test" disabled={testing} onClick={test} className="sc-btn-outline inline-flex items-center gap-1.5">
            {testing ? <Loader2 className="animate-spin" size={14} /> : <TestTube2 size={14} />} Test connection
          </button>
          <button data-testid="pg-clear" onClick={clear} className="sc-btn-outline text-[color:var(--sc-error)] inline-flex items-center gap-1.5">
            <Trash2 size={14} /> Clear DB override
          </button>
        </div>
      </div>
    </Layout>
  );
}
