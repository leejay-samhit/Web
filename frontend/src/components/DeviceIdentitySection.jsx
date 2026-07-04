import { useState } from "react";
import { Hash, ChevronDown, CheckCircle2, AlertCircle } from "lucide-react";
import { isValidImei } from "@/lib/productMaster";

/**
 * "Device Identity" collapsible section — used by both the vendor Add-Product
 * form and the admin Add-Product form. All 3 fields are optional so vendors
 * selling non-electronics can leave them blank.
 *
 * Props: { form, setForm, testIdPrefix? } — mutates form.imei_1, form.imei_2,
 *   form.serial_number in place via setForm({...form, key: val}).
 */

function ImeiInput({ label, value, onChange, testId, otherImei }) {
  const digits = String(value || "").replace(/\D/g, "");
  const len = digits.length;
  const luhnOk = len === 15 && isValidImei(digits);
  const duplicate = digits && otherImei && digits === String(otherImei || "").replace(/\D/g, "");

  let feedback = null;
  if (len === 0) {
    feedback = null;
  } else if (duplicate) {
    feedback = { kind: "err", text: "IMEI-1 and IMEI-2 cannot be identical" };
  } else if (len < 15) {
    feedback = { kind: "err", text: `${len}/15 digits` };
  } else if (!luhnOk) {
    feedback = { kind: "err", text: "Failed Luhn checksum" };
  } else {
    feedback = { kind: "ok", text: "Valid IMEI (15/15)" };
  }

  return (
    <label className="text-xs font-semibold text-[color:var(--sc-ink)] block">
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
          className={
            "mt-1 text-[11px] font-semibold flex items-center gap-1 " +
            (feedback.kind === "ok" ? "text-emerald-700" : "text-rose-600")
          }
          data-testid={`${testId}-feedback`}
        >
          {feedback.kind === "ok" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          {feedback.text}
        </div>
      )}
    </label>
  );
}

export default function DeviceIdentitySection({ form, setForm, testIdPrefix = "vd" }) {
  const hasAny = !!(form.serial_number || form.imei_1 || form.imei_2);
  // Auto-expand when any field is populated (edit mode with existing values)
  // or explicit user click; collapsed by default in create mode.
  const [open, setOpen] = useState(hasAny);

  return (
    <div
      className="rounded-xl border border-[color:var(--sc-border)] bg-white overflow-hidden"
      data-testid={`${testIdPrefix}-device-identity`}
    >
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
            {hasAny && (
              <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-primary)]">
                filled
              </span>
            )}
          </div>
          <div className="text-[11px] text-[color:var(--sc-ink-muted)] leading-snug">
            Optional. For phones / branded electronics tracked per unit. IMEIs must be exactly 15 digits and pass the Luhn checksum.
          </div>
        </div>
        <ChevronDown
          size={16}
          className={"text-[color:var(--sc-ink-muted)] transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-[color:var(--sc-border)]">
          <label className="text-xs font-semibold text-[color:var(--sc-ink)] block">
            Serial number
            <input
              className="sc-input mt-1 font-mono"
              autoCapitalize="characters"
              placeholder="Optional"
              value={form.serial_number || ""}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value.toUpperCase() })}
              data-testid={`${testIdPrefix}-serial`}
            />
          </label>
          <ImeiInput
            label="IMEI-1"
            value={form.imei_1}
            otherImei={form.imei_2}
            onChange={(v) => setForm({ ...form, imei_1: v })}
            testId={`${testIdPrefix}-imei1`}
          />
          <ImeiInput
            label="IMEI-2 (dual-SIM devices)"
            value={form.imei_2}
            otherImei={form.imei_1}
            onChange={(v) => setForm({ ...form, imei_2: v })}
            testId={`${testIdPrefix}-imei2`}
          />
        </div>
      )}
    </div>
  );
}

/** Shared submit-gate: returns null if OK, or a human-readable reason. */
export function validateDeviceIdentity({ imei_1, imei_2 }) {
  if (imei_1 && !isValidImei(imei_1)) return "IMEI-1 is not a valid 15-digit IMEI (Luhn failed).";
  if (imei_2 && !isValidImei(imei_2)) return "IMEI-2 is not a valid 15-digit IMEI (Luhn failed).";
  if (imei_1 && imei_2 && String(imei_1).replace(/\D/g, "") === String(imei_2).replace(/\D/g, "")) {
    return "IMEI-1 and IMEI-2 cannot be identical.";
  }
  return null;
}
