import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import { getSettings, saveSettings, peekNextInvoiceNumber } from "@/lib/vendorSales";
import { Save, CheckCircle2, Info, Receipt } from "lucide-react";

export default function VendorSettings() {
  const { user } = useAuth();
  const uid = user?.id;
  const [form, setForm] = useState(() => getSettings(uid));
  const [savedAt, setSavedAt] = useState(0);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : (e.target.type === "number" ? Number(e.target.value || 0) : e.target.value) }));

  const save = () => {
    saveSettings(uid, form);
    setSavedAt(Date.now());
  };

  const preview = (() => {
    try { return peekNextInvoiceNumber(uid).replace(/^[^-]+-[^-]+-/, `${form.invoice_prefix}-`); }
    catch { return `${form.invoice_prefix}-000001`; }
  })();

  return (
    <Layout title="Vendor · Shop settings">
      <VendorNav />

      <div className="sc-card p-5 max-w-3xl" data-testid="vset-card">
        <div className="font-extrabold mb-1 inline-flex items-center gap-2"><Receipt size={16} /> Invoice format</div>
        <div className="text-xs text-[color:var(--sc-ink-muted)] mb-3">Your invoice number prefix and padding. Counter is per device. The next invoice will be numbered: <b data-testid="vset-preview">{preview}</b></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Invoice prefix</label>
            <input data-testid="vset-prefix" className="sc-input mt-1" value={form.invoice_prefix} onChange={set("invoice_prefix")} placeholder="SLG-INV-2026" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Counter padding (digits)</label>
            <input data-testid="vset-pad" type="number" min={3} max={10} className="sc-input mt-1" value={form.invoice_pad} onChange={set("invoice_pad")} />
          </div>
        </div>

        <div className="font-extrabold mb-1 mt-6">Business details (printed on invoice)</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Business name</label>
            <input data-testid="vset-biz-name" className="sc-input mt-1" value={form.business_name} onChange={set("business_name")} placeholder={user?.name || "My shop"} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Business address</label>
            <input data-testid="vset-biz-address" className="sc-input mt-1" value={form.business_address} onChange={set("business_address")} />
          </div>
          <div>
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Phone</label>
            <input data-testid="vset-biz-phone" className="sc-input mt-1" value={form.business_phone} onChange={set("business_phone")} />
          </div>
          <div>
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Email</label>
            <input data-testid="vset-biz-email" type="email" className="sc-input mt-1" value={form.business_email} onChange={set("business_email")} />
          </div>
          <div>
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">GSTIN</label>
            <input data-testid="vset-biz-gstin" className="sc-input mt-1" value={form.business_gstin} onChange={set("business_gstin")} placeholder="22AAAAA0000A1Z5" />
          </div>
        </div>

        <div className="font-extrabold mb-1 mt-6">POS defaults</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Default GST %</label>
            <input data-testid="vset-gst" type="number" className="sc-input mt-1" value={form.default_gst_pct} onChange={set("default_gst_pct")} />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" data-testid="vset-incl" checked={form.gst_inclusive} onChange={set("gst_inclusive")} /> GST inclusive prices
            </label>
          </div>
          <div>
            <label className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">Opening cash balance (₹)</label>
            <input data-testid="vset-opening" type="number" className="sc-input mt-1" value={form.opening_balance} onChange={set("opening_balance")} />
          </div>
        </div>

        <button data-testid="vset-save" onClick={save} className="sc-btn-primary mt-5 inline-flex items-center gap-1.5"><Save size={14} /> Save settings</button>
        {savedAt > 0 && (
          <div data-testid="vset-saved" className="text-xs font-semibold text-[color:var(--sc-primary)] mt-2 inline-flex items-center gap-1.5"><CheckCircle2 size={12} /> Settings saved on this device.</div>
        )}

        <div className="mt-6 text-[11px] text-[color:var(--sc-ink-muted)] bg-[color:var(--sc-accent-light)]/40 border border-[color:var(--sc-border)] rounded-xl p-3 inline-flex items-start gap-1.5">
          <Info size={12} className="mt-0.5 shrink-0" />
          <span>Sales records are stored on this browser only (no backend yet). Real inventory IS synchronized — every bill decrements stock in your live Slangcart catalog. See <code>/app/memory/SALES_BACKEND_SPEC.md</code> in this repo for the backend endpoints that will move sales to multi-device persistence.</span>
        </div>
      </div>
    </Layout>
  );
}
