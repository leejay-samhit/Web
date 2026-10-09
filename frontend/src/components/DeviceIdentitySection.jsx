import { useState } from "react";
import { Hash, ChevronDown, CheckCircle2, AlertCircle } from "lucide-react";
import { isValidImei } from "@/lib/productMaster";

/**
 * "Device Identity" collapsible section — used by the vendor Add-Product form.
 *
 * Two modes:
 *   • Single (default): one IMEI-1 / IMEI-2 / Serial set for the whole product.
 *   • Track by unit: when toggled on, shows N sets (one per stock unit) so the
 *     POS can later search any individual unit's IMEI / serial. Units are stored
 *     in form.units = [{ imei_1, imei_2, serial_number }].
 *
 * Props: { form, setForm, testIdPrefix? }
 */

function ImeiInput({ label, value, onChange, testId, otherImei, compact }) {
  const digits = String(value || "").replace(/\D/g, "");
  const len = digits.length;
  const luhnOk = len === 15 && isValidImei(digits);
  const duplicate = digits && otherImei && digits === String(otherImei || "").replace(/\D/g, "");

  let feedback = null;
  if (len === 0) feedback = null;
  else if (duplicate) feedback = { kind: "err", text: "IMEI-1 and IMEI-2 cannot be identical" };
  else if (len < 15) feedback = { kind: "err", text: `${len}/15 digits` };
  else if (!luhnOk) feedback = { kind: "err", text: "Failed Luhn checksum" };
  else feedback = { kind: "ok", text: "Valid IMEI (15/15)" };

  return (
    <label className={"text-xs font-semibold text-[color:var(--sc-ink)] block" + (compact ? "" : "")}>
      {label}
      <input
        className="sc-input mt-1 font-mono tracking-wider"
        inputMode="numeric"
        maxLength={15}
        placeholder="15 digits"
        value={digits}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 15))}
        data-testid={testId}
      />
      {feedback && (
        <div
          className={"mt-1 text-[11px] font-semibold flex items-center gap-1 " + (feedback.kind === "ok" ? "text-emerald-700" : "text-rose-600")}
          data-testid={`${testId}-feedback`}
        >
          {feedback.kind === "ok" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          {feedback.text}
        </div>
      )}
    </label>
  );
}

function SerialInput({ value, onChange, testId }) {
  return (
    <label className="text-xs font-semibold text-[color:var(--sc-ink)] block">
      Serial number
      <input
        className="sc-input mt-1 font-mono"
        autoCapitalize="characters"
        placeholder="Optional"
        value={value || ""}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        data-testid={testId}
      />
    </label>
  );
}

