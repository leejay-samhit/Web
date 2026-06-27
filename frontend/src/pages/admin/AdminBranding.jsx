import { useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Loader2, RefreshCw, Save } from "lucide-react";

export default function AdminBranding() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/branding");
      setData(data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const setColor = (k, v) => setData((d) => ({ ...d, colors: { ...(d?.colors || {}), [k]: v } }));

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      await api.put("/admin/branding", data);
      setMsg("Branding saved.");
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) {
        setMsg("Session expired or this action was rejected. Please re-login and try again.");
      } else {
        setMsg(e?.response?.data?.detail || "Failed");
      }
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Reset branding to defaults?")) return;
    try {
      await api.post("/admin/branding/reset");
      load();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed");
    }
  };

  if (loading || !data) return <Layout title="Admin · Branding"><Spinner /></Layout>;

  const colors = data.colors || {};

  return (
    <Layout title="Admin · Branding">
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="sc-card p-5 space-y-2" data-testid="br-text">
          <div className="font-extrabold mb-1">Identity</div>
          <input className="sc-input" data-testid="br-name" placeholder="App name" value={data.app_name || ""} onChange={(e) => setData({ ...data, app_name: e.target.value })} />
          <input className="sc-input" data-testid="br-tag" placeholder="Tagline" value={data.tagline || ""} onChange={(e) => setData({ ...data, tagline: e.target.value })} />
          <input className="sc-input" data-testid="br-login" placeholder="Login subtitle" value={data.login_subtitle || ""} onChange={(e) => setData({ ...data, login_subtitle: e.target.value })} />
          <input className="sc-input" data-testid="br-pay-hero" placeholder="Payment hero" value={data.payment_hero || ""} onChange={(e) => setData({ ...data, payment_hero: e.target.value })} />
          <input className="sc-input" data-testid="br-pending" placeholder="Pending hero" value={data.pending_hero || ""} onChange={(e) => setData({ ...data, pending_hero: e.target.value })} />
        </div>

        <div className="sc-card p-5" data-testid="br-colors">
          <div className="font-extrabold mb-3">Colors</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["primary", "Primary"],
              ["accent", "Accent"],
              ["background", "Background"],
              ["surface", "Surface"],
              ["textMain", "Text"],
              ["success", "Success"],
              ["warning", "Warning"],
              ["border", "Border"],
            ].map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="color" value={colors[k] || "#000000"} onChange={(e) => setColor(k, e.target.value)} data-testid={`br-color-${k}`} className="w-9 h-9 rounded" />
                <div>
                  <div className="font-semibold">{label}</div>
                  <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{colors[k] || "—"}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button data-testid="br-save" onClick={save} disabled={saving} className="sc-btn-primary inline-flex items-center gap-1.5">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
        <button data-testid="br-reset" onClick={reset} className="sc-btn-outline inline-flex items-center gap-1.5">
          <RefreshCw size={14} /> Reset
        </button>
        {msg && <div className="text-sm font-semibold text-[color:var(--sc-primary)]" data-testid="br-msg">{msg}</div>}
      </div>
    </Layout>
  );
}
