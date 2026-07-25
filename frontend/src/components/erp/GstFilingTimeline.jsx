import { useEffect, useMemo, useState } from "react";
import { gstTimeline, paiseToRupees } from "@/lib/erp";
import { formatINR } from "@/lib/utils";
import { CheckCircle2, Clock, AlertTriangle, Calendar as CalendarIcon, Info } from "lucide-react";

/**
 * Month-by-month GST filing timeline.
 * Statuses (per month):
 *  - FILED     — green   ✓
 *  - DUE       — amber   ⏱  (this month, before due day)
 *  - OVERDUE   — red     ⚠
 *  - UPCOMING  — grey    ○
 *
 * When the backend endpoint /api/erp/gst/timeline is unavailable, we
 * synthesise a 12-month sample so the UI still looks meaningful in preview.
 */
export default function GstFilingTimeline({ ownerPassword }) {
  const [data, setData] = useState(null);
  const [year, setYear] = useState(() => {
    const d = new Date();
    return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; // FY start
  });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await gstTimeline({ year }, ownerPassword);
      if (d?.months?.length) setData(d);
      else { setPending(true); setData(sampleTimeline(year)); }
    })();
  }, [year, ownerPassword]);

  const months = useMemo(() => data?.months || [], [data]);
  const totals = useMemo(() => months.reduce((acc, m) => {
    acc.filed   += m.status === "FILED"    ? 1 : 0;
    acc.due     += m.status === "DUE"      ? 1 : 0;
    acc.overdue += m.status === "OVERDUE"  ? 1 : 0;
    acc.upcoming+= m.status === "UPCOMING" ? 1 : 0;
    acc.lateFee_paise += m.lateFee_paise || 0;
    return acc;
  }, { filed: 0, due: 0, overdue: 0, upcoming: 0, lateFee_paise: 0 }), [months]);

  return (
    <div className="sc-card p-4 mt-4" data-testid="gst-filing-timeline">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <CalendarIcon size={16} className="text-[color:var(--sc-primary)]" />
        <div className="font-extrabold text-sm">GST filing timeline</div>
        <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Financial year</div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border border-[color:var(--sc-border)] px-2 py-1 text-xs" data-testid="timeline-year">
          {[year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>FY {y}-{String(y + 1).slice(2)}</option>
          ))}
        </select>
        {pending && <span className="text-[10px] uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full ml-auto">preview</span>}
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        <Chip color="emerald" icon={CheckCircle2} label="Filed"    value={totals.filed}    testId="timeline-filed" />
        <Chip color="amber"   icon={Clock}         label="Due"      value={totals.due}      testId="timeline-due" />
        <Chip color="red"     icon={AlertTriangle} label="Overdue"  value={totals.overdue}  testId="timeline-overdue" />
        <Chip color="slate"   icon={CalendarIcon}  label="Upcoming" value={totals.upcoming} testId="timeline-upcoming" />
        <Chip color="red"     icon={AlertTriangle} label="Late fee (est.)" value={formatINR(paiseToRupees(totals.lateFee_paise))} testId="timeline-latefee" />
      </div>

      {/* Timeline horizontal rail */}
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[720px] grid grid-cols-12 gap-2">
          {months.map((m) => <MonthCell key={m.month} m={m} />)}
        </div>
      </div>

      <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-3 inline-flex items-center gap-1">
        <Info size={11} /> Late-fee estimates use Super Admin's configured daily rate and current pending amount. Verify with your CA before paying.
      </div>
    </div>
  );
}

function Chip({ color, icon: Icon, label, value, testId }) {
  const bg = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    amber:   "bg-amber-50 border-amber-200 text-amber-900",
    red:     "bg-red-50 border-red-200 text-red-800",
    slate:   "bg-slate-50 border-slate-200 text-slate-700",
  }[color];
  return (
    <div className={`rounded-xl border px-3 py-2 ${bg}`} data-testid={testId}>
      <div className="text-[10px] uppercase tracking-wider font-semibold inline-flex items-center gap-1"><Icon size={11} /> {label}</div>
      <div className="text-lg font-extrabold mt-0.5">{value}</div>
    </div>
  );
}

function MonthCell({ m }) {
  const styles = {
    FILED:    { bg: "bg-emerald-100 border-emerald-300 text-emerald-900", dot: "bg-emerald-500" },
    DUE:      { bg: "bg-amber-100 border-amber-300 text-amber-900",       dot: "bg-amber-500" },
    OVERDUE:  { bg: "bg-red-100 border-red-300 text-red-900",             dot: "bg-red-500" },
    UPCOMING: { bg: "bg-slate-50 border-slate-200 text-slate-700",        dot: "bg-slate-300" },
  }[m.status] || { bg: "bg-slate-50 border-slate-200 text-slate-500", dot: "bg-slate-300" };

  const label = new Date(m.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  return (
    <div className={`rounded-xl border p-2 ${styles.bg}`} data-testid={`timeline-month-${m.month}`}>
      <div className="flex items-center gap-1.5">
        <span className={`inline-block w-2 h-2 rounded-full ${styles.dot}`} />
        <div className="text-[11px] font-extrabold">{label}</div>
      </div>
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80 mt-1">{m.status}</div>
      {m.gstPayable_paise != null && <div className="text-[11px] font-semibold mt-0.5">{formatINR(paiseToRupees(m.gstPayable_paise))}</div>}
      {m.status === "DUE" && m.daysToDue != null && <div className="text-[10px] mt-0.5">Due in {m.daysToDue}d</div>}
      {m.status === "OVERDUE" && m.daysLate != null && <div className="text-[10px] mt-0.5">{m.daysLate}d late</div>}
      {m.status === "FILED" && m.filedAt && <div className="text-[10px] mt-0.5">Filed {new Date(m.filedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>}
    </div>
  );
}

// Build 12 realistic-looking months for FY (Apr → Mar) when backend is offline.
function sampleTimeline(year) {
  const dueDay = 20;
  const today = new Date();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const monthIdx = (3 + i) % 12; // Apr = 3
    const y = i + 3 < 12 ? year : year + 1;
    const monthKey = `${y}-${String(monthIdx + 1).padStart(2, "0")}`;
    const dueDate = new Date(y, monthIdx + 1, dueDay); // GSTR-3B due 20th of next month
    let status = "UPCOMING";
    let daysToDue, daysLate;
    if (dueDate < today) {
      // Older months: mostly filed, a couple overdue near the current month to
      // demonstrate all four states in preview mode.
      const monthsAgo = Math.round((today - dueDate) / (30 * 86400000));
      status = monthsAgo <= 2 ? "OVERDUE" : "FILED";
      if (status === "OVERDUE") daysLate = Math.round((today - dueDate) / 86400000);
    } else {
      // Nearest upcoming month becomes DUE so the preview shows the amber state.
      const daysToDueRaw = Math.round((dueDate - today) / 86400000);
      if (daysToDueRaw <= 45) { status = "DUE"; daysToDue = daysToDueRaw; }
    }
    months.push({
      month: monthKey,
      status,
      gstPayable_paise: status === "UPCOMING" ? null : Math.round((10000 + Math.random() * 30000) * 100),
      daysToDue,
      daysLate,
      lateFee_paise: status === "OVERDUE" ? Math.round(50 * (daysLate || 0) * 100) : 0,
      filedAt: status === "FILED" ? new Date(y, monthIdx + 1, Math.min(dueDay, 15 + Math.floor(Math.random() * 6))).toISOString() : null,
    });
  }
  return { months };
}
