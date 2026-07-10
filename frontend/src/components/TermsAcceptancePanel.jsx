import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ShieldAlert, ChevronDown, FileText } from "lucide-react";

/**
 * Long-form legal text card with an "I Agree" checkbox that stays disabled
 * until the applicant scrolls to the bottom of the T&C. Reused on the
 * Become-a-vendor and Become-a-service-provider flows.
 *
 * Props:
 *   terms       — object from onboardingTerms.js (title, intro, clauses[],
 *                  declaration_heading, declaration_body, agree_label)
 *   accepted    — boolean, controlled by parent
 *   onChange    — (bool) => void
 *   disabled    — hard-disables the checkbox (e.g. during submit)
 *   testIdRoot  — prefix for the `data-testid` attributes (e.g. "bv-terms")
 */
export default function TermsAcceptancePanel({ terms, accepted, onChange, disabled, testIdRoot = "terms" }) {
  const scrollRef = useRef(null);
  // We only unlock the checkbox once the applicant has scrolled through the
  // long-form text (or the content fits without scroll). Keeps consent
  // meaningful and defensible in an audit.
  const [scrolledEnough, setScrolledEnough] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      // If the block fits in view already, no scroll required.
      const noScrollNeeded = el.scrollHeight - el.clientHeight <= 4;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
      if (noScrollNeeded || atBottom) setScrolledEnough(true);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [terms]);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  if (!terms) return null;

  return (
    <div
      className="rounded-2xl border border-[color:var(--sc-border)] bg-white overflow-hidden"
      data-testid={testIdRoot}
    >
      <div className="px-4 py-3 border-b border-[color:var(--sc-border)] bg-[color:var(--sc-accent-light)] flex items-start gap-2">
        <FileText size={16} className="mt-0.5 text-[color:var(--sc-primary)] shrink-0" />
        <div className="min-w-0">
          <div className="font-extrabold text-[color:var(--sc-ink)] text-sm">{terms.title}</div>
          <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-0.5">
            Please read carefully — you must accept before continuing.
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="px-4 py-3 max-h-72 overflow-y-auto text-[13px] leading-relaxed text-[color:var(--sc-ink)] space-y-3"
        data-testid={`${testIdRoot}-scroll`}
      >
        <p>{terms.intro}</p>
        <ol className="list-decimal pl-5 space-y-1.5 marker:font-bold marker:text-[color:var(--sc-primary)]">
          {(terms.clauses || []).map((c, i) => (
            <li key={i} data-testid={`${testIdRoot}-clause-${i + 1}`}>{c}</li>
          ))}
        </ol>
        <div className="rounded-lg border border-dashed border-[color:var(--sc-border)] bg-[color:var(--sc-accent-light)]/50 p-3">
          <div className="font-extrabold text-[color:var(--sc-ink)] text-[13px] flex items-center gap-1.5">
            <ShieldAlert size={13} className="text-[color:var(--sc-primary)]" />
            {terms.declaration_heading || "Declaration"}
          </div>
          <p className="mt-1 text-[12.5px] text-[color:var(--sc-ink)] leading-relaxed">
            {terms.declaration_body}
          </p>
        </div>
      </div>

      {!scrolledEnough && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="w-full text-[11px] font-semibold text-[color:var(--sc-primary)] hover:bg-[color:var(--sc-accent-light)] py-1.5 border-t border-[color:var(--sc-border)] flex items-center justify-center gap-1"
          data-testid={`${testIdRoot}-scroll-hint`}
        >
          <ChevronDown size={12} /> Scroll to bottom to enable the "I Agree" checkbox
        </button>
      )}

      <label
        className={
          "flex items-start gap-3 px-4 py-3 border-t border-[color:var(--sc-border)] cursor-pointer " +
          (scrolledEnough ? "hover:bg-[color:var(--sc-accent-light)]/40" : "opacity-60 cursor-not-allowed")
        }
      >
        <input
          type="checkbox"
          className="mt-1 w-4 h-4 accent-[color:var(--sc-primary)]"
          data-testid={`${testIdRoot}-agree`}
          checked={!!accepted}
          disabled={disabled || !scrolledEnough}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span className="text-[13px] font-semibold text-[color:var(--sc-ink)] leading-snug flex-1">
          {terms.agree_label || 'I have read, understood and agree to the above.'}
        </span>
        {accepted && <CheckCircle2 size={16} className="text-[color:var(--sc-primary)] mt-0.5 shrink-0" />}
      </label>
    </div>
  );
}
