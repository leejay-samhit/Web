import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import {
  Loader2, Save, RotateCcw, Store, Wrench, Plus, Trash2, ArrowUp, ArrowDown,
  FileText, CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  loadTerms, saveTermsLocal, publishTerms, resetTermsLocal,
  DEFAULT_TERMS,
} from "@/lib/onboardingTerms";

/* -------------------------------------------------------------------------- */
/*  Editable-clauses list widget                                              */
/* -------------------------------------------------------------------------- */
/* Assign a stable per-render ID to each clause so React reconciliation
 * survives reorder + delete without losing the textarea cursor. */
let __clauseUid = 0;
const nextUid = () => `c-${++__clauseUid}`;

function useIdentifiedClauses(clauses) {
  // Ensure every clause has an id. Recompute only when the clauses reference
  // itself changes AND lengths differ or content shifts unexpectedly.
  const identified = useMemo(() => {
    return (clauses || []).map((raw) => {
      if (raw && typeof raw === "object" && raw.__id) return raw;
      return { __id: nextUid(), text: typeof raw === "string" ? raw : (raw?.text || "") };
    });
  }, [clauses]);
  return identified;
}

function ClauseList({ clauses, onChange, testIdRoot }) {
  const rows = useIdentifiedClauses(clauses);
  // Emit plain strings back up so the parent's data model stays a `string[]`.
  const commit = (next) => onChange(next.map((r) => r.text));

  const set = (i, v) => {
    const next = [...rows];
    next[i] = { ...next[i], text: v };
    commit(next);
  };
  const add = () => commit([...rows, { __id: nextUid(), text: "" }]);
  const remove = (i) => commit(rows.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  return (
    <div className="space-y-2">
      {rows.map((c, i) => (
        <div key={c.__id} className="flex items-start gap-2" data-testid={`${testIdRoot}-clause-${i + 1}`}>
          <div className="w-7 h-7 mt-1 rounded-lg bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)] text-xs font-extrabold shrink-0">
            {i + 1}
          </div>
          <textarea
            className="sc-input flex-1 min-h-[64px] text-sm"
            value={c.text}
            onChange={(e) => set(i, e.target.value)}
            data-testid={`${testIdRoot}-clause-text-${i + 1}`}
          />
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
              className="w-7 h-7 rounded-lg border border-[color:var(--sc-border)] grid place-items-center disabled:opacity-40 hover:bg-[color:var(--sc-accent-light)]"
              title="Move up"
              data-testid={`${testIdRoot}-clause-up-${i + 1}`}>
              <ArrowUp size={12} />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1}
              className="w-7 h-7 rounded-lg border border-[color:var(--sc-border)] grid place-items-center disabled:opacity-40 hover:bg-[color:var(--sc-accent-light)]"
              title="Move down"
              data-testid={`${testIdRoot}-clause-down-${i + 1}`}>
              <ArrowDown size={12} />
            </button>
            <button type="button" onClick={() => remove(i)}
              className="w-7 h-7 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 grid place-items-center hover:bg-rose-100"
              title="Remove"
              data-testid={`${testIdRoot}-clause-remove-${i + 1}`}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="text-sm font-semibold text-[color:var(--sc-primary)] hover:underline inline-flex items-center gap-1"
        data-testid={`${testIdRoot}-clause-add`}>
        <Plus size={13} /> Add clause
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  One role's editor (title + intro + clauses + declaration + agree label)   */
/* -------------------------------------------------------------------------- */
function RoleEditor({ role, value, onChange, icon: Icon }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const clauseSet = (arr) => onChange({ ...value, clauses: arr });

  return (
    <div className="sc-card p-5 space-y-4" data-testid={`ot-role-${role}`}>
      <div className="flex items-center gap-2 pb-2 border-b border-[color:var(--sc-border)]">
        <div className="w-10 h-10 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)]">
          <Icon size={18} />
        </div>
        <div>
          <div className="font-extrabold text-[color:var(--sc-ink)]">
            {role === "vendor" ? "Vendor onboarding T&C" : "Service Provider onboarding T&C"}
          </div>
          <div className="text-[11px] text-[color:var(--sc-ink-muted)]">
            Shown on the {role === "vendor" ? "/become-vendor" : "/become-provider"} page. Applicants must accept before submitting.
          </div>
        </div>
      </div>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Title</span>
        <input className="sc-input mt-1" value={value.title} onChange={set("title")} data-testid={`ot-${role}-title`} />
      </label>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Intro paragraph</span>
        <textarea className="sc-input mt-1 min-h-[64px] text-sm" value={value.intro} onChange={set("intro")} data-testid={`ot-${role}-intro`} />
      </label>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-2">Numbered clauses</div>
        <ClauseList clauses={value.clauses || []} onChange={clauseSet} testIdRoot={`ot-${role}`} />
      </div>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Declaration heading</span>
        <input className="sc-input mt-1" value={value.declaration_heading} onChange={set("declaration_heading")} data-testid={`ot-${role}-declare-heading`} />
      </label>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Declaration body</span>
        <textarea className="sc-input mt-1 min-h-[100px] text-sm" value={value.declaration_body} onChange={set("declaration_body")} data-testid={`ot-${role}-declare-body`} />
      </label>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">&ldquo;I Agree&rdquo; checkbox label</span>
        <input className="sc-input mt-1" value={value.agree_label} onChange={set("agree_label")} data-testid={`ot-${role}-agree-label`} />
      </label>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */
export default function AdminOnboardingTerms() {
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [loaded, setLoaded] = useState(false);
  const [savingLocal, setSavingLocal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState({ tone: "", text: "" });

  useEffect(() => {
    let alive = true;
    loadTerms().then((t) => { if (alive) { setTerms(t); setLoaded(true); } });
    return () => { alive = false; };
  }, []);

  const setRole = (role) => (patch) => setTerms((t) => ({ ...t, [role]: patch }));

  const saveLocal = () => {
    setSavingLocal(true); setMsg({});
    try {
      saveTermsLocal(terms);
      setMsg({ tone: "ok", text: "Saved locally in your browser. Applicants on other devices won't see this until you publish." });
    } finally {
      setSavingLocal(false);
    }
  };

  const publish = async () => {
    setPublishing(true); setMsg({});
    // Always save locally so admin's own preview is consistent.
    saveTermsLocal(terms);
    const res = await publishTerms(terms);
    setPublishing(false);
    if (res.ok) {
      setMsg({ tone: "ok", text: "Published! All applicants will see this version." });
    } else {
      setMsg({
        tone: "warn",
        text: `Local save succeeded, but publish failed: ${res.error}. Backend team needs to accept an "onboarding_terms" key on /admin/settings — see spec in /app/memory/.`,
      });
    }
  };

  const resetDefaults = () => {
    if (!window.confirm("Restore both T&Cs to the factory defaults (04-Jul-2026 wording)?")) return;
    resetTermsLocal();
    setTerms(DEFAULT_TERMS);
    setMsg({ tone: "ok", text: "Restored default wording. Click Publish to push it live for everyone." });
  };

  if (!loaded) {
    return (
      <Layout title="Onboarding T&C">
        <div className="sc-card p-10 text-center">
          <Loader2 className="animate-spin mx-auto text-[color:var(--sc-primary)]" size={22} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Onboarding T&C">
      <div className="mb-4 sc-card p-4 flex flex-wrap items-center justify-between gap-3" data-testid="ot-toolbar">
        <div>
          <div className="font-extrabold text-[color:var(--sc-ink)] flex items-center gap-2">
            <FileText size={18} className="text-[color:var(--sc-primary)]" /> Onboarding Terms & Conditions
          </div>
          <div className="text-xs text-[color:var(--sc-ink-muted)] mt-0.5">
            Shown at Vendor / Service-Provider onboarding · Version <b>{terms.version || "1.0.0"}</b> · Last updated {terms.updated_at || "—"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={resetDefaults}
            className="sc-btn-outline inline-flex items-center gap-1.5"
            data-testid="ot-reset">
            <RotateCcw size={14} /> Reset to defaults
          </button>
          <button onClick={saveLocal} disabled={savingLocal}
            className="sc-btn-outline inline-flex items-center gap-1.5 disabled:opacity-60"
            data-testid="ot-save-local">
            {savingLocal ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save (my browser)
          </button>
          <button onClick={publish} disabled={publishing}
            className="sc-btn-primary inline-flex items-center gap-1.5 disabled:opacity-60"
            data-testid="ot-publish">
            {publishing ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Publish live
          </button>
        </div>
      </div>

      {msg?.text && (
        <div
          className={
            "sc-card p-3 mb-4 text-sm font-semibold flex items-start gap-2 " +
            (msg.tone === "ok" ? "text-[color:var(--sc-primary)]" : "text-amber-700")
          }
          data-testid="ot-msg"
        >
          {msg.tone === "ok" ? <CheckCircle2 size={16} className="mt-0.5" /> : <AlertTriangle size={16} className="mt-0.5" />}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <RoleEditor
          role="vendor"
          value={terms.vendor}
          onChange={setRole("vendor")}
          icon={Store}
        />
        <RoleEditor
          role="service_provider"
          value={terms.service_provider}
          onChange={setRole("service_provider")}
          icon={Wrench}
        />
      </div>

      <div className="mt-4 text-[11px] text-[color:var(--sc-ink-muted)] italic">
        Tip: When you materially change the wording, applicants who already accepted the old version keep their acceptance record;
        new applicants must accept the latest text. Bump the <b>version</b> in <code>src/lib/onboardingTerms.js</code> if you need
        to force-re-accept everyone (backend hook TBD).
      </div>
    </Layout>
  );
}
