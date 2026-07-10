# Slangcart Mobile App · Onboarding T&C — Implementation Spec

**Author:** Slangcart web team · 04-Jul-2026
**Status:** DRAFT — awaiting mobile-app implementation
**Web parity commit:** `TermsAcceptancePanel.jsx`, `AdminOnboardingTerms.jsx`, `onboardingTerms.js`

## TL;DR — what to build

1. Two long-form legal agreements shown **inside** the Vendor onboarding and Service-Provider onboarding flows in the mobile app.
2. Applicant must **scroll to the bottom** of the text and tap **"I Agree"** before the Apply button is enabled.
3. On submit, attach an `accepted_terms` block to the API payload so backend can audit-log the consent.
4. The exact text is admin-editable from the web CMS at `/admin/onboarding-terms` — the app must **fetch the latest text** at onboarding time (see API contract below) with a hardcoded fallback baked in.

The web version already implements all of the above verbatim. Please mirror it in-app.

---

## 1. Where in the app

| Screen | Behaviour |
| ------ | --------- |
| Become a Vendor (existing screen) | Show the **Vendor Declaration & GST Compliance Agreement** panel between the form fields and the Apply button. New applicants must accept. Existing vendors editing their profile skip the gate. |
| Become a Service Provider (existing screen) | Show the **Service Provider Declaration & Compliance Agreement** panel between form fields and Apply. New applicants must accept. Existing providers editing their profile skip the gate. |

Do **not** show the gate on subsequent edits (update flow). Only first-time apply.

---

## 2. UI spec (mirror the web card exactly)

Rounded card, 16 dp padding, elevation 1. Layout, top-to-bottom:

1. **Header strip** (light green bg, `#E8F4ED`)
   - File icon (feather / lucide `file-text`)
   - Title bold: e.g. *"Service Provider Declaration & Compliance Agreement"*
   - Subtitle small grey: *"Please read carefully — you must accept before continuing."*
2. **Scrollable body** (max height ~ 260 dp, scrolls if content overflows)
   - Intro paragraph (single sentence)
   - Numbered ordered list — each clause on its own row with a bold green marker
   - Callout box with dashed border containing:
     - Bold heading (default: *"Declaration"*)
     - Declaration body paragraph
3. **Scroll hint** (only visible if the user hasn't scrolled to the bottom):
   - `↓ Scroll to bottom to enable the "I Agree" checkbox`
   - Tapping this smoothly scrolls to the bottom of the block.
4. **Accept row** — border-top, checkbox + label
   - Checkbox disabled (greyed out) until scroll-to-bottom detected.
   - Label (bold, default): *"I have read, understood and agree to the [Vendor / Service Provider] Declaration & Compliance Agreement."*
   - When checked, show a small green ✓ on the right.

### Gate logic
```pseudocode
scrolledToBottom = (scrollView.contentOffsetY + visibleHeight) >= (contentHeight - 8)
                  OR contentHeight <= visibleHeight  # short content fits without scrolling

canAccept = scrolledToBottom
canSubmit = form.isValid && (isExistingApplicant || accepted)
```

Apply button opacity 60% + disabled when `!canSubmit`. Below the button, when the gate is blocking, show:

> ⚠ *Accept the [Vendor / Service Provider] T&C above to enable the Apply button.*

---

## 3. Default text (v1.0.0, ship as hardcoded fallback)

**Fallback rule:** if `GET /api/admin/settings` doesn't return an `onboarding_terms` key (backend hasn't shipped it yet), the app must use these baked-in strings so the flow never breaks.

### Vendor Declaration & GST Compliance Agreement

**Title:** `Vendor Declaration & GST Compliance Agreement`
**Intro:** `By selecting "I Agree" and registering as a vendor on Slangcart, I declare and agree that:`

**Clauses (numbered, in order):**
1. I confirm that all information provided during registration is true, complete, and accurate.
2. I understand that I am solely responsible for complying with all applicable laws, including GST, income tax, business licensing, and any other statutory requirements.
3. If I am required to obtain GST registration under applicable law, I agree to obtain and maintain a valid GSTIN and update my Slangcart account without delay.
4. If I am currently not GST registered, I declare that I am legally eligible to operate without GST registration. I agree to obtain GST registration immediately if I become legally required to do so.
5. I acknowledge that any incorrect declaration, false information, or failure to comply with tax laws is my sole responsibility.
6. I agree to indemnify and hold Slangcart harmless from any loss, penalty, tax demand, interest, or legal action arising from false information or my failure to comply with applicable laws.
7. I authorize Slangcart to suspend payouts, temporarily restrict my account, or terminate my vendor account if false information or non-compliance is identified.
8. I agree to provide any documents reasonably requested by Slangcart for verification, including PAN, GSTIN (if applicable), bank account details, identity documents, and other business-related documents.
9. I understand that Slangcart operates as a marketplace platform and that I remain responsible for the products I sell, the invoices I issue (where applicable), taxes, product quality, warranties, and customer obligations under applicable law.
10. I confirm that I have read, understood, and agree to these Vendor Terms and Conditions and will comply with all applicable laws while using the Slangcart platform.

