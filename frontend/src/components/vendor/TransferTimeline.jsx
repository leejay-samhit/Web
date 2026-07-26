import { Clock, CheckCircle2, XCircle, Eye, PlusCircle } from "lucide-react";

const KIND_STYLES = {
  created:   { icon: PlusCircle,   color: "text-sky-600",     bg: "bg-sky-50 border-sky-200",       label: "Created" },
  seen:      { icon: Eye,          color: "text-slate-600",   bg: "bg-slate-50 border-slate-200",   label: "Seen" },
  accepted:  { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", label: "Accepted" },
  cancelled: { icon: XCircle,      color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",   label: "Cancelled" },
  rejected:  { icon: XCircle,      color: "text-red-600",     bg: "bg-red-50 border-red-200",       label: "Rejected" },
};

function fmt(ts) {
  try { return new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

/**
 * Compact timeline rendered inline under a transfer row.
 * Each event shows an icon, actor and timestamp.
 */
export default function TransferTimeline({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="text-[11px] text-[color:var(--sc-ink-muted)] px-3 py-2">
        <Clock size={11} className="inline mr-1" /> Waiting for the first event…
      </div>
    );
  }
  return (
    <ol className="flex flex-wrap gap-2 px-3 py-2" data-testid="transfer-timeline">
      {events.map((e, i) => {
        const style = KIND_STYLES[e.kind] || KIND_STYLES.created;
        const Icon = style.icon;
        return (
          <li key={`${e.kind}-${i}`} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${style.bg}`} data-testid={`timeline-${e.kind}`}>
            <Icon size={11} className={style.color} />
            <span className="font-semibold">{style.label}</span>
            <span className="text-[color:var(--sc-ink-muted)]">·</span>
            <span className="text-[color:var(--sc-ink-muted)]">{fmt(e.at)}</span>
            {e.actor_name || e.actor_email ? (
              <>
                <span className="text-[color:var(--sc-ink-muted)]">·</span>
                <span title={e.actor_email}>{e.actor_name || e.actor_email}</span>
              </>
            ) : null}
            {e.detail ? (
              <>
                <span className="text-[color:var(--sc-ink-muted)]">·</span>
                <span className="text-[color:var(--sc-ink-muted)] italic">{e.detail}</span>
              </>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
