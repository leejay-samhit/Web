import { useEffect, useLayoutEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronLeft, X, Sparkles, Check } from "lucide-react";

// Ordered tour steps — takes ~3 minutes end-to-end.
const STEPS = [
  {
    route: "/vendor/erp",
    selector: '[data-testid="erp-tile-products"]',
    title: "1. Product Master",
    body: "This is where every product lives. Add / edit / import products in bulk. Cashiers only read from here — pricing edits need the owner.",
    minutes: "45s",
  },
  {
    route: "/vendor/erp/billing",
    selector: '[data-testid="billing-open-pos"]',
    title: "2. Create a bill (POS)",
    body: "Tap here to open the Point of Sale. Scan a barcode or search a product, add to cart, take payment. Stock, sales, GST and profit all update the moment you finalise the bill — no manual refresh.",
    minutes: "1 min",
  },
  {
    route: "/vendor/erp/inventory",
    selector: '[data-testid="inv-current"]',
    title: "3. Stock check",
    body: "Live count of what's on your shelf right now. Watch the red 'Low stock' and 'Out of stock' cards — those are the products you should re-order today.",
    minutes: "30s",
  },
  {
    route: "/vendor/erp/reports",
    selector: '[data-testid="report-generate"]',
    title: "4. Daily close",
    body: "Pick the Sales report + range 'Today' and hit Generate. That's your day-end tally — sales, GST collected, profit. Export to PDF/Excel or Print for your records.",
    minutes: "40s",
  },
  {
    route: "/vendor/erp",
    selector: '[data-testid="erp-tile-learn"]',
    title: "You're set!",
    body: "Bookmark the Learning Center for plain-English answers on GST, ITC and profit anytime you need them. Tap the Sparkles icon in the header to replay this tour.",
    minutes: "done",
  },
];

// (Onboarding lifecycle — running/start/close/restart — is owned by
// TourProvider in @/context/TourContext.jsx so the overlay survives route
// changes between /vendor/erp/* screens.)

/**
 * Overlay tour that navigates the user through key ERP screens.
 * A dark scrim + spotlight highlights the target element and a floating
 * card explains what to do.
 */
export default function OnboardingTour({ running, onClose }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const navigate = useNavigate();

  // Reset to the first step each time the tour opens.
  useEffect(() => {
    if (running) setStep(0);
  }, [running]);

  // Navigate to the route for the current step whenever it changes.
  useEffect(() => {
    if (!running) return;
    navigate(STEPS[step].route);
  }, [step, running, navigate]);

  // Poll for the target element, since the route change is async.
  useLayoutEffect(() => {
    if (!running) return;
    let cancelled = false;
    const findTarget = () => {
      const el = document.querySelector(STEPS[step].selector);
      if (el) {
        const r = el.getBoundingClientRect();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (!cancelled) setRect({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height });
      } else if (!cancelled) {
        setTimeout(findTarget, 250);
      }
    };
    setRect(null);
    findTarget();
    return () => { cancelled = true; };
  }, [step, running]);

  if (!running) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none" data-testid="onboarding-tour">
      {/* Scrim with a spotlight cut out — 4 overlay boxes around the target rect */}
      {rect && (
        <>
          <div className="absolute bg-black/60 pointer-events-auto" style={{ top: 0, left: 0, right: 0, height: rect.top - 8 }} />
          <div className="absolute bg-black/60 pointer-events-auto" style={{ top: rect.top + rect.height + 8, left: 0, right: 0, bottom: 0 }} />
          <div className="absolute bg-black/60 pointer-events-auto" style={{ top: rect.top - 8, height: rect.height + 16, left: 0, width: rect.left - 8 }} />
          <div className="absolute bg-black/60 pointer-events-auto" style={{ top: rect.top - 8, height: rect.height + 16, left: rect.left + rect.width + 8, right: 0 }} />
          {/* Ring around target */}
          <div
            className="absolute rounded-2xl ring-4 ring-[color:var(--sc-primary)] pointer-events-none animate-pulse"
            style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
          />
        </>
      )}

      {/* Floating card */}
      <div
        className="absolute pointer-events-auto max-w-sm w-[min(92vw,22rem)] left-1/2 -translate-x-1/2 top-[70vh] sc-card p-4 shadow-2xl bg-white border border-[color:var(--sc-border)]"
        data-testid="tour-card"
        style={rect ? { top: `min(${rect.top + rect.height + 24}px, calc(100vh - 220px))` } : {}}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[color:var(--sc-primary)]">
            <Sparkles size={11} className="inline mr-1" />
            Cashier tour · Step {step + 1} of {STEPS.length}
          </div>
          <button onClick={onClose} data-testid="tour-close"><X size={16} /></button>
        </div>
        <div className="font-extrabold text-base mt-1">{s.title}</div>
        <div className="text-sm text-[color:var(--sc-ink-muted)] mt-1 leading-relaxed">{s.body}</div>
        <div className="text-[10px] text-[color:var(--sc-ink-muted)] mt-2">~{s.minutes}</div>

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => setStep((v) => Math.max(0, v - 1))}
            disabled={step === 0}
            className="text-xs font-semibold inline-flex items-center gap-1 text-[color:var(--sc-ink-muted)] disabled:opacity-30"
            data-testid="tour-prev"
          >
            <ChevronLeft size={14} /> Back
          </button>
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? "bg-[color:var(--sc-primary)]" : "bg-[color:var(--sc-border)]"}`} />
            ))}
          </div>
          {isLast ? (
            <button
              onClick={onClose}
              className="text-xs font-semibold inline-flex items-center gap-1 bg-[color:var(--sc-primary)] text-white rounded-full px-3 py-1.5"
              data-testid="tour-finish"
            >
              <Check size={14} /> Done
            </button>
          ) : (
            <button
              onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))}
              className="text-xs font-semibold inline-flex items-center gap-1 bg-[color:var(--sc-primary)] text-white rounded-full px-3 py-1.5"
              data-testid="tour-next"
            >
              Next <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
