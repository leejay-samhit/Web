import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import BackendPendingBanner from "@/components/erp/BackendPendingBanner";
import { getErpSettings, saveErpSettings, paiseToRupees, rupeesToPaise } from "@/lib/erp";
import { LEARNING_TOPICS } from "@/lib/learningContent";
import { toast } from "sonner";
import { Save, Percent, Landmark, BellRing, GraduationCap, Plus, Trash2 } from "lucide-react";

const DEFAULT_SETTINGS = {
  gstSlabs: [{ rate: 0 }, { rate: 5 }, { rate: 12 }, { rate: 18 }, { rate: 28 }],
  hsnMap: [
    { hsn: "1006", gstPct: 5, description: "Rice" },
    { hsn: "6109", gstPct: 5, description: "T-shirts (< ₹1000)" },
    { hsn: "3004", gstPct: 12, description: "Medicaments" },
  ],
  thresholds: {
    gstRegistrationTurnover_paise:         4000000000, // ₹40 lakhs
    gstRegistrationTurnoverServices_paise: 2000000000, // ₹20 lakhs
    compositionEligible_paise:            15000000000, // ₹1.5 cr
    qrmpEligible_paise:                    50000000000, // ₹5 cr
  },
  reminders: { gstReturnDay: 20, annualReturnDate: "12-31" },
  learningCenter: LEARNING_TOPICS.map((t) => ({ slug: t.slug, title: t.title, content: t.body })),
};

const TABS = [
  { code: "gst",       label: "GST slabs",        icon: Percent },
  { code: "hsn",       label: "HSN mapping",      icon: Landmark },
  { code: "thresholds",label: "Thresholds",       icon: Landmark },
  { code: "reminders", label: "Reminders",        icon: BellRing },
  { code: "learning",  label: "Learning content", icon: GraduationCap },
];

const inputCls = "w-full rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--sc-primary)]/40";

export default function AdminErpSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [tab, setTab] = useState("gst");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const s = await getErpSettings();
        if (s) setSettings({ ...DEFAULT_SETTINGS, ...s });
        else setPending(true);
      } catch { setPending(true); }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await saveErpSettings(settings);
      toast.success("ERP settings saved");
    } catch {
      toast.info("Saved locally (backend endpoint pending).");
    }
    setSaving(false);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6" data-testid="admin-erp-settings">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-2xl font-extrabold">ERP Settings</div>
            <div className="text-xs text-[color:var(--sc-ink-muted)]">Super Admin controls for GST slabs, HSN codes, tax thresholds, reminders and learning content.</div>
          </div>
          <button onClick={save} disabled={saving} className="rounded-full px-5 py-2 bg-[color:var(--sc-primary)] text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-50" data-testid="erp-settings-save">
            <Save size={14} /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>

        {pending && <BackendPendingBanner endpoint="/api/admin/erp-settings" note="Editing locally until the backend is live." />}

        <div className="sc-card p-2 mb-4 flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.code}
              onClick={() => setTab(t.code)}
              data-testid={`erp-settings-tab-${t.code}`}
              className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${tab === t.code ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}
            >
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading…</div>
        ) : (
          <>
            {tab === "gst" && <SlabsTab slabs={settings.gstSlabs} onChange={(gstSlabs) => setSettings({ ...settings, gstSlabs })} />}
            {tab === "hsn" && <HsnTab hsn={settings.hsnMap} onChange={(hsnMap) => setSettings({ ...settings, hsnMap })} />}
            {tab === "thresholds" && <ThresholdsTab thresholds={settings.thresholds} onChange={(thresholds) => setSettings({ ...settings, thresholds })} />}
            {tab === "reminders" && <RemindersTab reminders={settings.reminders} onChange={(reminders) => setSettings({ ...settings, reminders })} />}
            {tab === "learning" && <LearningTab items={settings.learningCenter} onChange={(learningCenter) => setSettings({ ...settings, learningCenter })} />}
          </>
        )}
      </div>
    </Layout>
  );
}

function SlabsTab({ slabs, onChange }) {
  const set = (i, v) => onChange(slabs.map((s, idx) => (idx === i ? { rate: Number(v) } : s)));
  const add = () => onChange([...slabs, { rate: 0 }]);
  const remove = (i) => onChange(slabs.filter((_, idx) => idx !== i));
  return (
    <div className="sc-card p-4">
      <div className="text-sm font-extrabold mb-2">GST slabs (%)</div>
      <div className="text-xs text-[color:var(--sc-ink-muted)] mb-3">Rates available across the platform. Vendors pick from these on each product.</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {slabs.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="number" step="0.01" value={s.rate} onChange={(e) => set(i, e.target.value)} className={inputCls} data-testid={`slab-input-${i}`} />
            <button onClick={() => remove(i)} className="text-red-600"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--sc-primary)]" data-testid="slab-add"><Plus size={12} /> Add slab</button>
    </div>
  );
}

