import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { DEFAULT_CMS, loadCms, saveCmsLocal, publishCms, resetCmsLocal } from "@/lib/landingCms";
import { Save, Loader2, RotateCcw, CheckCircle2, AlertCircle, ExternalLink, Eye, Plus, Trash2, GripVertical } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Field-metadata drives the entire form — every value in DEFAULT_CMS gets a
 * row here. Update this list to add / remove editable landing fields.
 */
const SECTIONS = [
  {
    title: "Hero",
    fields: [
      { key: "hero_eyebrow", label: "Eyebrow badge", type: "text" },
      { key: "hero_title_line1", label: "Headline · line 1", type: "text" },
      { key: "hero_title_line2", label: "Headline · line 2", type: "text" },
      { key: "hero_title_line3", label: "Headline · line 3", type: "text" },
      { key: "hero_subtitle", label: "Sub-headline paragraph", type: "textarea" },
      { key: "hero_cta_primary", label: "Primary CTA label", type: "text" },
      { key: "hero_cta_secondary", label: "Secondary CTA label", type: "text" },
      { key: "stat_1_k", label: "Stat 1 · number" },
      { key: "stat_1_v", label: "Stat 1 · caption" },
      { key: "stat_2_k", label: "Stat 2 · number" },
      { key: "stat_2_v", label: "Stat 2 · caption" },
      { key: "stat_3_k", label: "Stat 3 · number" },
      { key: "stat_3_v", label: "Stat 3 · caption" },
      { key: "brand_tagline", label: "Brand tagline (nav + footer)" },
    ],
  },
  {
    title: "APK / Download",
    help: "Drop your Android APK file at /app/frontend/public/slangcart.apk to serve it at slangcart.com/slangcart.apk — or paste a full CDN / GitHub-release URL below. Every \"Download App\" button on the site uses this URL.",
    fields: [
      { key: "apk_url", label: "APK URL", type: "text", placeholder: "/slangcart.apk or https://…" },
      { key: "apk_filename", label: "Suggested filename on download", type: "text", placeholder: "slangcart.apk" },
    ],
  },
  {
    title: "Billing Software section",
    fields: [
      { key: "billing_eyebrow", label: "Eyebrow" },
      { key: "billing_title", label: "Section title" },
      { key: "billing_sub", label: "Description", type: "textarea" },
    ],
  },
  {
    title: "Online Shop section",
    fields: [
      { key: "shop_eyebrow", label: "Eyebrow" },
      { key: "shop_title", label: "Section title" },
      { key: "shop_sub", label: "Description", type: "textarea" },
    ],
  },
  {
    title: "Service Marketplace section",
    fields: [
      { key: "services_eyebrow", label: "Eyebrow" },
      { key: "services_title", label: "Section title" },
      { key: "services_sub", label: "Description", type: "textarea" },
    ],
  },
  {
    title: "How it works section",
    fields: [
      { key: "how_eyebrow", label: "Eyebrow" },
      { key: "how_title", label: "Section title" },
    ],
  },
  {
    title: "What's inside section",
    fields: [
      { key: "features_eyebrow", label: "Eyebrow" },
      { key: "features_title", label: "Section title" },
    ],
  },
  {
    title: "Terms & Conditions section",
    fields: [
      { key: "terms_eyebrow", label: "Eyebrow" },
      { key: "terms_title", label: "Section title" },
    ],
  },
  {
    title: "Contact section",
    fields: [
      { key: "contact_eyebrow", label: "Eyebrow" },
      { key: "contact_title", label: "Section title" },
      { key: "contact_sub", label: "Description", type: "textarea" },
      { key: "contact_phone", label: "Public phone number" },
      { key: "contact_phone_href", label: "Phone link (tel:…)", placeholder: "tel:+919000012345" },
      { key: "contact_email", label: "Public email" },
      { key: "contact_address", label: "Office address" },
      { key: "contact_hours", label: "Business hours" },
      { key: "contact_whatsapp_url", label: "WhatsApp click-to-chat URL", placeholder: "https://wa.me/…" },
    ],
  },
  {
    title: "Careers section",
    fields: [
      { key: "careers_eyebrow", label: "Eyebrow" },
      { key: "careers_title", label: "Section title" },
      { key: "careers_sub", label: "Description", type: "textarea" },
      { key: "careers_email", label: "Default apply-email (all Apply buttons)", placeholder: "support@slangcart.com" },
      { key: "careers_bottom_title", label: "Bottom card · title" },
      { key: "careers_bottom_desc", label: "Bottom card · description", type: "textarea" },
    ],
  },
  {
    title: "Careers · open roles",
    help: "Add, rename or remove open roles. Each row becomes an Apply-Now card. Use the subtitle to describe location / type (e.g. \"Full-time · Bengaluru / Remote\"). Empty list = shows a friendly 'no open roles right now' message.",
    roles_repeater: true, // rendered by a special component below
  },
  {
    title: "Footer",
    fields: [
      { key: "footer_about", label: "About text", type: "textarea" },
    ],
  },
];

