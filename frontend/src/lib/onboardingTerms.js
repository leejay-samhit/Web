// Onboarding Terms & Conditions CMS
// ---------------------------------------------------------------------------
// Two long-form legal texts shown on the Vendor / Service-provider onboarding
// screens BEFORE the applicant can submit. Applicants must tick "I Agree" —
// the acceptance is recorded and included in the application payload so the
// backend can prove informed consent.
//
// Same persistence strategy as `landingCms.js`:
//   1. `loadTerms()` first tries `GET /api/admin/settings` and reads the
//      `onboarding_terms` key. Backend-supported = every visitor sees it.
//   2. Falls back to `localStorage.slangcart_onboarding_terms` (per-admin
//      preview until the backend accepts the field).
//   3. Falls back to the DEFAULT_TERMS baked into this file.
//
// Backend upgrade path: `SettingsUpdate` Pydantic model just needs to accept
// `onboarding_terms: dict | None = None` and return it from
// `GET /api/admin/settings`. That's it.

import api from "@/lib/api";

const LS_KEY = "slangcart_onboarding_terms";

/* -------------------------------------------------------------------------- */
/*  DEFAULT TEXTS — verbatim from product spec (04-Jul-2026)                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_SERVICE_PROVIDER_TERMS = {
  title: "Service Provider Declaration & Compliance Agreement",
  intro:
    'By selecting "I Agree" and registering as a Service Provider on Slangcart, I declare and agree that:',
  clauses: [
    "I confirm that all information provided during registration is true, complete, and accurate.",
    "I am solely responsible for complying with all applicable laws, including GST (where applicable), income tax, professional tax, business licenses, registrations, permits, and any other statutory requirements related to my services.",
    "If I am required by law to obtain GST registration or any other mandatory registration, I agree to obtain and maintain it and update my Slangcart account without delay.",
    "If I am currently not GST registered, I declare that I am legally eligible to provide services without GST registration and will obtain GST registration immediately if it becomes legally mandatory.",
    "I am solely responsible for the quality, safety, pricing, execution, warranty, and completion of the services I offer through Slangcart.",
    "I agree not to upload false, misleading, illegal, prohibited, or fraudulent service listings.",
    "I acknowledge that any incorrect declaration, false information, tax non-compliance, or violation of applicable laws is my sole responsibility.",
    "I agree to indemnify and hold Slangcart harmless from any tax demand, penalty, interest, legal claim, loss, or liability arising from my services, incorrect declarations, or failure to comply with applicable laws.",
    "I authorize Slangcart to verify my information and to request documents such as PAN, GSTIN (if applicable), Aadhaar or other identity documents, bank account details, business registrations, and any other documents reasonably required for verification.",
    "I understand that Slangcart is a marketplace platform that connects customers with independent service providers. Slangcart is not responsible for the services performed by me, and I remain solely responsible for fulfilling my commitments to customers.",
    "I agree that Slangcart may suspend payouts, temporarily restrict my account, or permanently terminate my account if false information, fraud, misuse, or non-compliance with applicable laws is identified.",
    "I confirm that I have read, understood, and agree to these Service Provider Terms and Conditions and will comply with all applicable laws while using the Slangcart platform.",
  ],
  declaration_heading: "Declaration",
  declaration_body:
    "I hereby declare that all information and documents submitted by me are true and correct. I understand that providing false information or violating applicable laws may result in suspension or termination of my account, withholding of payouts where legally permitted, and legal action under applicable laws.",
  agree_label:
    "I have read, understood and agree to the Service Provider Declaration & Compliance Agreement.",
};

export const DEFAULT_VENDOR_TERMS = {
  title: "Vendor Declaration & GST Compliance Agreement",
  intro:
    'By selecting "I Agree" and registering as a vendor on Slangcart, I declare and agree that:',
  clauses: [
    "I confirm that all information provided during registration is true, complete, and accurate.",
    "I understand that I am solely responsible for complying with all applicable laws, including GST, income tax, business licensing, and any other statutory requirements.",
    "If I am required to obtain GST registration under applicable law, I agree to obtain and maintain a valid GSTIN and update my Slangcart account without delay.",
    "If I am currently not GST registered, I declare that I am legally eligible to operate without GST registration. I agree to obtain GST registration immediately if I become legally required to do so.",
    "I acknowledge that any incorrect declaration, false information, or failure to comply with tax laws is my sole responsibility.",
    "I agree to indemnify and hold Slangcart harmless from any loss, penalty, tax demand, interest, or legal action arising from false information or my failure to comply with applicable laws.",
    "I authorize Slangcart to suspend payouts, temporarily restrict my account, or terminate my vendor account if false information or non-compliance is identified.",
    "I agree to provide any documents reasonably requested by Slangcart for verification, including PAN, GSTIN (if applicable), bank account details, identity documents, and other business-related documents.",
    "I understand that Slangcart operates as a marketplace platform and that I remain responsible for the products I sell, the invoices I issue (where applicable), taxes, product quality, warranties, and customer obligations under applicable law.",
    "I confirm that I have read, understood, and agree to these Vendor Terms and Conditions and will comply with all applicable laws while using the Slangcart platform.",
  ],
  declaration_heading: "Declaration",
  declaration_body:
    "I hereby declare that the information provided by me is true and correct. I understand that providing false information may result in suspension or termination of my account and may attract legal action under applicable laws.",
  agree_label:
    "I have read, understood and agree to the Vendor Declaration & GST Compliance Agreement.",
};

export const DEFAULT_TERMS = {
  vendor: DEFAULT_VENDOR_TERMS,
  service_provider: DEFAULT_SERVICE_PROVIDER_TERMS,
  // Bump when the wording changes so applicants who already accepted an older
  // version can be prompted to re-accept.
  version: "1.0.0",
  updated_at: "2026-07-04",
};

let _cache = null;

/* -------------------------------------------------------------------------- */
/*  Read / Write                                                              */
/* -------------------------------------------------------------------------- */

