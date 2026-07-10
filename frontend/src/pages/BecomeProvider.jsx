import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Loader2, Wrench, Save, ShieldAlert } from "lucide-react";
import { log } from "@/lib/log";
import TermsAcceptancePanel from "@/components/TermsAcceptancePanel";
import { loadTerms, getServiceProviderTerms, buildAcceptancePayload } from "@/lib/onboardingTerms";

export default function BecomeProvider() {
  const [existing, setExisting] = useState(null);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ service_name: "", service_category: "", category_id: "", pincode: "", charge: 0, description: "", languages: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [terms, setTerms] = useState(getServiceProviderTerms());
  const [agreed, setAgreed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, c] = await Promise.allSettled([api.get("/service/me"), api.get("/services/categories")]);
      if (me.status === "fulfilled") {
        setExisting(me.value.data);
        const e = me.value.data || {};
        if (e?.service_name) {
          setForm({
            service_name: e.service_name || "",
            service_category: e.service_category || "",
            category_id: e.category_id || "",
            pincode: e.pincode || "",
            charge: e.charge || 0,
            description: e.description || "",
            languages: e.languages || "",
          });
          // Existing provider — treat as pre-accepted (they accepted at signup).
          setAgreed(true);
        }
      }
      if (c.status === "fulfilled") setCats(c.value.data?.items || c.value.data || []);
    } catch (error) {
      log.error("BecomeProvider.load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh terms text from admin CMS.
  useEffect(() => {
    let alive = true;
    loadTerms().then((all) => { if (alive) setTerms(all.service_provider); });
    return () => { alive = false; };
  }, []);

  const isUpdate = !!existing?.service_name;
  const canSubmit = !!form.service_name && (isUpdate || agreed);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true); setMsg("");
    try {
      if (isUpdate) {
        await api.patch("/service/me", form);
      } else {
        await api.post("/service/apply", {
          ...form,
          charge: Number(form.charge),
          ...buildAcceptancePayload("service_provider"),
        });
      }
      setMsg(isUpdate ? "Service updated." : "Application submitted! We'll review and notify you.");
      load();
    } catch (error) {
      log.error("BecomeProvider.submit failed", error);
      setMsg(error?.response?.data?.detail || "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Layout title="Become a service provider"><Spinner /></Layout>;

  return (
    <Layout title="Become a service provider">
      <div className="max-w-2xl space-y-4">
        <div className="sc-card p-5 space-y-3" data-testid="bp-form">
          <div className="flex items-center gap-2 font-extrabold">
            <Wrench size={18} className="text-[color:var(--sc-primary)]" />
            {isUpdate ? "Update your service profile" : "Apply"}
          </div>
          <input className="sc-input" data-testid="bp-name" placeholder="Service name (e.g. Plumber on demand)" value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })} />
          {cats.length > 0 ? (
            <select className="sc-input" data-testid="bp-category" value={form.category_id} onChange={(e) => {
              const c = cats.find((x) => (x.id || x._id) === e.target.value);
              setForm({ ...form, category_id: e.target.value, service_category: c?.name || form.service_category });
            }}>
              <option value="">Choose category…</option>
              {cats.map((c) => <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>)}
            </select>
          ) : (
            <input className="sc-input" data-testid="bp-category-text" placeholder="Category" value={form.service_category} onChange={(e) => setForm({ ...form, service_category: e.target.value })} />
          )}
          <div className="grid grid-cols-2 gap-2">
            <input className="sc-input" data-testid="bp-pincode" placeholder="PIN code" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
            <input className="sc-input" data-testid="bp-charge" type="number" placeholder="Charge (₹)" value={form.charge} onChange={(e) => setForm({ ...form, charge: e.target.value })} />
          </div>
          <input className="sc-input" data-testid="bp-languages" placeholder="Languages (comma separated)" value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} />
          <textarea className="sc-input min-h-[100px]" data-testid="bp-desc" placeholder="Describe what you offer…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        {!isUpdate && (
          <TermsAcceptancePanel
            terms={terms}
            accepted={agreed}
            onChange={setAgreed}
            disabled={busy}
            testIdRoot="bp-terms"
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            data-testid="bp-submit"
            onClick={submit}
            disabled={busy || !canSubmit}
            className="sc-btn-primary inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isUpdate ? "Update" : "Apply"}
          </button>
          {!isUpdate && !agreed && (
            <div className="text-[12px] font-semibold text-[color:var(--sc-ink-muted)] inline-flex items-center gap-1.5" data-testid="bp-blocked">
              <ShieldAlert size={13} className="text-amber-600" /> Accept the Service Provider T&amp;C above to enable Apply.
            </div>
          )}
        </div>
        {msg && <div data-testid="bp-msg" className="text-sm font-semibold text-[color:var(--sc-primary)]">{msg}</div>}
      </div>
    </Layout>
  );
}