/** Repeater UI for the editable Careers open-roles list. */
let __roleUid = 0;
const nextRoleUid = () => `role-${++__roleUid}`;

function RolesRepeater({ roles, onChange }) {
  // Give every row a stable id so React can reconcile across reorder/delete
  // without unmounting the input (which drops the user's cursor).
  const rows = useMemo(
    () => (roles || []).map((r) => (r.__id ? r : { ...r, __id: nextRoleUid() })),
    [roles]
  );
  const commit = (next) =>
    onChange(next.map(({ __id, ...rest }) => rest));

  const setRole = (i, patch) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    commit(next);
  };
  const remove = (i) => commit(rows.filter((_, idx) => idx !== i));
  const add = () =>
    commit([...rows, { __id: nextRoleUid(), title: "New role", subtitle: "Full-time · Bengaluru / Remote" }]);
  const moveUp = (i) => {
    if (i <= 0) return;
    const next = rows.slice();
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    commit(next);
  };
  return (
    <div className="mt-4 space-y-2" data-testid="roles-repeater">
      {rows.length === 0 && (
        <div className="rounded-lg bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] text-xs px-3 py-3">
          No roles yet — click <b>Add role</b> below to create one.
        </div>
      )}
      {rows.map((r, i) => (
        <div
          key={r.__id}
          className="rounded-xl border border-[color:var(--sc-border)] p-3 grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-2 items-center"
          data-testid={`role-row-${i}`}
        >
          <button
            type="button"
            onClick={() => moveUp(i)}
            disabled={i === 0}
            aria-label="Move up"
            className="w-8 h-8 rounded-lg border border-[color:var(--sc-border)] grid place-items-center text-[color:var(--sc-ink-muted)] hover:bg-[color:var(--sc-accent-light)] disabled:opacity-30"
            title="Move up"
          >
            <GripVertical size={14} />
          </button>
          <input
            className="sc-input"
            value={r.title || ""}
            placeholder="Role title (e.g. Sales Executive)"
            onChange={(e) => setRole(i, { title: e.target.value })}
            data-testid={`role-title-${i}`}
          />
          <input
            className="sc-input"
            value={r.subtitle || ""}
            placeholder="Full-time · Bengaluru / Remote"
            onChange={(e) => setRole(i, { subtitle: e.target.value })}
            data-testid={`role-subtitle-${i}`}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Remove role"
            className="w-8 h-8 rounded-lg border border-rose-200 bg-rose-50 grid place-items-center text-rose-600 hover:bg-rose-100"
            title="Remove"
            data-testid={`role-remove-${i}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="sc-btn-outline inline-flex items-center gap-1.5 text-sm bg-white"
        data-testid="role-add"
      >
        <Plus size={14} /> Add role
      </button>
    </div>
  );
}

export default function AdminLanding() {
  const [cms, setCms] = useState(DEFAULT_CMS);
  const [loading, setLoading] = useState(true);
  const [savingLocal, setSavingLocal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await loadCms();
      if (!cancelled) {
        setCms(c);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setField = (key, val) => {
    setCms((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const applyLocal = () => {
    setSavingLocal(true);
    saveCmsLocal(cms);
    setSavingLocal(false);
    setDirty(false);
    setMsg({ kind: "ok", text: "Saved as a local preview in your browser. Reload the landing page to see the changes." });
    setTimeout(() => setMsg(null), 5000);
  };

  const publish = async () => {
    setPublishing(true);
    // Always keep local copy up-to-date first.
    saveCmsLocal(cms);
    const r = await publishCms(cms);
    setPublishing(false);
    setDirty(false);
    if (r.ok) {
      setMsg({ kind: "ok", text: "Published to backend. Every visitor of slangcart.com will now see this content." });
    } else {
      setMsg({
        kind: "warn",
        text: `Backend rejected the publish (${r.error}). Your changes are saved locally so you can still preview them. Ask the network-pay-1 backend dev to add \`landing_cms: dict | None = None\` to the \`SettingsUpdate\` Pydantic model + return it from \`GET /api/admin/settings\`, then click Publish again.`,
      });
    }
    setTimeout(() => setMsg(null), 12000);
  };

  const reset = () => {
    if (!window.confirm("Reset all fields back to the defaults? This clears your local preview.")) return;
    resetCmsLocal();
    setCms({ ...DEFAULT_CMS });
    setDirty(false);
    setMsg({ kind: "ok", text: "Reset to defaults." });
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <Layout title="Landing page · Content editor">
      <div className="max-w-4xl mx-auto space-y-6" data-testid="admin-landing">
        <div className="rounded-2xl bg-white border border-[color:var(--sc-border)] p-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)]">
              <Eye size={20} />
            </div>
            <div className="flex-1">
              <div className="font-extrabold text-[color:var(--sc-ink)]">Slangcart.com — homepage content</div>
              <div className="text-sm text-[color:var(--sc-ink-muted)] mt-1">
                Edit every text label and public contact detail on the public landing page.
                <b> Save preview</b> stores your changes in this browser only (great for reviewing).
                <b> Publish</b> writes them to the backend so every visitor sees them.
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <Link
                  to="/"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-[color:var(--sc-primary)] font-semibold hover:underline"
                  data-testid="admin-landing-preview"
                >
                  Open landing page in new tab <ExternalLink size={13} />
                </Link>
                {dirty && (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    Unsaved changes
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {msg && (
          <div
            data-testid="admin-landing-msg"
            className={
              "rounded-xl px-4 py-3 flex items-start gap-2 text-sm font-medium " +
              (msg.kind === "ok"
                ? "bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] border border-[color:var(--sc-primary)]/20"
                : "bg-amber-50 text-amber-800 border border-amber-200")
            }
          >
            {msg.kind === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white border border-[color:var(--sc-border)] p-10 grid place-items-center">
            <Loader2 size={22} className="animate-spin text-[color:var(--sc-primary)]" />
          </div>
        ) : (
          <>
            {SECTIONS.map((sec) => (
              <div key={sec.title} className="rounded-2xl bg-white border border-[color:var(--sc-border)] p-5" data-testid={`section-${sec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                <div className="font-extrabold text-[color:var(--sc-ink)]">{sec.title}</div>
                {sec.help && (
                  <div className="mt-1 text-xs text-[color:var(--sc-ink-muted)]">{sec.help}</div>
                )}
                {sec.roles_repeater ? (
                  <RolesRepeater
                    roles={Array.isArray(cms.careers_roles) ? cms.careers_roles : []}
                    onChange={(next) => setField("careers_roles", next)}
                  />
                ) : (
                  <div className="mt-4 grid sm:grid-cols-2 gap-4">
                    {sec.fields.map((f) => (
                      <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                        <label className="text-xs font-semibold text-[color:var(--sc-ink)]">{f.label}</label>
                        {f.type === "textarea" ? (
                          <textarea
                            rows={3}
                            value={cms[f.key] ?? ""}
                            onChange={(e) => setField(f.key, e.target.value)}
                            className="sc-input mt-1 resize-none"
                            placeholder={f.placeholder}
                            data-testid={`cms-${f.key}`}
                          />
                        ) : (
                          <input
                            type="text"
                            value={cms[f.key] ?? ""}
                            onChange={(e) => setField(f.key, e.target.value)}
                            className="sc-input mt-1"
                            placeholder={f.placeholder}
                            data-testid={`cms-${f.key}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        <div className="rounded-2xl bg-white border border-[color:var(--sc-border)] p-4 sticky bottom-4 shadow-[0_20px_50px_-20px_rgba(15,110,79,0.35)] flex flex-wrap items-center gap-3 z-10">
          <button
            type="button"
            onClick={reset}
            className="sc-btn-outline inline-flex items-center gap-2 text-sm"
            data-testid="cms-reset"
          >
            <RotateCcw size={14} /> Reset to defaults
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={applyLocal}
            disabled={savingLocal}
            className="sc-btn-ghost inline-flex items-center gap-2 text-sm"
            data-testid="cms-save-local"
          >
            {savingLocal ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
            Save preview (this browser)
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="sc-btn-primary inline-flex items-center gap-2 text-sm"
            data-testid="cms-publish"
          >
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Publish to slangcart.com
          </button>
        </div>
      </div>
    </Layout>
  );
}
