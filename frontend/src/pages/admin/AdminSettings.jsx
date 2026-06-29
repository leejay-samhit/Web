import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Save, Loader2, Phone, Info, CheckCircle2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { log } from "@/lib/log";

/**
 * Hidden internal keys never editable from this UI.
 */
const HIDDEN_PREFIXES = ["danger_pin", "_id"];
const HIDDEN_SUFFIXES = ["_hash", "_at"];
const HIDDEN_EXACT = new Set(["id", "_id"]);
const isHidden = (k) =>
  HIDDEN_EXACT.has(k) ||
  HIDDEN_PREFIXES.some((p) => k.startsWith(p)) ||
  HIDDEN_SUFFIXES.some((s) => k.endsWith(s));

/**
 * Phone-reveal (service money collection) fields — promoted out of the
 * generic grid into a dedicated, friendlier card so the admin always knows
 * exactly how much money is being collected per reveal.
 */
const REVEAL_KEYS = new Set(["phone_reveal_fee", "phone_reveal_gst_pct"]);

export default function AdminSettings() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingReveal, setSavingReveal] = useState(false);
  const [msg, setMsg] = useState("");
  const [revealMsg, setRevealMsg] = useState("");
  const [revealOk, setRevealOk] = useState(false);

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

  // Save everything EXCEPT the reveal fields (those have their own button).
  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const payload = Object.fromEntries(
        Object.entries(data).filter(([k]) => !isHidden(k) && !REVEAL_KEYS.has(k))
      );
      await api.put("/admin/settings", payload);
      setMsg("Saved.");
    } catch (e) { setMsg(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  // Dedicated save for the phone-reveal (service money) fee.
  const saveReveal = async () => {
    setSavingReveal(true);
    setRevealMsg("");
    setRevealOk(false);
    try {
      const fee = Number(data.phone_reveal_fee ?? 0);
      const gst = Number(data.phone_reveal_gst_pct ?? 0);
      await api.put("/admin/settings", { phone_reveal_fee: fee, phone_reveal_gst_pct: gst });
      setRevealMsg("Service-money fee saved.");
      setRevealOk(true);
      // Reload to confirm the new values stuck
      const { data: s } = await api.get("/admin/settings");
      setData(s || {});
    } catch (e) {
      const detail = e?.response?.data?.detail || "Save failed";
      // The current backend's `SettingsUpdate` Pydantic model doesn't accept
      // phone_reveal_fee/phone_reveal_gst_pct yet, so we surface a clear
      // remediation note for the backend team.
      if (typeof detail === "string" && /no fields provided/i.test(detail)) {
        setRevealMsg(
          "Your backend's SettingsUpdate schema doesn't accept these fields yet. " +
          "On the network-pay-1 backend, add `phone_reveal_fee: float | None = Field(default=None, ge=0)` " +
          "and `phone_reveal_gst_pct: float | None = Field(default=None, ge=0, le=100)` to the SettingsUpdate model, then redeploy."
        );
      } else {
        setRevealMsg(detail);
      }
    } finally {
      setSavingReveal(false);
    }
  };

  if (loading) return <Layout title="Admin · Payout structure"><Spinner /></Layout>;

  const fee = Number(data.phone_reveal_fee ?? 0);
  const gstPct = Number(data.phone_reveal_gst_pct ?? 0);
  const gstAmt = Math.round((fee * gstPct / 100) * 100) / 100;
  const total = Math.round((fee + gstAmt) * 100) / 100;

  const entries = Object.entries(data || {}).filter(
    ([k]) => !isHidden(k) && !REVEAL_KEYS.has(k)
  );

  return (
    <Layout title="Admin · Payout structure & settings">
      {/* ============================================================== */}
      {/*  Service-money (phone reveal) fee — editable                    */}
      {/* ============================================================== */}
      <div className="sc-card p-5 max-w-3xl mb-4" data-testid="reveal-fee-card">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary)] grid place-items-center"><Phone size={16} /></div>
          <div className="font-extrabold">Service money — phone-reveal fee</div>
        </div>
        <div className="text-xs text-[color:var(--sc-ink-muted)] mb-3">
          This is the amount every user pays from their wallet to unlock a service-provider&apos;s phone number. Default is ₹1 + 18% GST = ₹1.18.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Base fee (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              data-testid="set-phone_reveal_fee"
              className="sc-input mt-1"
              value={data.phone_reveal_fee ?? ""}
              onChange={(e) => update("phone_reveal_fee", e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">GST (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              data-testid="set-phone_reveal_gst_pct"
              className="sc-input mt-1"
              value={data.phone_reveal_gst_pct ?? ""}
              onChange={(e) => update("phone_reveal_gst_pct", e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </div>
          <div className="bg-[color:var(--sc-accent-light)]/40 border border-[color:var(--sc-border)] rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-[color:var(--sc-ink-muted)]">Live preview · user pays</div>
            <div className="text-2xl font-extrabold text-[color:var(--sc-primary)]" data-testid="reveal-fee-preview">{formatINR(total)}</div>
            <div className="text-[10px] text-[color:var(--sc-ink-muted)]">{formatINR(fee)} + GST {formatINR(gstAmt)}</div>
          </div>
        </div>
        {revealMsg && (
          <div
            data-testid="reveal-fee-msg"
            className={`mt-3 text-xs font-semibold px-3 py-2 rounded-xl flex items-start gap-1.5 ${revealOk ? "text-[color:var(--sc-primary)] bg-[color:var(--sc-accent-light)]/60" : "text-[color:var(--sc-error)] bg-red-50 border border-red-100"}`}
          >
            {revealOk ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <Info size={14} className="mt-0.5 shrink-0" />}
            <span>{revealMsg}</span>
          </div>
        )}
        <button
          data-testid="reveal-fee-save"
          disabled={savingReveal}
          onClick={saveReveal}
          className="sc-btn-primary mt-3 inline-flex items-center gap-1.5"
        >
          {savingReveal ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save service-money fee
        </button>
      </div>

      {/* ============================================================== */}
      {/*  Generic settings (payouts, registration fee, flags, …)         */}
      {/* ============================================================== */}
      <div className="sc-card p-5 max-w-3xl" data-testid="settings-form">
        <div className="font-extrabold mb-3">Other settings</div>
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
                      try { update(k, JSON.parse(e.target.value)); } catch (err) { log.debug("AdminSettings: invalid JSON for", k, err?.message); }
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