export default function DeviceIdentitySection({ form, setForm, testIdPrefix = "vd" }) {
  const units = Array.isArray(form.units) ? form.units : [];
  const trackByUnit = !!form.track_by_unit;
  const hasAny = !!(form.serial_number || form.imei_1 || form.imei_2 || units.some((u) => u.imei_1 || u.imei_2 || u.serial_number));
  const [open, setOpen] = useState(hasAny);

  const qty = Math.max(0, Number(form.stock) || 0);

  // Resize the per-unit list to match the stock quantity (cap at 200 for sanity).
  const syncUnits = (on) => {
    if (!on) { setForm({ ...form, track_by_unit: false }); return; }
    const n = Math.min(qty, 200);
    const next = [...units];
    while (next.length < n) next.push({ imei_1: "", imei_2: "", serial_number: "" });
    next.length = n;
    setForm({ ...form, track_by_unit: true, units: next });
  };

  const updateUnit = (i, patch) => {
    const next = units.map((u, idx) => (idx === i ? { ...u, ...patch } : u));
    setForm({ ...form, units: next });
  };

  return (
    <div className="rounded-xl border border-[color:var(--sc-border)] bg-white overflow-hidden" data-testid={`${testIdPrefix}-device-identity`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-[color:var(--sc-accent-light)]/40"
        data-testid={`${testIdPrefix}-device-identity-toggle`}
      >
        <div className="w-8 h-8 rounded-lg bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)] shrink-0">
          <Hash size={16} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-extrabold text-[color:var(--sc-ink)]">
            Device Identity
            {hasAny && <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-primary)]">filled</span>}
          </div>
          <div className="text-[11px] text-[color:var(--sc-ink-muted)] leading-snug">
            Optional. For phones / branded electronics. IMEIs must be exactly 15 digits and pass the Luhn checksum.
          </div>
        </div>
        <ChevronDown size={16} className={"text-[color:var(--sc-ink-muted)] transition-transform " + (open ? "rotate-180" : "")} />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-[color:var(--sc-border)]">
          <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--sc-ink)] bg-[color:var(--sc-accent-light)]/50 px-3 py-2 rounded-lg">
            <input
              type="checkbox"
              checked={trackByUnit}
              onChange={(e) => syncUnits(e.target.checked)}
              data-testid={`${testIdPrefix}-track-by-unit`}
            />
            Track by unit — capture a separate IMEI / serial for each of the {qty || 0} unit(s)
          </label>

          {!trackByUnit && (
            <div className="space-y-2">
              <SerialInput value={form.serial_number} onChange={(v) => setForm({ ...form, serial_number: v })} testId={`${testIdPrefix}-serial`} />
              <ImeiInput label="IMEI-1" value={form.imei_1} otherImei={form.imei_2} onChange={(v) => setForm({ ...form, imei_1: v })} testId={`${testIdPrefix}-imei1`} />
              <ImeiInput label="IMEI-2 (dual-SIM devices)" value={form.imei_2} otherImei={form.imei_1} onChange={(v) => setForm({ ...form, imei_2: v })} testId={`${testIdPrefix}-imei2`} />
            </div>
          )}

          {trackByUnit && (
            <div className="space-y-2" data-testid={`${testIdPrefix}-units`}>
              {qty === 0 && <div className="text-[11px] text-rose-600">Set a stock quantity first to capture per-unit identities.</div>}
              {units.map((u, i) => (
                <div key={i} className="rounded-lg border border-[color:var(--sc-border)] p-2.5 space-y-2" data-testid={`${testIdPrefix}-unit-${i}`}>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Unit {i + 1}</div>
                  <SerialInput value={u.serial_number} onChange={(v) => updateUnit(i, { serial_number: v })} testId={`${testIdPrefix}-unit-${i}-serial`} />
                  <div className="grid grid-cols-1 gap-2">
                    <ImeiInput label="IMEI-1" value={u.imei_1} otherImei={u.imei_2} onChange={(v) => updateUnit(i, { imei_1: v })} testId={`${testIdPrefix}-unit-${i}-imei1`} />
                    <ImeiInput label="IMEI-2" value={u.imei_2} otherImei={u.imei_1} onChange={(v) => updateUnit(i, { imei_2: v })} testId={`${testIdPrefix}-unit-${i}-imei2`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Shared submit-gate: returns null if OK, or a human-readable reason. */
export function validateDeviceIdentity(form) {
  const { imei_1, imei_2, track_by_unit, units } = form || {};
  const checkPair = (a, b, where) => {
    if (a && !isValidImei(a)) return `IMEI-1 ${where} is not a valid 15-digit IMEI (Luhn failed).`;
    if (b && !isValidImei(b)) return `IMEI-2 ${where} is not a valid 15-digit IMEI (Luhn failed).`;
    if (a && b && String(a).replace(/\D/g, "") === String(b).replace(/\D/g, "")) return `IMEI-1 and IMEI-2 ${where} cannot be identical.`;
    return null;
  };
  if (track_by_unit && Array.isArray(units)) {
    for (let i = 0; i < units.length; i++) {
      const err = checkPair(units[i].imei_1, units[i].imei_2, `(unit ${i + 1})`);
      if (err) return err;
    }
    return null;
  }
  return checkPair(imei_1, imei_2, "");
}
