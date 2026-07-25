import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import {
  Package, BookOpen, Boxes, Receipt, Lock, Wallet as WalletIcon,
  TrendingUp, Percent, Sparkles, Building2, ShieldAlert, BellRing,
  FileBarChart, LineChart, Search, UserCog, ScrollText, KeyRound,
  GraduationCap, Rocket,
} from "lucide-react";

const TILES = [
  { to: "/vendor/erp/products",         label: "Product Master",   icon: Package,        color: "from-emerald-50 ring-emerald-200 text-emerald-800", desc: "Full product info, HSN, batch, stock alerts" },
  { to: "/vendor/erp/purchase-book",    label: "Purchase Book",    icon: BookOpen,       color: "from-sky-50 ring-sky-200 text-sky-800",             desc: "Supplier invoices, GST, purchase history", lock: true },
  { to: "/vendor/erp/inventory",        label: "Inventory",        icon: Boxes,          color: "from-emerald-50 ring-emerald-200 text-emerald-800", desc: "Live stock, low-stock alerts, dead stock" },
  { to: "/vendor/erp/billing",          label: "Billing",          icon: Receipt,        color: "from-sky-50 ring-sky-200 text-sky-800",             desc: "Auto-sync sales, stock, GST, profit" },
  { to: "/vendor/erp/price-lock",       label: "Price Lock",       icon: Lock,           color: "from-amber-50 ring-amber-200 text-amber-800",       desc: "Only owner can change price / cost", lock: true },
  { to: "/vendor/erp/accounts",         label: "Accounts Dashboard", icon: WalletIcon,   color: "from-emerald-50 ring-emerald-200 text-emerald-800", desc: "Today / month / lifetime business", lock: true },
  { to: "/vendor/erp/profit",           label: "Profit Dashboard", icon: TrendingUp,     color: "from-emerald-50 ring-emerald-200 text-emerald-800", desc: "Gross, net, best & worst performers", lock: true },
  { to: "/vendor/erp/gst",              label: "GST Dashboard",    icon: Percent,        color: "from-amber-50 ring-amber-200 text-amber-800",       desc: "Input, output, payable, filing status", lock: true },
  { to: "/vendor/erp/gst-assistant",    label: "Smart GST Assistant", icon: Sparkles,    color: "from-amber-50 ring-amber-200 text-amber-800",       desc: "Plain-English GST summary", lock: true },
  { to: "/vendor/erp/business-profile", label: "Business Profile", icon: Building2,      color: "from-slate-50 ring-slate-200 text-slate-800",       desc: "Business type, PAN, GSTIN, scheme" },
  { to: "/vendor/erp/compliance",       label: "Compliance",       icon: ShieldAlert,    color: "from-amber-50 ring-amber-200 text-amber-800",       desc: "Turnover-based guidance & thresholds" },
  { to: "/vendor/erp/reminders",        label: "Return Reminders", icon: BellRing,       color: "from-red-50 ring-red-200 text-red-800",             desc: "GST returns, low stock, missing bills" },
  { to: "/vendor/erp/income-tax",       label: "Income Tax",       icon: FileBarChart,   color: "from-slate-50 ring-slate-200 text-slate-800",       desc: "Estimated business income & tax", lock: true },
  { to: "/vendor/erp/financial-health", label: "Financial Health", icon: LineChart,      color: "from-emerald-50 ring-emerald-200 text-emerald-800", desc: "Growth, margins, cash mix, outstanding", lock: true },
  { to: "/vendor/erp/reports",          label: "Reports",          icon: FileBarChart,   color: "from-sky-50 ring-sky-200 text-sky-800",             desc: "Purchase, sales, profit, GST — PDF/Excel", lock: true },
  { to: "/vendor/erp/search",           label: "Smart Search",     icon: Search,         color: "from-slate-50 ring-slate-200 text-slate-800",       desc: "Product, barcode, supplier, GSTIN" },
  { to: "/vendor/erp/roles",            label: "Roles & Staff",    icon: UserCog,        color: "from-slate-50 ring-slate-200 text-slate-800",       desc: "Owner / Manager / Cashier / Staff", lock: true },
  { to: "/vendor/erp/audit",            label: "Audit Log",        icon: ScrollText,     color: "from-slate-50 ring-slate-200 text-slate-800",       desc: "Every price / stock / permission change", lock: true },
  { to: "/vendor/erp/security",         label: "Owner Security",   icon: KeyRound,       color: "from-amber-50 ring-amber-200 text-amber-800",       desc: "Password, PIN, biometrics, auto-lock", lock: true },
  { to: "/vendor/erp/learn",            label: "Learning Center",  icon: GraduationCap,  color: "from-emerald-50 ring-emerald-200 text-emerald-800", desc: "GST, profit, ITC — in plain English" },
];

export default function ErpHub() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6" data-testid="erp-hub">
        <VendorNav />
        <ErpNav />

        <div className="sc-card p-5 mb-5 bg-gradient-to-r from-[color:var(--sc-primary)]/10 to-white ring-1 ring-[color:var(--sc-primary)]/20">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[color:var(--sc-primary)] text-white grid place-items-center">
              <Rocket size={20} />
            </div>
            <div>
              <div className="text-lg sm:text-xl font-extrabold">Slangcart Vendor Billing 3.0 — ERP Suite</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)] mt-1 max-w-2xl">
                A retailer-first ERP for kirana stores, medical shops, hardware, mobile & fashion outlets, restaurants, bakeries, wholesalers and distributors. All amounts in ₹. Fully synced across mobile, web and admin.
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TILES.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              data-testid={`erp-tile-${t.to.split("/").pop()}`}
              className={`sc-card p-4 hover:shadow-lg transition bg-gradient-to-br ring-1 ${t.color}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white grid place-items-center border border-[color:var(--sc-border)]">
                  <t.icon size={18} />
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-sm flex items-center gap-1.5">
                    {t.label}
                    {t.lock && <Lock size={11} className="opacity-70" />}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5">{t.desc}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