**Declaration heading:** `Declaration`
**Declaration body:**
`I hereby declare that the information provided by me is true and correct. I understand that providing false information may result in suspension or termination of my account and may attract legal action under applicable laws.`

**Agree label:**
`I have read, understood and agree to the Vendor Declaration & GST Compliance Agreement.`

### Service Provider Declaration & Compliance Agreement

**Title:** `Service Provider Declaration & Compliance Agreement`
**Intro:** `By selecting "I Agree" and registering as a Service Provider on Slangcart, I declare and agree that:`

**Clauses (numbered, in order):**
1. I confirm that all information provided during registration is true, complete, and accurate.
2. I am solely responsible for complying with all applicable laws, including GST (where applicable), income tax, professional tax, business licenses, registrations, permits, and any other statutory requirements related to my services.
3. If I am required by law to obtain GST registration or any other mandatory registration, I agree to obtain and maintain it and update my Slangcart account without delay.
4. If I am currently not GST registered, I declare that I am legally eligible to provide services without GST registration and will obtain GST registration immediately if it becomes legally mandatory.
5. I am solely responsible for the quality, safety, pricing, execution, warranty, and completion of the services I offer through Slangcart.
6. I agree not to upload false, misleading, illegal, prohibited, or fraudulent service listings.
7. I acknowledge that any incorrect declaration, false information, tax non-compliance, or violation of applicable laws is my sole responsibility.
8. I agree to indemnify and hold Slangcart harmless from any tax demand, penalty, interest, legal claim, loss, or liability arising from my services, incorrect declarations, or failure to comply with applicable laws.
9. I authorize Slangcart to verify my information and to request documents such as PAN, GSTIN (if applicable), Aadhaar or other identity documents, bank account details, business registrations, and any other documents reasonably required for verification.
10. I understand that Slangcart is a marketplace platform that connects customers with independent service providers. Slangcart is not responsible for the services performed by me, and I remain solely responsible for fulfilling my commitments to customers.
11. I agree that Slangcart may suspend payouts, temporarily restrict my account, or permanently terminate my account if false information, fraud, misuse, or non-compliance with applicable laws is identified.
12. I confirm that I have read, understood, and agree to these Service Provider Terms and Conditions and will comply with all applicable laws while using the Slangcart platform.

**Declaration heading:** `Declaration`
**Declaration body:**
`I hereby declare that all information and documents submitted by me are true and correct. I understand that providing false information or violating applicable laws may result in suspension or termination of my account, withholding of payouts where legally permitted, and legal action under applicable laws.`

**Agree label:**
`I have read, understood and agree to the Service Provider Declaration & Compliance Agreement.`

---

## 4. API contract

### 4a. Fetch latest T&C (before onboarding is rendered)

Call the same endpoint the web hits — no separate mobile endpoint needed.

```http
GET /api/admin/settings
Authorization: Bearer <jwt>
```

**Expected response shape (already public / read-only for authenticated users):**
```json
{
  "onboarding_terms": {
    "version": "1.0.0",
    "updated_at": "2026-07-04",
    "vendor": {
      "title": "Vendor Declaration & GST Compliance Agreement",
      "intro": "By selecting \"I Agree\"...",
      "clauses": ["I confirm that all information...", "..."],
      "declaration_heading": "Declaration",
      "declaration_body": "I hereby declare...",
      "agree_label": "I have read, understood..."
    },
    "service_provider": {
      "title": "Service Provider Declaration & Compliance Agreement",
      "intro": "By selecting \"I Agree\"...",
      "clauses": ["I confirm that all information...", "..."],
      "declaration_heading": "Declaration",
      "declaration_body": "I hereby declare...",
      "agree_label": "I have read, understood..."
    }
  }
}
```

**If `onboarding_terms` is missing or null**, fall back to the hardcoded strings in §3.

**Caching:** Cache the response for the current session (in memory) OR AsyncStorage with a 24-hour TTL. Refresh on onboarding-screen mount.

### 4b. Attach acceptance to the apply payloads

