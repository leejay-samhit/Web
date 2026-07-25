/**
 * Reusable KPI card following Slangcart's color-coded semantics (Module 23):
 *   - green  → sales, profit, stock       (tone="sales" | "profit" | "stock")
 *   - blue   → purchase, orders           (tone="purchase" | "orders")
 *   - orange → gst, taxes                 (tone="gst")
 *   - red    → loss, low stock, oos       (tone="danger")
 *   - default gray                        (tone="default")
 */
const TONES = {
  sales:    { color: "#059669", bg: "from-emerald-50 to-white ring-emerald-200" },
  profit:   { color: "#059669", bg: "from-emerald-50 to-white ring-emerald-200" },
  stock:    { color: "#059669", bg: "from-emerald-50 to-white ring-emerald-200" },
  purchase: { color: "#2563eb", bg: "from-sky-50 to-white ring-sky-200" },
  orders:   { color: "#2563eb", bg: "from-sky-50 to-white ring-sky-200" },
  gst:      { color: "#d97706", bg: "from-amber-50 to-white ring-amber-200" },
  danger:   { color: "#dc2626", bg: "from-red-50 to-white ring-red-200" },
  default:  { color: "var(--sc-primary)", bg: "" },
};

export default function DashboardCard({ icon: Icon, label, value, hint, tone = "default", testId }) {
  const t = TONES[tone] || TONES.default;
  return (
    <div
      className={`sc-card p-4 ${t.bg ? `bg-gradient-to-br ${t.bg} ring-1` : ""}`}
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <div
            className="w-8 h-8 rounded-xl bg-white/70 grid place-items-center border border-[color:var(--sc-border)]"
            style={{ color: t.color }}
          >
            <Icon size={14} />
          </div>
        )}
        <div className="text-[11px] uppercase tracking-wider text-[color:var(--sc-ink-muted)] font-semibold flex-1">
          {label}
        </div>
      </div>
      <div className="text-2xl font-extrabold mt-2" style={{ color: t.color }}>{value}</div>
      {hint && <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-1">{hint}</div>}
    </div>
  );
}
