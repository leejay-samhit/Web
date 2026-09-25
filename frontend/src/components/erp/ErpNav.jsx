import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, Lock, Sparkles, UserCog, KeyRound, GraduationCap,
} from "lucide-react";

const ITEMS = [
  { to: "/vendor/erp",                  label: "GST Hub",           icon: LayoutDashboard,  end: true },
  { to: "/vendor/erp/purchase-book",    label: "Purchase Book",     icon: BookOpen,        lock: true },
  { to: "/vendor/erp/gst-assistant",    label: "Smart GST",         icon: Sparkles,        lock: true },
  { to: "/vendor/erp/roles",            label: "Roles & Staff",     icon: UserCog,         lock: true },
  { to: "/vendor/erp/security",         label: "Owner Settings",    icon: KeyRound,        lock: true },
  { to: "/vendor/erp/learn",            label: "Learn",             icon: GraduationCap },
];

export default function ErpNav() {
  return (
    <div className="sc-card p-2 mb-4 flex items-center gap-1 overflow-x-auto" data-testid="erp-nav">
      {ITEMS.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          data-testid={`erp-nav-${it.to.split("/").pop()}`}
          className={({ isActive }) =>
            `shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
              isActive
                ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]"
                : "bg-white border-[color:var(--sc-border)] text-[color:var(--sc-ink)] hover:bg-[color:var(--sc-accent-light)]/40"
            }`
          }
        >
          <it.icon size={12} /> {it.label}
          {it.lock && <Lock size={9} className="opacity-60" />}
        </NavLink>
      ))}
    </div>
  );
}
