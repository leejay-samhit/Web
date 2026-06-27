import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Save, Loader2 } from "lucide-react";
import { log } from "@/lib/log";

export default function AdminSettings() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: s } = await api.get("/admin/settings");
      setData(s || {});
    } catch (error) { log.error("AdminSettings.load failed", error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = (key, value) => setData((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setSaving(true); setMsg("");
    try { await api.put("/admin/settings", data); setMsg("Saved."); }
    catch (e) { setMsg(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  if (loading) return <Layout title="Admin · Payout structure"><Spinner /></Layout>;

  // Hide internal/sensitive keys from the editable settings UI.
  const HIDDEN_PREFIXES = ["danger_pin", "_id"];
  const HIDDEN_SUFFIXES = ["_hash", "_at"];
  const HIDDEN_EXACT = new Set(["id", "_id"]);
  const isHidden = (k) =>
    HIDDEN_EXACT.has(k) ||
    HIDDEN_PREFIXES.some((p) => k.startsWith(p)) ||
    HIDDEN_SUFFIXES.some((s) => k.endsWith(s));
  const entries = Object.entries(data || {}).filter(([k]) => !isHidden(k));

  return (
    <Layout title="Admin · Payout structure & settings">
      <div className="sc-card p-5 max-w-3xl" data-testid="settings-form">
        <div className="font-extrabold mb-3">Edit settings</div>
        {entries.length === 0 ? (
          <div className="text-sm text-[color:var(--sc-ink-muted)] py-4 text-center">No settings.</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3" data-testid="settings-grid">
            {entries.map(([k, v]) => {
              const isBool = typeof v === "boolean";
              const isNum = typeof v === "number";
              if (typeof v === "object" && v !== null) {
                return (
                  <div key={k} className="sm:col-span-2">
                    <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">{k}</label>
                    <textarea className="sc-input mt-1 font-mono text-xs" rows={4} data-testid={`set-${k}`} value={JSON.stringify(v, null, 2)} onChange={(e) => {
                      try { update(k, JSON.parse(e.target.value)); } catch { /* ignore until valid */ }
                    }} />
                  </div>
                );
              }
              return (
                <div key={k}>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">{k}</label>
                  {isBool ? (
                    <div className="mt-1"><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" data-testid={`set-${k}`} checked={!!v} onChange={(e) => update(k, e.target.checked)} /> {String(v)}</label></div>
                  ) : (
                    <input className="sc-input mt-1" type={isNum ? "number" : "text"} data-testid={`set-${k}`} value={v ?? ""} onChange={(e) => update(k, isNum ? Number(e.target.value) : e.target.value)} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {msg && <div data-testid="settings-msg" className="mt-3 text-sm font-semibold text-[color:var(--sc-primary)]">{msg}</div>}

        <button data-testid="settings-save" disabled={saving} onClick={save} className="sc-btn-primary mt-4 inline-flex items-center gap-1.5">
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save settings
        </button>
      </div>
    </Layout>
  );
}
