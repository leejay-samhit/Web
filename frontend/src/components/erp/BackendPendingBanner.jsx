import { AlertTriangle } from "lucide-react";

/**
 * Renders a friendly banner when a page depends on a backend endpoint that
 * hasn't been shipped yet. The UI still works via localStorage fallback.
 */
export default function BackendPendingBanner({ endpoint, note }) {
  return (
    <div
      className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 mb-4 flex items-start gap-3 text-sm"
      data-testid="backend-pending-banner"
    >
      <AlertTriangle size={16} className="mt-[2px] shrink-0" />
      <div>
        <div className="font-semibold">Preview mode</div>
        <div className="text-xs mt-0.5">
          This screen is running on local data until <code className="px-1 py-0.5 rounded bg-white/60">{endpoint}</code> ships. {note}
        </div>
      </div>
    </div>
  );
}
