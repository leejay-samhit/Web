import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import BackendPendingBanner from "@/components/erp/BackendPendingBanner";
import { useAuth } from "@/context/AuthContext";
import { getBusinessProfile, saveBusinessProfile } from "@/lib/erp";
import { toast } from "sonner";
import { Building2, Save } from "lucide-react";

const TYPES = [
  { value: "PROPRIETORSHIP", label: "Proprietorship" },
  { value: "PARTNERSHIP",    label: "Partnership" },
  { value: "LLP",            label: "LLP" },
  { value: "OPC",            label: "One Person Company (OPC)" },
  { value: "PVT_LTD",        label: "Private Limited" },
  { value: "PUB_LTD",        label: "Public Limited" },
  { value: "TRUST",          label: "Trust" },
  { value: "SOCIETY",        label: "Society" },
  { value: "OTHER",          label: "Other" },
];

const SCHEMES = [
  { value: "REGULAR",      label: "Regular" },
  { value: "COMPOSITION",  label: "Composition" },
  { value: "UNREGISTERED", label: "Unregistered" },
];

const STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh",
  "Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha",
  "Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Jammu and Kashmir","Ladakh","Puducherry","Chandigarh","Andaman and Nicobar Islands","Dadra and Nagar Haveli and Daman and Diu","Lakshadweep",
];

const EMPTY = { businessType: "PROPRIETORSHIP", pan: "", gstin: "", gstRegistered: false, gstScheme: "UNREGISTERED", state: "", financialYearStart: "04-01" };

export default function ErpBusinessProfile() {
  const { user } = useAuth();
  const vendorId = user?.id || user?._id || "anon";
  const [profile, setProfile] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getBusinessProfile(vendorId);
      if (p) setProfile({ ...EMPTY, ...p });
      setLoading(false);
    })();
  }, [vendorId]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await saveBusinessProfile(vendorId, profile);
    toast.success("Business profile saved");
    setSaving(false);
  };

  const set = (k, v) => setProfile({ ...profile, [k]: v });
  const inp = "w-full rounded-lg border border-[color:var(--sc-border)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--sc-primary)]/40";

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6" data-testid="erp-business-profile">
        <VendorNav />
        <ErpNav />
        <BackendPendingBanner endpoint="/api/erp/business-profile" note="Locally saved for now." />

        {loading ? (
          <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading…</div>
        ) : (
          <form onSubmit={submit} className="sc-card p-5 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary)] grid place-items-center"><Building2 size={16} /></div>
              <div className="font-extrabold">Business profile</div>
            </div>

            <label className="block">
              <span className="text-xs font-semibold">Business type</span>
              <select value={profile.businessType} onChange={(e) => set("businessType", e.target.value)} className={inp} data-testid="bp-type">
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold">PAN</span>
                <input type="text" value={profile.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} maxLength={10} className={inp} data-testid="bp-pan" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold">GSTIN</span>
                <input type="text" value={profile.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} maxLength={15} className={inp} data-testid="bp-gstin" />
              </label>
              <label className="inline-flex items-center gap-2 mt-2 sm:mt-6">
                <input type="checkbox" checked={profile.gstRegistered} onChange={(e) => set("gstRegistered", e.target.checked)} />
                <span className="text-sm">GST registered</span>
              </label>
              <label className="block">
                <span className="text-xs font-semibold">GST scheme</span>
                <select value={profile.gstScheme} onChange={(e) => set("gstScheme", e.target.value)} className={inp} data-testid="bp-scheme">
                  {SCHEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold">Business state</span>
                <select value={profile.state} onChange={(e) => set("state", e.target.value)} className={inp} data-testid="bp-state">
                  <option value="">Select state</option>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold">Financial year start (MM-DD)</span>
                <input type="text" value={profile.financialYearStart} onChange={(e) => set("financialYearStart", e.target.value)} placeholder="04-01" className={inp} />
              </label>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={saving} className="rounded-full px-5 py-2 bg-[color:var(--sc-primary)] text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-50" data-testid="bp-save">
                <Save size={14} /> {saving ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}
