import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Loader2, Store, Save, ShieldAlert } from "lucide-react";
import { log } from "@/lib/log";
import TermsAcceptancePanel from "@/components/TermsAcceptancePanel";
import { loadTerms, getVendorTerms, buildAcceptancePayload } from "@/lib/onboardingTerms";

export default function BecomeVendor() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ shop_name: "", gst_number: "", pan_number: "", bank_name: "", bank_account: "", bank_ifsc: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [terms, setTerms] = useState(getVendorTerms());
  const [agreed, setAgreed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/vendor/me/stats");
      setMe(data);
      if (data?.vendor) {
        const v = data.vendor;
        setForm({
          shop_name: v.shop_name || "", gst_number: v.gst_number || "", pan_number: v.pan_number || "",
          bank_name: v.bank_name || "", bank_account: v.bank_account || "", bank_ifsc: v.bank_ifsc || "",
          description: v.description || "",
        });
        // Skip re-accepting when we're only editing an existing vendor profile.
        if (v.accepted_terms || v.id) setAgreed(true);
      }
    } catch (error) {
      log.info && log.info("BecomeVendor.load: not a vendor yet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh terms text from admin CMS (backend or localStorage).
  useEffect(() => {
    let alive = true;
    loadTerms().then((all) => { if (alive) setTerms(all.vendor); });
    return () => { alive = false; };
  }, []);

  const isExistingVendor = !!me?.vendor?.id;
  const canSubmit = !!form.shop_name && (isExistingVendor || agreed);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true); setMsg("");
    try {
      const payload = { ...form, ...(isExistingVendor ? {} : buildAcceptancePayload("vendor")) };
      await api.post("/vendor/apply", payload);
      setMsg("Vendor application submitted! We'll review and notify you.");
      load();
    } catch (error) {
      log.error("BecomeVendor.submit failed", error);
      setMsg(error?.response?.data?.detail || "Failed to submit.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Layout title="Become a vendor"><Spinner /></Layout>;

  return (
    <Layout title="Become a vendor">
      <div className="max-w-2xl space-y-4">
        <div className="sc-card p-5 space-y-3" data-testid="bv-form">
          <div className="flex items-center gap-2 font-extrabold">
            <Store size={18} className="text-[color:var(--sc-primary)]" /> Sell on Slangcart
          </div>
          <input className="sc-input" data-testid="bv-shop" placeholder="Shop name" value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="sc-input" data-testid="bv-gst" placeholder="GST number (optional)" value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value.toUpperCase() })} />
            <input className="sc-input" data-testid="bv-pan" placeholder="PAN number" value={form.pan_number} onChange={(e) => setForm({ ...form, pan_number: e.target.value.toUpperCase() })} />
          </div>
          <input className="sc-input" data-testid="bv-bank-name" placeholder="Bank name" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="sc-input" data-testid="bv-bank-acc" placeholder="Bank account" value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} />
            <input className="sc-input" data-testid="bv-bank-ifsc" placeholder="IFSC" value={form.bank_ifsc} onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value.toUpperCase() })} />
          </div>
          <textarea className="sc-input min-h-[100px]" data-testid="bv-desc" placeholder="What will you sell?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        {!isExistingVendor && (
          <TermsAcceptancePanel
            terms={terms}
            accepted={agreed}
            onChange={setAgreed}
            disabled={busy}
            testIdRoot="bv-terms"
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            data-testid="bv-submit"
            onClick={submit}
            disabled={busy || !canSubmit}
            className="sc-btn-primary inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isExistingVendor ? "Update" : "Apply"}
          </button>
          {!isExistingVendor && !agreed && (
            <div className="text-[12px] font-semibold text-[color:var(--sc-ink-muted)] inline-flex items-center gap-1.5" data-testid="bv-blocked">
              <ShieldAlert size={13} className="text-amber-600" /> Accept the Vendor T&amp;C above to enable the Apply button.
            </div>
          )}
        </div>
        {msg && <div data-testid="bv-msg" className="text-sm font-semibold text-[color:var(--sc-primary)]">{msg}</div>}
      </div>
    </Layout>
  );
}
