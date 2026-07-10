import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ShieldAlert, ChevronDown, FileText } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  One numbered clause row — extracted so React can memoise per-item.        */
/* -------------------------------------------------------------------------- */
function TermItem({ index, text, testId }) {
  return (
    <li data-testid={testId}>{text}</li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Header strip (title + subtitle)                                            */
/* -------------------------------------------------------------------------- */
function TermsHeader({ title }) {
  return (
    <div className="px-4 py-3 border-b border-[color:var(--sc-border)] bg-[color:var(--sc-accent-light)] flex items-start gap-2">
      <FileText size={16} className="mt-0.5 text-[color:var(--sc-primary)] shrink-0" />
      <div className="min-w-0">
        <div className="font-extrabold text-[color:var(--sc-ink)] text-sm">{title}</div>
        <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-0.5">
          Please read carefully — you must accept before continuing.
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Declaration callout at the bottom of the scroll area                       */
/* -------------------------------------------------------------------------- */
function DeclarationCallout({ heading, body }) {
  return (
    <div className="rounded-lg border border-dashed border-[color:var(--sc-border)] bg-[color:var(--sc-accent-light)]/50 p-3">
      <div className="font-extrabold text-[color:var(--sc-ink)] text-[13px] flex items-center gap-1.5">
        <ShieldAlert size={13} className="text-[color:var(--sc-primary)]" />
        {heading || "Declaration"}
      </div>
      <p className="mt-1 text-[12.5px] text-[color:var(--sc-ink)] leading-relaxed">{body}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  useScrollToBottom — tracks whether a scroll container has been fully read  */
/* -------------------------------------------------------------------------- */
function useScrollToBottom(ref, resetKey) {
  const [reached, setReached] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setReached(false);
    const check = () => {
      const noScrollNeeded = el.scrollHeight - el.clientHeight <= 4;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
      if (noScrollNeeded || atBottom) setReached(true);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [ref, resetKey]);
  return reached;
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */
export default function TermsAcceptancePanel({ terms, accepted, onChange, disabled, testIdRoot = "terms" }) {
  const scrollRef = useRef(null);
  const scrolledEnough = useScrollToBottom(scrollRef, terms);

  if (!terms) return null;

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const clauses = terms.clauses || [];

  return (
    <div
      className="rounded-2xl border border-[color:var(--sc-border)] bg-white overflow-hidden"
      data-testid={testIdRoot}
    >
      <TermsHeader title={terms.title} />

      <div
        ref={scrollRef}
        className="px-4 py-3 max-h-72 overflow-y-auto text-[13px] leading-relaxed text-[color:var(--sc-ink)] space-y-3"
        data-testid={`${testIdRoot}-scroll`}
      >
        <p>{terms.intro}</p>
        <ol className="list-decimal pl-5 space-y-1.5 marker:font-bold marker:text-[color:var(--sc-primary)]">
          {clauses.map((c, i) => (
            // Content-based key — safe because clauses are unique legal text and
            // rarely edited in-page (only via the admin CMS which fully remounts).
            <TermItem
              key={`${i + 1}-${c.slice(0, 32)}`}
              index={i}
              text={c}
              testId={`${testIdRoot}-clause-${i + 1}`}
            />
          ))}
        </ol>
        <DeclarationCallout
          heading={terms.declaration_heading}
          body={terms.declaration_body}
        />
      </div>

      {!scrolledEnough && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="w-full text-[11px] font-semibold text-[color:var(--sc-primary)] hover:bg-[color:var(--sc-accent-light)] py-1.5 border-t border-[color:var(--sc-border)] flex items-center justify-center gap-1"
          data-testid={`${testIdRoot}-scroll-hint`}
        >
          <ChevronDown size={12} /> Scroll to bottom to enable the &ldquo;I Agree&rdquo; checkbox
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
          {terms.agree_label || "I have read, understood and agree to the above."}
        </span>
        {accepted && <CheckCircle2 size={16} className="text-[color:var(--sc-primary)] mt-0.5 shrink-0" />}
      </label>
    </div>
  );
}
