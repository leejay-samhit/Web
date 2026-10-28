import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getCmsSync, loadCms } from "@/lib/landingCms";
import {
  Menu, X, ArrowRight, Download, Store, ShoppingBag, Wrench, LogIn,
  Zap, ScanLine, Package, Users, BarChart3, FileText, Boxes, UsersRound, Cloud,
  ShoppingCart, Truck, Heart, Percent, Search, MapPin,
  Plug, Droplets, Hammer, Snowflake, Smartphone, Wifi, Sparkles, HardHat, Cctv, Monitor, PaintBucket, Wrench as WrenchAlt,
  Shield, Clock3, CreditCard, Bell, Layers, TrendingUp,
  Phone, Mail, MessageCircle, Send, Instagram, Facebook, Youtube, Twitter,
  Briefcase, GraduationCap, Rocket, Coffee, Award,
  ChevronDown, CheckCircle2,
} from "lucide-react";

/* ---------- Small utility components ------------------------------- */

const SectionTag = ({ children }) => (
  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.14em] bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] border border-[color:var(--sc-primary)]/15">
    <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--sc-primary)]" />
    {children}
  </span>
);

const SectionHeading = ({ eyebrow, title, sub, align = "left" }) => (
  <div className={align === "center" ? "text-center max-w-3xl mx-auto" : "max-w-3xl"}>
      {/* Section-heading vertical margin was originally huge — tightened to
          keep the whole page more scannable while preserving hierarchy. */}
      <SectionTag>{eyebrow}</SectionTag>
      <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[color:var(--sc-ink)] leading-[1.05]">
        {title}
      </h2>
      {sub && (
        <p className="mt-3 text-base sm:text-lg text-[color:var(--sc-ink-muted)] leading-relaxed">
          {sub}
        </p>
      )}
  </div>
);

const GlassCard = ({ children, className = "", ...rest }) => (
  <div
    className={
      "rounded-2xl bg-white/70 backdrop-blur-xl border border-white shadow-[0_10px_40px_-15px_rgba(15,110,79,0.18)] " +
      className
    }
    {...rest}
  >
    {children}
  </div>
);

const FeatureBullet = ({ icon: Icon, label }) => (
  <li className="flex items-start gap-3">
    <span className="mt-0.5 w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary)]">
      <Icon size={16} />
    </span>
    <span className="text-[color:var(--sc-ink)] font-medium">{label}</span>
  </li>
);

/* ---------- Nav ---------------------------------------------------- */

const NAV_LINKS = [
  { href: "#billing", label: "Billing" },
  { href: "#shop", label: "Shop" },
  { href: "#services", label: "Services" },
  { href: "#how", label: "How it works" },
  { href: "#careers", label: "Careers" },
  { href: "#contact", label: "Contact" },
  { href: "#legal", label: "Legal" },
];

/** Shared "Download App" anchor — real APK download via HTML5 download attr. */
function DownloadBtn({ cms, size = "sm", testid, children }) {
  return (
    <a
      href={cms.apk_url}
      download={cms.apk_filename || ""}
      className={
        size === "lg"
          ? "sc-btn-primary inline-flex items-center gap-2 text-base px-5 py-3 shadow-[0_10px_30px_-10px_rgba(15,110,79,0.55)]"
          : "sc-btn-primary inline-flex items-center gap-1.5 text-sm py-2 px-3.5"
      }
      data-testid={testid}
    >
      <Download size={size === "lg" ? 18 : 15} />
      {children || "Download App"}
      {size === "lg" && <ArrowRight size={16} />}
    </a>
  );
}

