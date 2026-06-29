import { NavLink } from "react-router-dom";
import { Store, Package, Receipt, IndianRupee, FileSpreadsheet, BarChart3, Settings as SettingsIcon, TrendingUp } from "lucide-react";

const ITEMS = [
  { to: "/vendor",            label: "Products",        icon: Package },
  { to: "/vendor/sales",      label: "Sales dashboard", icon: TrendingUp },
  { to: "/vendor/pos",        label: "Billing (POS)",   icon: Receipt },
  { to: "/vendor/invoices",   label: "Invoices",        icon: FileSpreadsheet },
  { to: "/vendor/cash",       label: "Cash summary",    icon: IndianRupee },
  { to: "/vendor/analytics",  label: "Analytics",       icon: BarChart3 },
  { to: "/vendor/settings",   label: "Shop settings",   icon: SettingsIcon },
];

export default function VendorNav() {
  return (
    <div className="sc-card p-2 mb-4 flex items-center gap-1 overflow-x-auto" data-testid="vendor-nav">
      <div className="hidden sm:flex items-center gap-1.5 px-2 text-[color:var(--sc-primary)] font-extrabold text-sm">
        <Store size={14} /> My shop
      </div>
      {ITEMS.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.to === "/vendor"}
          data-testid={`vnav-${it.to.split("/").pop() || "products"}`}
          className={({ isActive }) =>
            `shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition ${isActive ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)] text-[color:var(--sc-ink)] hover:bg-[color:var(--sc-accent-light)]/40"}`
          }
        >
          <it.icon size={12} /> {it.label}
        </NavLink>
      ))}
    </div>
  );
}