**Vendor apply**
```http
POST /api/vendor/apply
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "shop_name": "...",
  "gst_number": "...",
  "pan_number": "...",
  "bank_name": "...",
  "bank_account": "...",
  "bank_ifsc": "...",
  "description": "...",

  "accepted_terms": {
    "role": "vendor",
    "version": "1.0.0",
    "accepted_at": "2026-07-04T18:23:00.000Z",
    "title": "Vendor Declaration & GST Compliance Agreement"
  }
}
```

**Service Provider apply**
```http
POST /api/service/apply

{
  "service_name": "...",
  "service_category": "...",
  "category_id": "...",
  "pincode": "...",
  "charge": 0,
  "description": "...",
  "languages": "...",

  "accepted_terms": {
    "role": "service_provider",
    "version": "1.0.0",
    "accepted_at": "2026-07-04T18:23:00.000Z",
    "title": "Service Provider Declaration & Compliance Agreement"
  }
}
```

The backend team is being asked (see `/app/memory/MONEY_FLOW_BACKEND_SPEC.md`) to persist `accepted_terms` on the vendor / provider record so the consent is auditable.

**Note:** Do **not** attach `accepted_terms` on subsequent edit / patch calls (`PATCH /service/me`, etc.) — only on the initial `POST .../apply`.

---

## 5. Suggested React Native module structure

```
src/
├── screens/
│   ├── BecomeVendorScreen.tsx        # embed <TermsAcceptancePanel />
│   └── BecomeServiceProviderScreen.tsx
├── components/
│   └── TermsAcceptancePanel.tsx      # NEW — reusable, prop-driven
├── lib/
│   ├── onboardingTerms.ts            # NEW — mirrors src/lib/onboardingTerms.js on web
│   └── api.ts                        # existing
```

### `TermsAcceptancePanel.tsx` prop shape
```ts
type TermsBlock = {
  title: string;
  intro: string;
  clauses: string[];
  declaration_heading: string;
  declaration_body: string;
  agree_label: string;
};

interface Props {
  terms: TermsBlock;
  accepted: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}
```

### `onboardingTerms.ts` public API
```ts
export const DEFAULT_TERMS: {
  version: string;
  updated_at: string;
  vendor: TermsBlock;
  service_provider: TermsBlock;
};

export async function loadTerms(): Promise<typeof DEFAULT_TERMS>;
export function getTermsSync(): typeof DEFAULT_TERMS;   // reads AsyncStorage cache + defaults
export function buildAcceptancePayload(role: "vendor" | "service_provider"): {
  accepted_terms: { role: string; version: string; accepted_at: string; title: string };
};
```

The behaviour must mirror `src/lib/onboardingTerms.js` on the web:
- `loadTerms()` calls `GET /api/admin/settings`, deep-merges over `DEFAULT_TERMS`, and caches in AsyncStorage (`slangcart_onboarding_terms`).
- `getTermsSync()` reads AsyncStorage cache → falls back to `DEFAULT_TERMS`.
- `buildAcceptancePayload()` produces the object above using `new Date().toISOString()`.

---

## 6. Analytics (nice-to-have)

Track two events so we can see funnel drop-off:
- `onboarding_terms_viewed` — `{ role, version }`
- `onboarding_terms_accepted` — `{ role, version, time_to_accept_ms }`

---

## 7. QA checklist

- [ ] Fresh vendor applicant sees the Vendor T&C panel; Apply is disabled.
- [ ] Fresh service-provider applicant sees the Service Provider T&C panel; Apply is disabled.
- [ ] Scroll-to-bottom detection works on Android + iOS (WebKit/Fabric).
- [ ] Checkbox only enables after scroll-to-bottom.
- [ ] Apply button only enables after checkbox is ticked (and form is valid).
- [ ] Payload includes `accepted_terms` on first apply (verify via network inspector).
- [ ] Existing vendor / provider editing profile does NOT see the T&C gate.
- [ ] Panel picks up latest wording after admin publishes from web `/admin/onboarding-terms`.
- [ ] Fallback wording renders correctly when `GET /admin/settings` fails or omits `onboarding_terms`.
- [ ] Reduced-motion / accessibility: checkbox + label read out correctly to screen readers.

---

## 8. Reference — web files to mirror

If your mobile dev wants to see the exact reference implementation:
- `frontend/src/components/TermsAcceptancePanel.jsx` — the reusable panel
- `frontend/src/pages/BecomeVendor.jsx` — integration example (vendor)
- `frontend/src/pages/BecomeProvider.jsx` — integration example (service provider)
- `frontend/src/lib/onboardingTerms.js` — data layer + defaults + acceptance payload builder
- `frontend/src/pages/admin/AdminOnboardingTerms.jsx` — admin CMS editor (not needed on mobile)

Ping the web team on any ambiguity — happy to walk you through the reference impl on a call.
