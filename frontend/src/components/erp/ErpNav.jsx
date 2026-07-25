import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Package, BookOpen, Boxes, Receipt, Lock,
  Wallet as WalletIcon, TrendingUp, Percent, Sparkles, Building2,
  ShieldAlert, BellRing, LineChart, FileBarChart, Search, UserCog,
  ScrollText, KeyRound, GraduationCap,
} from "lucide-react";

const ITEMS = [
  { to: "/vendor/erp",                  label: "ERP Hub",           icon: LayoutDashboard,  end: true },
  { to: "/vendor/erp/products",         label: "Product Master",    icon: Package },
  { to: "/vendor/erp/purchase-book",    label: "Purchase Book",     icon: BookOpen,        lock: true },
  { to: "/vendor/erp/inventory",        label: "Inventory",         icon: Boxes },
  { to: "/vendor/erp/billing",          label: "Billing",           icon: Receipt },
  { to: "/vendor/erp/price-lock",       label: "Price Lock",        icon: Lock,            lock: true },
  { to: "/vendor/erp/accounts",         label: "Accounts",          icon: WalletIcon,      lock: true },
  { to: "/vendor/erp/profit",           label: "Profit",            icon: TrendingUp,      lock: true },
  { to: "/vendor/erp/gst",              label: "GST",               icon: Percent,         lock: true },
  { to: "/vendor/erp/gst-assistant",    label: "Smart GST",         icon: Sparkles,        lock: true },
  { to: "/vendor/erp/business-profile", label: "Business Profile",  icon: Building2 },
  { to: "/vendor/erp/compliance",       label: "Compliance",        icon: ShieldAlert },
  { to: "/vendor/erp/reminders",        label: "Reminders",         icon: BellRing },
  { to: "/vendor/erp/income-tax",       label: "Income Tax",        icon: FileBarChart,    lock: true },
  { to: "/vendor/erp/financial-health", label: "Financial Health",  icon: LineChart,       lock: true },
  { to: "/vendor/erp/reports",          label: "Reports",           icon: FileBarChart,    lock: true },
  { to: "/vendor/erp/search",           label: "Search",            icon: Search },
  { to: "/vendor/erp/roles",            label: "Roles & Staff",     icon: UserCog,         lock: true },
  { to: "/vendor/erp/audit",            label: "Audit Log",         icon: ScrollText,      lock: true },
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
