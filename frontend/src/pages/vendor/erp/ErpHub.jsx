import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import { useTour } from "@/context/TourContext";
import {
  BookOpen, Lock, Sparkles, UserCog, KeyRound,
  GraduationCap, Rocket, PlayCircle,
} from "lucide-react";

const TILES = [
  { to: "/vendor/erp/purchase-book",    label: "Purchase Book",    icon: BookOpen,       color: "from-sky-50 ring-sky-200 text-sky-800",             desc: "Supplier invoices, GST, purchase history", lock: true },
  { to: "/vendor/erp/gst-assistant",    label: "Smart GST Assistant", icon: Sparkles,    color: "from-amber-50 ring-amber-200 text-amber-800",       desc: "Plain-English GST summary", lock: true },
  { to: "/vendor/erp/roles",            label: "Roles & Staff",    icon: UserCog,        color: "from-slate-50 ring-slate-200 text-slate-800",       desc: "Owner / Manager / Cashier / Staff", lock: true },
  { to: "/vendor/erp/security",         label: "Owner Security",   icon: KeyRound,       color: "from-amber-50 ring-amber-200 text-amber-800",       desc: "Password, PIN, biometrics, auto-lock", lock: true },
  { to: "/vendor/erp/learn",            label: "Learning Center",  icon: GraduationCap,  color: "from-emerald-50 ring-emerald-200 text-emerald-800", desc: "GST, profit, ITC — in plain English" },
];

export default function ErpHub() {
  const tour = useTour();
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
            <div className="flex-1">
              <div className="text-lg sm:text-xl font-extrabold">GST and Tax Return — Slangcart Vendor Suite</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)] mt-1 max-w-2xl">
                Purchase, sales and GST — one dashboard for kirana, medical, hardware, mobile & fashion outlets. All amounts in ₹. Fully synced across mobile, web and admin.
              </div>
            </div>
            <button
              onClick={tour.restart}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 bg-white border border-[color:var(--sc-primary)]/40 text-[color:var(--sc-primary)] text-xs font-semibold hover:bg-[color:var(--sc-primary)]/10"
              data-testid="tour-start-btn"
            >
              <PlayCircle size={14} /> 3-min tour
            </button>
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