/** Deep-merge two "role" blocks so partial overrides don't lose keys. */
function mergeRole(base, patch) {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    clauses: Array.isArray(patch.clauses) ? patch.clauses : base.clauses,
  };
}

function mergeAll(base, patch) {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    vendor: mergeRole(base.vendor, patch.vendor),
    service_provider: mergeRole(base.service_provider, patch.service_provider),
  };
}

/** Read terms — backend → localStorage → defaults. Cached after first call. */
export async function loadTerms() {
  if (_cache) return _cache;
  let local = {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) local = JSON.parse(raw) || {};
  } catch { /* ignore */ }
  let remote = {};
  try {
    const { data } = await api.get("/admin/settings");
    if (data && typeof data.onboarding_terms === "object" && data.onboarding_terms) {
      remote = data.onboarding_terms;
    }
  } catch { /* not admin / backend rejects — fine */ }
  _cache = mergeAll(mergeAll(DEFAULT_TERMS, remote), local);
  return _cache;
}

/** Synchronous read of last-loaded terms, or defaults (localStorage fallback). */
export function getTermsSync() {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return mergeAll(DEFAULT_TERMS, JSON.parse(raw) || {});
  } catch { /* ignore */ }
  return DEFAULT_TERMS;
}

/** Convenience accessors used by onboarding pages. */
export const getVendorTerms = () => getTermsSync().vendor;
export const getServiceProviderTerms = () => getTermsSync().service_provider;

/** Local-only save (browser preview). */
export function saveTermsLocal(patch) {
  const next = mergeAll(getTermsSync(), patch);
  next.updated_at = new Date().toISOString().slice(0, 10);
  _cache = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

/** Publish to backend so every applicant sees the same version. */
export async function publishTerms(terms) {
  try {
    await api.put("/admin/settings", { onboarding_terms: terms });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.response?.data?.detail || e?.message || "Unknown error" };
  }
}

export function resetTermsLocal() {
  _cache = null;
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

/** Build the payload block we attach to /vendor/apply and /service/apply so
 *  the backend can persist informed consent alongside the application. */
export function buildAcceptancePayload(role) {
  const t = getTermsSync();
  const roleTerms = role === "vendor" ? t.vendor : t.service_provider;
  return {
    accepted_terms: {
      role,
      version: t.version,
      accepted_at: new Date().toISOString(),
      title: roleTerms.title,
    },
  };
}
