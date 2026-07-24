import { useState } from "react";
import { MapPin, Locate, Loader2, AlertCircle } from "lucide-react";

/**
 * Reusable location capture block for the Vendor + Admin product-upload
 * forms and the Checkout address form. Provides:
 *   - "📍 Detect my location" (browser geolocation → Nominatim reverse-geocode)
 *   - PIN, State, District, City, Full address inputs
 *   - Latitude / Longitude (auto-filled after detect; manually editable)
 *   - Delivery radius picker (2/5/10/20/50 km · Entire pincode · Entire district)
 *   - Delivery available toggle
 *
 * Callers pass a `value` object + `onChange(patch)` — this component is
 * uncontrolled internally except for the "detecting…" spinner.
 *
 * Payload shape (matches the backend spec at BACKLOG_BACKEND_SPEC §13):
 *   {
 *     latitude, longitude, pincode, state, district, city, address,
 *     delivery_radius_km: number|null,   // null = pincode-only fallback
 *     delivery_scope: "km"|"pincode"|"district",
 *     delivery_available: boolean
 *   }
 */

export const DELIVERY_RADIUS_OPTIONS = [
  { key: "2km",       label: "Within 2 km",       km: 2,  scope: "km" },
  { key: "5km",       label: "Within 5 km",       km: 5,  scope: "km" },
  { key: "10km",      label: "Within 10 km",      km: 10, scope: "km" },
  { key: "20km",      label: "Within 20 km",      km: 20, scope: "km" },
  { key: "50km",      label: "Within 50 km",      km: 50, scope: "km" },
  { key: "pincode",   label: "Entire pincode",    km: null, scope: "pincode" },
  { key: "district",  label: "Entire district",   km: null, scope: "district" },
];

/** Best-effort reverse geocode via Nominatim (free, no API key, OSM). */
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error("Reverse geocode failed");
  const data = await res.json();
  const a = data.address || {};
  return {
    pincode: a.postcode || "",
    state: a.state || "",
    district: a.state_district || a.county || a.district || "",
    city: a.city || a.town || a.village || a.suburb || "",
    address: data.display_name || "",
  };
}

export default function LocationBlock({ value = {}, onChange, testIdRoot = "loc", includeDelivery = true }) {
  const [detecting, setDetecting] = useState(false);
  const [err, setErr] = useState("");
  const set = (patch) => onChange({ ...value, ...patch });
  const setField = (k) => (e) => set({ [k]: e.target.value });

  const currentRadiusKey = (() => {
    if (value.delivery_scope === "pincode") return "pincode";
    if (value.delivery_scope === "district") return "district";
    const km = Number(value.delivery_radius_km) || 0;
    const match = DELIVERY_RADIUS_OPTIONS.find((o) => o.km === km);
    return match?.key || "5km";
  })();

  const pickRadius = (key) => {
    const opt = DELIVERY_RADIUS_OPTIONS.find((o) => o.key === key);
    if (!opt) return;
    set({ delivery_radius_km: opt.km, delivery_scope: opt.scope });
  };

  const detect = async () => {
    setErr("");
    if (!navigator.geolocation) { setErr("Geolocation not supported by this browser."); return; }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          const patch = { latitude, longitude, gps_accuracy_m: accuracy };
          try {
            const rev = await reverseGeocode(latitude, longitude);
            Object.assign(patch, rev);
          } catch { /* offline / rate-limited — keep coords only */ }
          set(patch);
        } finally { setDetecting(false); }
      },
      (e) => {
        setDetecting(false);
        setErr(e.code === 1 ? "Location permission denied." : "Could not detect location. Please enter manually.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  return (
    <div className="rounded-2xl border border-[color:var(--sc-border)] bg-white p-4 space-y-3" data-testid={testIdRoot}>
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)]">
          <MapPin size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-[color:var(--sc-ink)] text-sm">Location details</div>
          <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Used to match products with nearby customers and verify delivery eligibility.</div>
        </div>
        <button
          type="button"
          onClick={detect}
          disabled={detecting}
          className="sc-btn-outline text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
          data-testid={`${testIdRoot}-detect`}
        >
          {detecting ? <Loader2 className="animate-spin" size={12} /> : <Locate size={12} />}
          {detecting ? "Detecting…" : "Detect my location"}
        </button>
      </div>

      {err && (
        <div className="text-[11px] text-[color:var(--sc-error)] font-semibold bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5" data-testid={`${testIdRoot}-err`}>
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Pincode *</span>
          <input data-testid={`${testIdRoot}-pincode`} inputMode="numeric" maxLength={6} required className="sc-input mt-1" value={value.pincode || ""} onChange={setField("pincode")} placeholder="6-digit PIN" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">State</span>
          <input data-testid={`${testIdRoot}-state`} className="sc-input mt-1" value={value.state || ""} onChange={setField("state")} placeholder="e.g. Tamil Nadu" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">District</span>
          <input data-testid={`${testIdRoot}-district`} className="sc-input mt-1" value={value.district || ""} onChange={setField("district")} placeholder="e.g. Chennai" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">City</span>
          <input data-testid={`${testIdRoot}-city`} className="sc-input mt-1" value={value.city || ""} onChange={setField("city")} placeholder="City / town" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Store / full address</span>
          <textarea data-testid={`${testIdRoot}-address`} className="sc-input mt-1 min-h-[64px]" value={value.address || ""} onChange={setField("address")} placeholder="Shop / flat / area for delivery reference" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Latitude</span>
          <input data-testid={`${testIdRoot}-lat`} className="sc-input mt-1 font-mono text-[13px]" value={value.latitude ?? ""} onChange={setField("latitude")} placeholder="e.g. 13.0827" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Longitude</span>
          <input data-testid={`${testIdRoot}-lng`} className="sc-input mt-1 font-mono text-[13px]" value={value.longitude ?? ""} onChange={setField("longitude")} placeholder="e.g. 80.2707" />
        </label>
      </div>

      {includeDelivery && (
        <>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-1.5">Delivery radius</div>
            <div className="flex flex-wrap gap-1.5" data-testid={`${testIdRoot}-radius`}>
              {DELIVERY_RADIUS_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => pickRadius(o.key)}
                  data-testid={`${testIdRoot}-radius-${o.key}`}
                  className={
                    "text-[11px] font-bold px-3 py-1.5 rounded-full border transition " +
                    (currentRadiusKey === o.key
                      ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]"
                      : "bg-white text-[color:var(--sc-ink)] border-[color:var(--sc-border)] hover:border-[color:var(--sc-primary)]")
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              data-testid={`${testIdRoot}-available`}
              checked={value.delivery_available !== false}
              onChange={(e) => set({ delivery_available: e.target.checked })}
              className="w-4 h-4 accent-[color:var(--sc-primary)]"
            />
            <span className="font-semibold text-[color:var(--sc-ink)]">Delivery available</span>
            <span className="text-[11px] text-[color:var(--sc-ink-muted)]">— uncheck if this product is store-pickup only.</span>
          </label>
        </>
      )}
    </div>
  );
}