function TopNav({ cms }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      data-testid="landing-nav"
      className={
        "fixed top-0 inset-x-0 z-50 transition-all duration-300 " +
        (scrolled
          ? "bg-white/85 backdrop-blur-xl border-b border-[color:var(--sc-border)] shadow-[0_2px_20px_-8px_rgba(15,110,79,0.15)]"
          : "bg-transparent border-b border-transparent")
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" data-testid="landing-brand">
          <div className="w-10 h-10 rounded-xl bg-[color:var(--sc-primary)] text-white grid place-items-center font-extrabold text-lg shadow-[0_6px_20px_-6px_rgba(15,110,79,0.6)]">
            S
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-[color:var(--sc-ink)]">Slangcart</div>
            <div className="text-[10px] text-[color:var(--sc-ink-muted)] tracking-wider uppercase">{cms.brand_tagline}</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-[color:var(--sc-ink)]/80 hover:text-[color:var(--sc-primary)] hover:bg-[color:var(--sc-accent-light)] transition-colors"
              data-testid={`nav-link-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-[color:var(--sc-primary-700)] hover:bg-[color:var(--sc-accent-light)] transition-colors"
            data-testid="nav-signin"
          >
            <LogIn size={15} /> Sign in
          </Link>
          <a
            href={cms.apk_url}
            download={cms.apk_filename || ""}
            className="hidden sm:inline-flex items-center gap-1.5 sc-btn-primary text-sm py-2 px-3.5"
            data-testid="nav-download"
          >
            <Download size={15} /> Download App
          </a>
          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden w-10 h-10 grid place-items-center rounded-lg border border-[color:var(--sc-border)] bg-white"
            data-testid="nav-toggle"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden bg-white/95 backdrop-blur-xl border-b border-[color:var(--sc-border)]" data-testid="nav-mobile-menu">
          <div className="px-4 sm:px-6 py-3 flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm font-semibold text-[color:var(--sc-ink)] hover:bg-[color:var(--sc-accent-light)]"
              >
                {l.label}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              <Link to="/login" className="flex-1 sc-btn-outline text-sm" onClick={() => setOpen(false)} data-testid="nav-signin-mobile">
                Sign in
              </Link>
              <a
                href={cms.apk_url}
                download={cms.apk_filename || ""}
                className="flex-1 sc-btn-primary text-sm text-center"
                onClick={() => setOpen(false)}
                data-testid="nav-download-mobile"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/* ---------- Hero --------------------------------------------------- */

function Hero({ cms }) {
  return (
    <section className="relative pt-24 sm:pt-28 pb-10 overflow-hidden" data-testid="hero">
      {/* soft radial background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[color:var(--sc-accent-light)] via-[color:var(--sc-bg)] to-[color:var(--sc-bg)]" />
      <div className="absolute -top-32 -left-40 w-[520px] h-[520px] rounded-full bg-[color:var(--sc-primary)]/10 blur-3xl -z-10" />
      <div className="absolute top-24 -right-32 w-[440px] h-[440px] rounded-full bg-[color:var(--sc-primary)]/12 blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 sc-fade-in">
          <SectionTag>{cms.hero_eyebrow}</SectionTag>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[color:var(--sc-ink)] leading-[1.02]">
            {cms.hero_title_line1}
            <br />
            {cms.hero_title_line2}
            <br />
            {cms.hero_title_line3}
          </h1>
          <p className="mt-6 text-lg text-[color:var(--sc-ink-muted)] max-w-xl leading-relaxed">
            {cms.hero_subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <DownloadBtn cms={cms} size="lg" testid="hero-download">
              {cms.hero_cta_primary}
            </DownloadBtn>
            <Link
              to="/login"
              className="sc-btn-outline inline-flex items-center gap-2 text-base px-5 py-3 bg-white"
              data-testid="hero-signin"
            >
              <LogIn size={16} /> {cms.hero_cta_secondary}
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-3 max-w-md gap-3">
            {[
              { k: cms.stat_1_k, v: cms.stat_1_v },
              { k: cms.stat_2_k, v: cms.stat_2_v },
              { k: cms.stat_3_k, v: cms.stat_3_v },
            ].map((s) => (
              <div key={s.v} className="rounded-xl bg-white/70 backdrop-blur border border-[color:var(--sc-border)] px-3 py-2.5">
                <div className="text-xl font-extrabold text-[color:var(--sc-ink)]">{s.k}</div>
                <div className="text-[11px] text-[color:var(--sc-ink-muted)] leading-tight">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right-side product mockup */}
        <div className="lg:col-span-6 relative">
          <div className="relative mx-auto max-w-lg">
            <GlassCard className="p-5 relative overflow-hidden">
              {/* Fake POS invoice preview */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[color:var(--sc-primary)] text-white grid place-items-center font-bold">S</div>
                  <div>
                    <div className="font-bold text-[color:var(--sc-ink)] text-sm">Slangcart POS</div>
                    <div className="text-[10px] text-[color:var(--sc-ink-muted)]">GST-ready invoice</div>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">LIVE</span>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { n: "Basmati Rice 5kg", q: "×2", p: "₹ 1,180" },
                  { n: "Sunflower Oil 1L", q: "×1", p: "₹ 220" },
                  { n: "Farm Eggs (30)", q: "×1", p: "₹ 195" },
                ].map((r) => (
                  <div key={r.n} className="flex items-center justify-between text-sm py-2 border-b border-dashed border-[color:var(--sc-border)] last:border-0">
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-[color:var(--sc-primary)]" />
                      <span className="text-[color:var(--sc-ink)] font-medium">{r.n}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[color:var(--sc-ink-muted)]">
                      <span className="text-xs">{r.q}</span>
                      <span className="text-[color:var(--sc-ink)] font-semibold">{r.p}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl bg-[color:var(--sc-accent-light)] p-3 flex items-center justify-between">
                <div className="text-xs text-[color:var(--sc-primary-700)] font-semibold">Grand Total (incl. GST)</div>
                <div className="text-lg font-extrabold text-[color:var(--sc-primary-700)]">₹ 1,595.00</div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-9 rounded-lg bg-[color:var(--sc-primary)] text-white text-sm font-semibold grid place-items-center">Print / Share</div>
                <div className="w-9 h-9 rounded-lg border border-[color:var(--sc-border)] grid place-items-center text-[color:var(--sc-primary)]"><ScanLine size={16} /></div>
              </div>
            </GlassCard>

            {/* floating accent card #1: shop */}
            <div className="hidden sm:block absolute -left-10 -bottom-8 w-56">
              <GlassCard className="p-3.5">
                <div className="flex items-center gap-2 text-[color:var(--sc-primary-700)] text-xs font-semibold">
                  <ShoppingBag size={14} /> Order shipped
                </div>
                <div className="mt-1.5 text-sm font-bold text-[color:var(--sc-ink)]">#SC-2610 · ₹ 899</div>
                <div className="mt-1 h-1.5 rounded-full bg-[color:var(--sc-border)] overflow-hidden">
                  <div className="h-full w-3/4 bg-[color:var(--sc-primary)] rounded-full" />
                </div>
                <div className="mt-1 text-[10px] text-[color:var(--sc-ink-muted)]">Out for delivery — 12 min</div>
              </GlassCard>
            </div>

            {/* floating accent card #2: service */}
            <div className="hidden sm:block absolute -right-6 -top-8 w-56">
              <GlassCard className="p-3.5">
                <div className="flex items-center gap-2 text-[color:var(--sc-primary-700)] text-xs font-semibold">
                  <Wrench size={14} /> Technician booked
                </div>
                <div className="mt-1.5 text-sm font-bold text-[color:var(--sc-ink)]">AC repair · 4.8★</div>
                <div className="mt-1 text-[10px] text-[color:var(--sc-ink-muted)]">Ravi arrives by 3:20 PM</div>
              </GlassCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Reusable "flow" strip ---------------------------------- */

function FlowStrip({ steps }) {
  return (
    <div className="mt-8 rounded-2xl bg-white/70 backdrop-blur-xl border border-[color:var(--sc-border)] p-3 flex items-center gap-2 overflow-x-auto">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] text-sm font-semibold whitespace-nowrap">
            <s.icon size={16} /> {s.label}
          </div>
          {i < steps.length - 1 && <ArrowRight size={16} className="text-[color:var(--sc-ink-muted)] shrink-0" />}
        </div>
      ))}
    </div>
  );
}

/* ---------- Billing section --------------------------------------- */

function BillingSection({ cms }) {
  const flow = [
    { icon: Store, label: "Retailer" },
    { icon: ScanLine, label: "Billing" },
    { icon: FileText, label: "Invoice" },
    { icon: UsersRound, label: "Customer" },
  ];
  const features = [
    { icon: Zap, label: "Fast GST billing" },
    { icon: ScanLine, label: "Barcode billing" },
    { icon: Package, label: "Product management" },
    { icon: Users, label: "Customer database" },
    { icon: BarChart3, label: "Sales reports" },
    { icon: FileText, label: "Purchase reports" },
    { icon: Boxes, label: "Inventory tracking" },
    { icon: UsersRound, label: "Multi-user support" },
    { icon: Cloud, label: "Cloud sync" },
  ];
  return (
    <section id="billing" className="py-12 sm:py-16" data-testid="section-billing">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-5">
          <SectionHeading
            eyebrow={cms.billing_eyebrow}
            title={cms.billing_title}
            sub={cms.billing_sub}
          />
          <FlowStrip steps={flow} />
        </div>
        <div className="lg:col-span-7">
          <GlassCard className="p-6 sm:p-8">
            <ul className="grid sm:grid-cols-2 gap-3.5">
              {features.map((f) => (
                <FeatureBullet key={f.label} icon={f.icon} label={f.label} />
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-between rounded-xl bg-[color:var(--sc-accent-light)] p-4">
              <div>
                <div className="text-sm font-extrabold text-[color:var(--sc-primary-700)]">Works offline. Syncs to cloud.</div>
                <div className="text-xs text-[color:var(--sc-primary-700)]/80">Your day never stops if the internet does.</div>
              </div>
              <Cloud size={26} className="text-[color:var(--sc-primary)]" />
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}

/* ---------- Shop section ------------------------------------------ */

function ShopSection({ cms }) {
  const flow = [
    { icon: Store, label: "Vendor" },
    { icon: ShoppingBag, label: "Products" },
    { icon: UsersRound, label: "Customer" },
    { icon: Truck, label: "Delivery" },
  ];
  const features = [
    { icon: Search, label: "Browse products" },
    { icon: ShoppingCart, label: "Add to cart" },
    { icon: Shield, label: "Secure checkout" },
    { icon: Truck, label: "Order tracking" },
    { icon: MapPin, label: "Local store support" },
    { icon: Layers, label: "Multiple categories" },
    { icon: Percent, label: "Deals & offers" },
    { icon: Heart, label: "Wishlist" },
  ];
  return (
    <section id="shop" className="py-12 sm:py-16 relative overflow-hidden" data-testid="section-shop">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white to-[color:var(--sc-accent-light)]/50" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-7 order-2 lg:order-1">
          <GlassCard className="p-6 sm:p-8">
            <ul className="grid sm:grid-cols-2 gap-3.5">
              {features.map((f) => (
                <FeatureBullet key={f.label} icon={f.icon} label={f.label} />
              ))}
            </ul>
            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              {[
                { icon: Truck, label: "Same-day delivery" },
                { icon: Shield, label: "Buyer protection" },
                { icon: Percent, label: "Cashback offers" },
              ].map((b) => (
                <div key={b.label} className="rounded-xl bg-white border border-[color:var(--sc-border)] p-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--sc-ink)]">
                  <b.icon size={16} className="text-[color:var(--sc-primary)]" /> {b.label}
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
        <div className="lg:col-span-5 order-1 lg:order-2">
          <SectionHeading
            eyebrow={cms.shop_eyebrow}
            title={cms.shop_title}
            sub={cms.shop_sub}
          />
          <FlowStrip steps={flow} />
        </div>
      </div>
    </section>
  );
}

/* ---------- Services section -------------------------------------- */

const SERVICE_CATS = [
  { icon: Plug, label: "Electricians" },
  { icon: Droplets, label: "Plumbers" },
  { icon: Hammer, label: "Carpenters" },
  { icon: Snowflake, label: "AC Repair" },
  { icon: Smartphone, label: "Mobile Repair" },
  { icon: Wifi, label: "Internet Technician" },
  { icon: Sparkles, label: "Home Cleaning" },
  { icon: HardHat, label: "Construction" },
  { icon: Cctv, label: "CCTV Installation" },
  { icon: Monitor, label: "Computer Repair" },
  { icon: PaintBucket, label: "Painting Services" },
  { icon: WrenchAlt, label: "Local Professionals" },
];

function ServicesSection({ cms }) {
  const flow = [
    { icon: UsersRound, label: "Customer" },
    { icon: Wrench, label: "Technician" },
    { icon: CheckCircle2, label: "Completed" },
  ];
  return (
    <section id="services" className="py-12 sm:py-16" data-testid="section-services">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={cms.services_eyebrow}
          title={cms.services_title}
          sub={cms.services_sub}
          align="center"
        />
        <FlowStrip steps={flow} />
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {SERVICE_CATS.map((c, i) => (
            <div
              key={c.label}
              className="group relative rounded-2xl bg-white border border-[color:var(--sc-border)] p-5 hover:border-[color:var(--sc-primary)] hover:-translate-y-0.5 transition-all duration-200"
              style={{ animationDelay: `${i * 40}ms` }}
              data-testid={`svc-${c.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="w-12 h-12 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)] group-hover:bg-[color:var(--sc-primary)] group-hover:text-white transition-colors">
                <c.icon size={22} />
              </div>
              <div className="mt-3 font-semibold text-[color:var(--sc-ink)]">{c.label}</div>
              <div className="mt-1 text-xs text-[color:var(--sc-ink-muted)]">Available in your area</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- How it works ------------------------------------------ */

function HowItWorks({ cms }) {
  const steps = [
    { icon: Download, title: "Download App", desc: "Get Slangcart from Play Store or App Store." },
    { icon: LogIn, title: "Login", desc: "Register once and access every feature." },
    { icon: Layers, title: "Choose Billing / Shop / Services", desc: "Pick the module that fits the moment." },
    { icon: Rocket, title: "Use anywhere", desc: "Online, offline, at home or on the go." },
  ];
  return (
    <section id="how" className="py-12 sm:py-16 bg-gradient-to-b from-[color:var(--sc-accent-light)]/60 to-white" data-testid="section-how">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={cms.how_eyebrow} title={cms.how_title} align="center" />
        <div className="mt-12 relative">
          <div className="hidden lg:block absolute top-8 left-[7%] right-[7%] h-0.5 bg-gradient-to-r from-transparent via-[color:var(--sc-primary)]/40 to-transparent" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className="relative text-center rounded-2xl bg-white border border-[color:var(--sc-border)] p-6 hover:shadow-[0_20px_50px_-20px_rgba(15,110,79,0.35)] hover:-translate-y-1 transition-all duration-300"
                data-testid={`how-step-${i + 1}`}
              >
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[color:var(--sc-primary)] to-[color:var(--sc-primary-700)] text-white grid place-items-center shadow-[0_12px_30px_-10px_rgba(15,110,79,0.6)]">
                  <s.icon size={26} />
                </div>
                <div className="mt-3 text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-primary)]">Step {i + 1}</div>
                <div className="mt-1 font-extrabold text-[color:var(--sc-ink)]">{s.title}</div>
                <div className="mt-1.5 text-sm text-[color:var(--sc-ink-muted)] leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Feature grid ------------------------------------------ */

const PREMIUM_FEATURES = [
  { icon: ScanLine, title: "Billing Software", desc: "GST-ready POS with barcode scanning and print-share." },
  { icon: ShoppingBag, title: "Online Shop", desc: "Storefront for every vendor, national + local reach." },
  { icon: Wrench, title: "Service Marketplace", desc: "Book verified technicians in minutes." },
  { icon: MessageCircle, title: "Customer Support", desc: "In-app chat and ticketing for peace of mind." },
  { icon: Store, title: "Vendor Dashboard", desc: "Products, orders, sales, payouts — one panel." },
  { icon: BarChart3, title: "Analytics", desc: "Daily KPIs, top items, revenue and profit views." },
  { icon: Boxes, title: "Inventory", desc: "Live stock across POS, Shop and Admin, always in sync." },
  { icon: FileText, title: "Invoices", desc: "Auto-numbered, printable, GST-compliant." },
  { icon: Cloud, title: "Cloud Storage", desc: "Your data backed up and available on any device." },
  { icon: Shield, title: "Security", desc: "JWT auth, session control, device fingerprinting." },
  { icon: CreditCard, title: "Payments", desc: "UPI, cards, wallets and cash on delivery." },
  { icon: Bell, title: "Notifications", desc: "Real-time order, payment and service alerts." },
];

function FeatureGrid({ cms }) {
  return (
    <section className="py-12 sm:py-16" data-testid="section-features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={cms.features_eyebrow} title={cms.features_title} align="center" />
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PREMIUM_FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="group relative rounded-2xl bg-white border border-[color:var(--sc-border)] p-6 overflow-hidden hover:border-[color:var(--sc-primary)] transition-colors"
              data-testid={`feat-${i}`}
            >
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-[color:var(--sc-accent-light)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[color:var(--sc-primary)] to-[color:var(--sc-primary-700)] text-white grid place-items-center">
                  <f.icon size={20} />
                </div>
                <div className="mt-4 font-extrabold text-[color:var(--sc-ink)]">{f.title}</div>
                <div className="mt-1.5 text-sm text-[color:var(--sc-ink-muted)] leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Terms accordion --------------------------------------- */

const TERMS = [
  { icon: Users, title: "User Responsibilities", body: "Every account holder agrees to keep credentials safe, provide accurate KYC information and respect the community guidelines while using Slangcart." },
  { icon: Shield, title: "Privacy Policy", body: "We collect only what's essential to run the service — contact details, KYC docs, transaction history — and never sell personal data to third parties." },
  { icon: FileText, title: "Billing Terms", body: "All bills generated on the POS are GST-compliant. Vendors are responsible for accuracy of HSN codes, tax rates and customer details on every invoice." },
  { icon: Percent, title: "Refund Policy", body: "Refunds are processed to the original payment source within 7 working days. Item-level refunds re-credit inventory and reverse tax entries automatically." },
  { icon: Wrench, title: "Service Booking Terms", body: "Booking fees, phone-reveal fees and cancellation windows are shown before confirming any service request. Providers commit to a response SLA." },
  { icon: Store, title: "Seller Guidelines", body: "Vendors publish only authentic products, keep stock accurate, honour delivery timelines and follow packaging and safety norms." },
  { icon: UsersRound, title: "Customer Guidelines", body: "Customers agree to provide correct delivery information, respect service providers and use the wallet strictly for lawful purchases." },
  { icon: CreditCard, title: "Payment Terms", body: "Payments are settled via bank-grade rails (UPI / cards / wallet). Settlement to vendor accounts follows a 24–72 hour cycle depending on the mode." },
  { icon: Shield, title: "Data Protection", body: "All traffic is encrypted in transit. Sensitive fields are encrypted at rest. Access to backend data is audited." },
  { icon: Award, title: "Platform Rules", body: "Fraud, spam, unauthorized reselling and mis-representation of location/identity will lead to permanent suspension without notice." },
];

function TermsSection({ cms }) {
  const [open, setOpen] = useState(0);
  return (
    <section id="terms" className="py-12 sm:py-16 bg-gradient-to-b from-white to-[color:var(--sc-accent-light)]/40" data-testid="section-terms">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={cms.terms_eyebrow} title={cms.terms_title} align="center" />
        <div className="mt-10 space-y-3">
          {TERMS.map((t, i) => {
            const isOpen = open === i;
            return (
              <div key={t.title} className="rounded-2xl bg-white border border-[color:var(--sc-border)] overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="w-full flex items-center gap-4 p-4 sm:p-5 text-left"
                  data-testid={`terms-toggle-${i}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)] shrink-0">
                    <t.icon size={18} />
                  </div>
                  <div className="flex-1 font-semibold text-[color:var(--sc-ink)]">{t.title}</div>
                  <ChevronDown
                    size={18}
                    className={"text-[color:var(--sc-ink-muted)] transition-transform " + (isOpen ? "rotate-180" : "")}
                  />
                </button>
                <div
                  className={
                    "grid transition-[grid-template-rows] duration-300 ease-out " +
                    (isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")
                  }
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5 pl-[76px] text-sm text-[color:var(--sc-ink-muted)] leading-relaxed">
                      {t.body}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Contact section --------------------------------------- */

function ContactSection({ cms }) {
  const [sent, setSent] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  };
  return (
    <section id="contact" className="py-12 sm:py-16" data-testid="section-contact">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-5">
          <SectionHeading
            eyebrow={cms.contact_eyebrow}
            title={cms.contact_title}
            sub={cms.contact_sub}
          />
          <div className="mt-8 space-y-3">
            {[
              { icon: Phone, label: "Phone", value: cms.contact_phone, href: cms.contact_phone_href },
              { icon: Mail, label: "Email", value: cms.contact_email, href: `mailto:${cms.contact_email}` },
              { icon: MapPin, label: "Office", value: cms.contact_address },
              { icon: Clock3, label: "Business hours", value: cms.contact_hours },
            ].map((c) => (
              <a
                key={c.label}
                href={c.href || undefined}
                className="flex items-center gap-4 rounded-2xl bg-white border border-[color:var(--sc-border)] p-4 hover:border-[color:var(--sc-primary)] hover:-translate-y-0.5 transition-all"
                data-testid={`contact-${c.label.toLowerCase()}`}
              >
                <div className="w-11 h-11 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)]">
                  <c.icon size={20} />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-[color:var(--sc-ink-muted)]">{c.label}</div>
                  <div className="font-bold text-[color:var(--sc-ink)]">{c.value}</div>
                </div>
              </a>
            ))}
            <a
              href={cms.contact_whatsapp_url}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center gap-3 rounded-2xl bg-[#25D366] text-white p-4 hover:brightness-105 transition-all"
              data-testid="contact-whatsapp"
            >
              <MessageCircle size={22} />
              <div>
                <div className="font-bold">Message us on WhatsApp</div>
                <div className="text-xs opacity-90">Usually replies in under 10 minutes</div>
              </div>
              <ArrowRight size={18} className="ml-auto" />
            </a>
          </div>
        </div>
        <div className="lg:col-span-7">
          <GlassCard className="p-6 sm:p-8">
            <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4" data-testid="contact-form">
              <div className="sm:col-span-1">
                <label className="text-sm font-semibold text-[color:var(--sc-ink)]">Name</label>
                <input required className="sc-input mt-1.5" placeholder="Your full name" data-testid="contact-name" />
              </div>
              <div className="sm:col-span-1">
                <label className="text-sm font-semibold text-[color:var(--sc-ink)]">Phone / Email</label>
                <input required className="sc-input mt-1.5" placeholder="How should we reach you?" data-testid="contact-reach" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-[color:var(--sc-ink)]">Subject</label>
                <input className="sc-input mt-1.5" placeholder="What's this about?" data-testid="contact-subject" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-[color:var(--sc-ink)]">Message</label>
                <textarea required rows={5} className="sc-input mt-1.5 resize-none" placeholder="Tell us how we can help…" data-testid="contact-message" />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between gap-3">
                <div className="text-xs text-[color:var(--sc-ink-muted)]">
                  We&apos;ll never share your info. See{" "}
                  <Link to="/legal/privacy" className="underline font-semibold text-[color:var(--sc-primary)]">Privacy</Link>.
                </div>
                <button type="submit" className="sc-btn-primary inline-flex items-center gap-2" data-testid="contact-submit">
                  <Send size={16} /> Send message
                </button>
              </div>
              {sent && (
                <div className="sm:col-span-2 rounded-xl bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] px-4 py-3 text-sm font-semibold" data-testid="contact-sent">
                  Thanks! Your message is on its way — we&apos;ll reply within one business day.
                </div>
              )}
            </form>
            <div className="mt-6 rounded-2xl bg-[color:var(--sc-accent-light)] p-4 flex items-center gap-3">
              <MapPin size={20} className="text-[color:var(--sc-primary)]" />
              <div className="text-sm text-[color:var(--sc-primary-700)] font-semibold flex-1">Bengaluru, Karnataka · India · Google Maps placeholder</div>
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}

/* ---------- Careers section --------------------------------------- */

const ROLE_ICON = {
  sales: TrendingUp,
  service: Wrench,
  support: MessageCircle,
  marketing: Rocket,
  developer: GraduationCap,
  design: Sparkles,
  delivery: Truck,
  business: Briefcase,
};
function iconForRole(title = "") {
  const t = title.toLowerCase();
  for (const key of Object.keys(ROLE_ICON)) if (t.includes(key)) return ROLE_ICON[key];
  return Briefcase;
}

function CareersSection({ cms }) {
  const roles = Array.isArray(cms.careers_roles) ? cms.careers_roles : [];
  return (
    <section id="careers" className="py-12 sm:py-16 bg-gradient-to-b from-[color:var(--sc-accent-light)]/40 to-white" data-testid="section-careers">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5">
            <SectionHeading
              eyebrow={cms.careers_eyebrow}
              title={cms.careers_title}
              sub={cms.careers_sub}
            />
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { icon: Coffee, label: "Warm culture" },
                { icon: Rocket, label: "Fast growth" },
                { icon: Award, label: "Great benefits" },
                { icon: Users, label: "Learn together" },
              ].map((b) => (
                <div key={b.label} className="rounded-xl bg-white border border-[color:var(--sc-border)] p-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--sc-ink)]">
                  <b.icon size={16} className="text-[color:var(--sc-primary)]" /> {b.label}
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-7">
            {roles.length === 0 ? (
              <div className="rounded-2xl bg-white border border-dashed border-[color:var(--sc-border)] p-8 text-center text-sm text-[color:var(--sc-ink-muted)]">
                No open roles right now — check back soon!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {roles.map((r, i) => {
                  const Icon = iconForRole(r.title || "");
                  return (
                    <div key={`${r.title}-${i}`} className="group rounded-2xl bg-white border border-[color:var(--sc-border)] p-5 hover:border-[color:var(--sc-primary)] transition-all" data-testid={`role-${(r.title || `role-${i}`).toLowerCase().replace(/\s+/g, "-")}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)] group-hover:bg-[color:var(--sc-primary)] group-hover:text-white transition-colors">
                          <Icon size={20} />
                        </div>
                        <div>
                          <div className="font-extrabold text-[color:var(--sc-ink)]">{r.title}</div>
                          <div className="text-xs text-[color:var(--sc-ink-muted)]">{r.subtitle || ""}</div>
                        </div>
                      </div>
                      <a
                        href={`mailto:${cms.careers_email}?subject=${encodeURIComponent(`Application: ${r.title}`)}`}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--sc-primary)] hover:text-[color:var(--sc-primary-700)]"
                      >
                        Apply now <ArrowRight size={14} />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-6 rounded-2xl bg-white border border-dashed border-[color:var(--sc-primary)]/40 p-5 flex flex-wrap items-center gap-4">
              <Briefcase size={22} className="text-[color:var(--sc-primary)]" />
              <div className="flex-1 min-w-[220px]">
                <div className="font-extrabold text-[color:var(--sc-ink)]">{cms.careers_bottom_title}</div>
                <div className="text-sm text-[color:var(--sc-ink-muted)]">{cms.careers_bottom_desc}</div>
              </div>
              <a
                href={`mailto:${cms.careers_email}?subject=Open%20application`}
                className="sc-btn-primary inline-flex items-center gap-2"
                data-testid="careers-open-application"
              >
                <Send size={16} /> Send resume
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Legal & Policies (clear hub, synced with the app) ------- */

const LEGAL_LINKS = [
  { kind: "terms", label: "Terms of Service", desc: "The rules for using Slangcart — accounts, orders and billing.", Icon: FileText },
  { kind: "privacy", label: "Privacy Policy", desc: "What data we collect and how we keep it safe.", Icon: Shield },
  { kind: "refund", label: "Refund Policy", desc: "Returns, cancellations and how refunds are processed.", Icon: CreditCard },
  { kind: "contact_us", label: "Contact Us", desc: "Reach our team — support, grievances and business.", Icon: Phone },
  { kind: "about", label: "About Slangcart", desc: "Who we are and the platform we're building for India.", Icon: Store },
];

function LegalSection() {
  return (
    <section id="legal" className="py-12 sm:py-16 bg-gradient-to-b from-white to-[color:var(--sc-accent-light)]/40" data-testid="section-legal">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <SectionTag>Legal &amp; Policies</SectionTag>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[color:var(--sc-ink)]">
            Everything in the open.
          </h2>
          <p className="mt-3 text-[color:var(--sc-ink-muted)]">
            The same policies you see in the app — always one tap away, no sign-in needed.
          </p>
        </div>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="legal-grid">
          {LEGAL_LINKS.map(({ kind, label, desc, Icon }) => (
            <Link
              key={kind}
              to={`/legal/${kind}`}
              data-testid={`legal-card-${kind}`}
              className="group rounded-2xl bg-white border border-[color:var(--sc-border)] p-5 flex items-start gap-4 hover:border-[color:var(--sc-primary)] hover:shadow-[0_12px_40px_-18px_rgba(15,110,79,0.5)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5"
            >
              <div className="w-11 h-11 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)] shrink-0">
                <Icon size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-[color:var(--sc-ink)] flex items-center gap-1.5">
                  {label}
                  <ArrowRight size={15} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[color:var(--sc-primary)]" />
                </div>
                <p className="text-sm text-[color:var(--sc-ink-muted)] mt-0.5 leading-snug">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ---------- Footer ------------------------------------------------- */

function Footer({ cms }) {
  return (
    <footer className="relative isolate overflow-hidden" data-testid="landing-footer">
      <div className="absolute inset-0 -z-10 bg-[color:var(--sc-ink)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(15,110,79,0.35),transparent_60%)]" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-2 lg:grid-cols-5 gap-8 text-white">
        <div className="col-span-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white text-[color:var(--sc-primary)] grid place-items-center font-extrabold">S</div>
            <div>
              <div className="font-extrabold">Slangcart</div>
              <div className="text-[10px] uppercase tracking-widest text-white/60">{cms.brand_tagline}</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/70 max-w-sm leading-relaxed">
            {cms.footer_about}
          </p>
          <div className="mt-5 flex items-center gap-2">
            {[
              { icon: Instagram, label: "instagram" },
              { icon: Facebook, label: "facebook" },
              { icon: Youtube, label: "youtube" },
              { icon: Twitter, label: "twitter" },
            ].map((s) => (
              <a
                key={s.label}
                href="#"
                aria-label={s.label}
                className="w-9 h-9 rounded-lg bg-white/10 border border-white/10 grid place-items-center hover:bg-white/20 transition-colors"
                data-testid={`social-${s.label}`}
              >
                <s.icon size={16} />
              </a>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/60">Product</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a href="#billing" className="hover:text-[color:var(--sc-accent-light)]">Billing</a></li>
            <li><a href="#shop" className="hover:text-[color:var(--sc-accent-light)]">Shop</a></li>
            <li><a href="#services" className="hover:text-[color:var(--sc-accent-light)]">Services</a></li>
            <li><a href={cms.apk_url} download={cms.apk_filename || ""} className="hover:text-[color:var(--sc-accent-light)]">Download</a></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/60">Legal &amp; info</div>
          <ul className="mt-3 space-y-2 text-sm" data-testid="footer-legal-links">
            <li><Link to="/legal/terms" className="hover:text-[color:var(--sc-accent-light)]" data-testid="footer-legal-terms">Terms of Service</Link></li>
            <li><Link to="/legal/privacy" className="hover:text-[color:var(--sc-accent-light)]" data-testid="footer-legal-privacy">Privacy Policy</Link></li>
            <li><Link to="/legal/refund" className="hover:text-[color:var(--sc-accent-light)]" data-testid="footer-legal-refund">Refund Policy</Link></li>
            <li><Link to="/legal/contact_us" className="hover:text-[color:var(--sc-accent-light)]" data-testid="footer-legal-contact">Contact Us</Link></li>
            <li><Link to="/legal/about" className="hover:text-[color:var(--sc-accent-light)]" data-testid="footer-legal-about">About Slangcart</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/60">Account</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/login" className="hover:text-[color:var(--sc-accent-light)]">Sign in</Link></li>
            <li><a href={cms.apk_url} download={cms.apk_filename || ""} className="hover:text-[color:var(--sc-accent-light)]">Get the app</a></li>
            <li><a href="mailto:support@networkrupay.com" className="hover:text-[color:var(--sc-accent-light)]">Support</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/60">
          <div>© {new Date().getFullYear()} Slangcart. All rights reserved.</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to="/legal/terms" className="hover:text-white">Terms</Link>
            <Link to="/legal/privacy" className="hover:text-white">Privacy</Link>
            <Link to="/legal/refund" className="hover:text-white">Refund</Link>
            <Link to="/legal/contact_us" className="hover:text-white">Contact</Link>
            <Link to="/legal/about" className="hover:text-white">About</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Root --------------------------------------------------- */

export default function Landing() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [cms, setCms] = useState(() => getCmsSync());
  // Authenticated users landing here jump straight into their dashboard.
  useEffect(() => {
    if (user) nav("/dashboard", { replace: true });
  }, [user, nav]);
  // Load CMS content from backend / localStorage; fall back to defaults.
  useEffect(() => {
    let cancelled = false;
    loadCms().then((c) => { if (!cancelled) setCms(c); });
    return () => { cancelled = true; };
  }, []);
  const memoCms = useMemo(() => cms, [cms]);

  return (
    <div className="min-h-screen bg-[color:var(--sc-bg)] text-[color:var(--sc-ink)]" data-testid="landing-page">
      <TopNav cms={memoCms} />
      <main>
        <Hero cms={memoCms} />
        <BillingSection cms={memoCms} />
        <ShopSection cms={memoCms} />
        <ServicesSection cms={memoCms} />
        <HowItWorks cms={memoCms} />
        <FeatureGrid cms={memoCms} />
        <TermsSection cms={memoCms} />
        <ContactSection cms={memoCms} />
        <CareersSection cms={memoCms} />
        <LegalSection />
      </main>
      <Footer cms={memoCms} />
    </div>
  );
}