function HsnTab({ hsn, onChange }) {
  const set = (i, k, v) => onChange(hsn.map((r, idx) => (idx === i ? { ...r, [k]: k === "gstPct" ? Number(v) : v } : r)));
  const add = () => onChange([...hsn, { hsn: "", gstPct: 0, description: "" }]);
  const remove = (i) => onChange(hsn.filter((_, idx) => idx !== i));
  return (
    <div className="sc-card p-4">
      <div className="text-sm font-extrabold mb-2">HSN / SAC → GST% mapping</div>
      <div className="text-xs text-[color:var(--sc-ink-muted)] mb-3">Products with an HSN in this list inherit the GST rate automatically.</div>
      <table className="min-w-full text-sm">
        <thead className="bg-[color:var(--sc-accent-light)]/40 text-[11px] uppercase">
          <tr><th className="text-left px-2 py-1.5">HSN</th><th className="text-left px-2 py-1.5">GST %</th><th className="text-left px-2 py-1.5">Description</th><th></th></tr>
        </thead>
        <tbody>
          {hsn.map((r, i) => (
            <tr key={i} className="border-t border-[color:var(--sc-border)]">
              <td className="px-2 py-1"><input value={r.hsn} onChange={(e) => set(i, "hsn", e.target.value)} className={inputCls} data-testid={`hsn-code-${i}`} /></td>
              <td className="px-2 py-1"><input type="number" value={r.gstPct} onChange={(e) => set(i, "gstPct", e.target.value)} className={inputCls} /></td>
              <td className="px-2 py-1"><input value={r.description} onChange={(e) => set(i, "description", e.target.value)} className={inputCls} /></td>
              <td className="px-2 py-1"><button onClick={() => remove(i)} className="text-red-600"><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={add} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--sc-primary)]" data-testid="hsn-add"><Plus size={12} /> Add HSN mapping</button>
    </div>
  );
}

function ThresholdsTab({ thresholds, onChange }) {
  const setR = (k, v) => onChange({ ...thresholds, [k]: rupeesToPaise(v) });
  const rows = [
    { key: "gstRegistrationTurnover_paise",         label: "GST registration threshold (goods)" },
    { key: "gstRegistrationTurnoverServices_paise", label: "GST registration threshold (services)" },
    { key: "compositionEligible_paise",             label: "Composition scheme upper limit" },
    { key: "qrmpEligible_paise",                    label: "QRMP scheme upper limit" },
  ];
  return (
    <div className="sc-card p-4">
      <div className="text-sm font-extrabold mb-2">Turnover thresholds (₹)</div>
      <div className="text-xs text-[color:var(--sc-ink-muted)] mb-3">Update whenever government notifications change. Never hard-coded.</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((r) => (
          <label key={r.key} className="block">
            <span className="text-xs font-semibold">{r.label}</span>
            <input type="number" value={paiseToRupees(thresholds[r.key])} onChange={(e) => setR(r.key, e.target.value)} className={inputCls} data-testid={`threshold-${r.key}`} />
          </label>
        ))}
      </div>
    </div>
  );
}

function RemindersTab({ reminders, onChange }) {
  return (
    <div className="sc-card p-4">
      <div className="text-sm font-extrabold mb-2">Reminder schedule</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold">GST return day (of month)</span>
          <input type="number" min={1} max={31} value={reminders.gstReturnDay} onChange={(e) => onChange({ ...reminders, gstReturnDay: Number(e.target.value) })} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold">Annual return date (MM-DD)</span>
          <input type="text" value={reminders.annualReturnDate} onChange={(e) => onChange({ ...reminders, annualReturnDate: e.target.value })} className={inputCls} />
        </label>
      </div>
    </div>
  );
}

function LearningTab({ items, onChange }) {
  const set = (i, k, v) => onChange(items.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-3">
      {items.map((r, i) => (
        <div key={r.slug} className="sc-card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <label className="block">
              <span className="text-xs font-semibold">Slug</span>
              <input value={r.slug} disabled className={inputCls + " bg-slate-50"} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold">Title</span>
              <input value={r.title} onChange={(e) => set(i, "title", e.target.value)} className={inputCls} />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold">Content (markdown)</span>
            <textarea rows={6} value={r.content} onChange={(e) => set(i, "content", e.target.value)} className={inputCls + " font-mono text-xs"} />
          </label>
        </div>
      ))}
    </div>
  );
}
