// Landing-page CMS — one source of truth for every editable string / URL on
// the public homepage. Consumed by <Landing/> and edited from /admin/landing.
//
// Persistence strategy (works today, upgrades cleanly when backend supports it):
//   1. `loadCms()` first tries `GET /api/admin/settings` and reads the
//      `landing_cms` key. If the backend already persists it, this is what
//      every visitor sees.
//   2. Falls back to `localStorage.slangcart_landing_cms` (per-admin preview
//      until the backend is patched).
//   3. Falls back to the DEFAULT_CMS baked into this file.
//
// To upgrade to full multi-visitor CMS: the network-pay-1 backend just needs
// to accept `landing_cms: dict | None = None` in the `SettingsUpdate`
// Pydantic model and return it from `GET /api/admin/settings`.

import api from "@/lib/api";

const LS_KEY = "slangcart_landing_cms";

export const DEFAULT_CMS = {
  // Hero
  hero_eyebrow: "All-in-one commerce platform",
  hero_title_line1: "Run your shop,",
  hero_title_line2: "book services,",
  hero_title_line3: "grow your network.",
  hero_subtitle:
    "Slangcart brings GST billing, an online shop, a local service marketplace, and a referral wallet into a single app — trusted by retailers, technicians and customers across India.",
  hero_cta_primary: "Download App",
  hero_cta_secondary: "Sign in",
  stat_1_k: "10k+",
  stat_1_v: "Retail bills / day",
  stat_2_k: "50+",
  stat_2_v: "Service categories",
  stat_3_k: "4.7★",
  stat_3_v: "In-app rating",

  // APK download — this is what every "Download App" button links to.
  // Drop your real .apk file in /app/frontend/public/slangcart.apk to ship
  // it with the web build, OR replace with a full URL (CDN / GitHub release).
  apk_url: "/slangcart.apk",
  apk_filename: "slangcart.apk",

  // Section headings
  billing_eyebrow: "Slangcart Billing Software",
  billing_title: "A retail POS that actually feels modern.",
  billing_sub:
    "Ring up a bill in seconds, print a GST-ready invoice, keep stock accurate on every device — online or offline.",

  shop_eyebrow: "Online Shop",
  shop_title: "A neighbourhood marketplace, curated for you.",
  shop_sub:
    "Discover local vendors and national brands side-by-side, add to cart, checkout with UPI or wallet, and track every order end-to-end.",

  services_eyebrow: "Service Marketplace",
  services_title: "Find a trusted professional in your area, fast.",
  services_sub:
    "Verified technicians. Transparent pricing. Chat + call directly. Book electricians, plumbers, carpenters, cleaners and more — all under one roof.",

  how_eyebrow: "How it works",
  how_title: "Four steps. That's the whole thing.",

  features_eyebrow: "What's inside",
  features_title: "Everything you need to sell, serve and grow.",

  terms_eyebrow: "Terms & Conditions",
  terms_title: "Clear rules. No surprises.",

  contact_eyebrow: "Contact us",
  contact_title: "Real humans, quick replies.",
  contact_sub:
    "Chat with us on WhatsApp for the fastest response, or drop a message and we'll get back within one business day.",
  contact_phone: "+91 90000 12345",
  contact_phone_href: "tel:+919000012345",
  contact_email: "support@networkrupay.com",
  contact_address: "Bengaluru, Karnataka, India",
  contact_hours: "Mon – Sat · 10 AM – 7 PM IST",
  contact_whatsapp_url: "https://wa.me/919000012345",

  careers_eyebrow: "Careers",
  careers_title: "Build the future of local commerce with us.",
  careers_sub:
    "We're a small, mission-driven team building tools for millions of Indian retailers, service providers and shoppers. Come help us grow.",
  careers_email: "Support@slangcart.com",
  // Editable list of open roles. Each entry: { title, subtitle }.
  // Add/remove/rename from /admin/landing → "Careers · open roles".
  careers_roles: [
    { title: "Sales Executive", subtitle: "Full-time · Bengaluru / Remote" },
    { title: "Service Executive", subtitle: "Full-time · Bengaluru / Remote" },
  ],
  careers_bottom_title: "Don't see your role?",
  careers_bottom_desc: "Email your resume — we're always looking for great people.",

  footer_about:
    "An all-in-one platform for retail billing, an online shop, a service marketplace and a referral wallet — built for India's local businesses.",

  brand_tagline: "Shop · Service · Connect",
};

let _cache = null;

/** Read CMS content — backend → localStorage → defaults. */
export async function loadCms() {
  if (_cache) return _cache;
  // Local override — always applied as a top-layer merge.
  let local = {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) local = JSON.parse(raw) || {};
  } catch { /* ignore */ }
  // Backend value (may be silently unsupported → treat as empty).
  let remote = {};
  try {
    const { data } = await api.get("/admin/settings");
    if (data && typeof data.landing_cms === "object" && data.landing_cms) {
      remote = data.landing_cms;
    }
  } catch { /* not admin / not signed in / backend rejects — fine */ }
  _cache = { ...DEFAULT_CMS, ...remote, ...local };
  return _cache;
}

/** Synchronous read of the last loaded CMS or defaults — for first render. */
export function getCmsSync() {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_CMS, ...(JSON.parse(raw) || {}) };
  } catch { /* ignore */ }
  return DEFAULT_CMS;
}

/** Local-preview save (per-browser). */
export function saveCmsLocal(patch) {
  const next = { ...getCmsSync(), ...patch };
  _cache = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

/**
 * Publish to backend so every visitor sees it. Requires the network-pay-1
 * `SettingsUpdate` schema to accept a `landing_cms: dict | None` field.
 * Returns { ok, error? }.
 */
export async function publishCms(cms) {
  try {
    await api.put("/admin/settings", { landing_cms: cms });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.response?.data?.detail || e?.message || "Unknown error" };
  }
}

export function resetCmsLocal() {
  _cache = null;
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}
