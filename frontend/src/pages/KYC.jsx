import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { useAuth } from "@/context/AuthContext";
import { Camera, FileCheck2, Loader2, ShieldCheck } from "lucide-react";
import { log } from "@/lib/log";

function FileField({ label, value, onChange, testid }) {
  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) return alert("File must be under 3 MB");
    const r = new FileReader();
    r.onload = () => onChange(r.result?.toString() || "");
    r.readAsDataURL(f);
  };
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">{label}</span>
      <input type="file" accept="image/*,application/pdf" onChange={onPick} data-testid={testid} className="block mt-1 text-sm" />
      {value && (value.startsWith("data:image/")
        ? <img alt="" src={value} className="mt-2 h-20 rounded-lg border border-[color:var(--sc-border)]" />
        : <div className="mt-2 text-[11px] sc-chip"><FileCheck2 size={12} /> Attached</div>)}
    </label>
  );
}

export default function KYC() {
  const { refreshMe } = useAuth();
  const [data, setData] = useState(null);
  const [extra, setExtra] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ full_name: "", aadhaar: "", pan: "", aadhaar_front: "", aadhaar_back: "", pan_image: "", selfie: "" });
  const [extraForm, setExtraForm] = useState({ cibil_report: "", bank_statement: "", income_proof: "", other: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, e] = await Promise.allSettled([api.get("/users/me/kyc"), api.get("/users/me/additional-docs")]);
      if (k.status === "fulfilled") setData(k.value.data);
      if (e.status === "fulfilled") setExtra(e.value.data);
    } catch (error) {
      log.error("KYC.load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setBusy(true); setMsg("");
    try {
      await api.post("/users/me/kyc", form);
      setMsg("KYC submitted. We'll review within 24 hours.");
      await Promise.all([refreshMe(), load()]);
    } catch (error) {
      log.error("KYC.submit failed", error);
      setMsg(error?.response?.data?.detail || "Submission failed.");
    } finally {
      setBusy(false);
    }
  };

  const submitExtra = async () => {
    setBusy(true); setMsg("");
    try {
      await api.post("/users/me/additional-docs", extraForm);
      setMsg("Additional documents uploaded.");
      load();
    } catch (error) {
      log.error("KYC.submitExtra failed", error);
      setMsg(error?.response?.data?.detail || "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Layout title="KYC"><Spinner /></Layout>;

  const status = data?.status || "not_submitted";
  const submitted = status !== "not_submitted";

  return (
    <Layout title="KYC verification">
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="sc-card p-5 space-y-3" data-testid="kyc-main">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-extrabold"><ShieldCheck size={18} className="text-[color:var(--sc-primary)]" /> KYC</div>
            <span className="sc-chip" data-testid="kyc-status">{status.replace("_", " ")}</span>
          </div>
          <input className="sc-input" data-testid="kyc-name" placeholder="Full name as on Aadhaar" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} disabled={submitted && status !== "rejected"} />
          <input className="sc-input" data-testid="kyc-aadhaar" placeholder="Aadhaar number" value={form.aadhaar} onChange={(e) => setForm({ ...form, aadhaar: e.target.value })} disabled={submitted && status !== "rejected"} />
          <input className="sc-input" data-testid="kyc-pan" placeholder="PAN" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} disabled={submitted && status !== "rejected"} />
          <FileField label="Aadhaar front" value={form.aadhaar_front} onChange={(v) => setForm({ ...form, aadhaar_front: v })} testid="kyc-aadhaar-front" />
          <FileField label="Aadhaar back" value={form.aadhaar_back} onChange={(v) => setForm({ ...form, aadhaar_back: v })} testid="kyc-aadhaar-back" />
          <FileField label="PAN image" value={form.pan_image} onChange={(v) => setForm({ ...form, pan_image: v })} testid="kyc-pan-image" />
          <FileField label="Selfie" value={form.selfie} onChange={(v) => setForm({ ...form, selfie: v })} testid="kyc-selfie" />
          {(!submitted || status === "rejected") ? (
            <button data-testid="kyc-submit" onClick={submit} disabled={busy} className="sc-btn-primary inline-flex items-center gap-1.5">
              {busy && <Loader2 size={14} className="animate-spin" />} Submit KYC
            </button>
          ) : (
            <button data-testid="kyc-submit" disabled className="sc-btn-outline inline-flex items-center gap-1.5 opacity-60 cursor-not-allowed">
              {status === "approved" ? "Already approved" : "Already submitted"}
            </button>
          )}
          {msg && <div data-testid="kyc-msg" className="text-sm font-semibold text-[color:var(--sc-primary)]">{msg}</div>}
        </div>

        <div className="sc-card p-5 space-y-3" data-testid="kyc-extra">
          <div className="font-extrabold flex items-center gap-2"><Camera size={18} className="text-[color:var(--sc-primary)]" /> Additional documents</div>
          <FileField label="CIBIL report" value={extraForm.cibil_report} onChange={(v) => setExtraForm({ ...extraForm, cibil_report: v })} testid="kyc-cibil" />
          <FileField label="Bank statement" value={extraForm.bank_statement} onChange={(v) => setExtraForm({ ...extraForm, bank_statement: v })} testid="kyc-bank" />
          <FileField label="Income proof" value={extraForm.income_proof} onChange={(v) => setExtraForm({ ...extraForm, income_proof: v })} testid="kyc-income" />
          <FileField label="Other" value={extraForm.other} onChange={(v) => setExtraForm({ ...extraForm, other: v })} testid="kyc-other" />
          <button data-testid="kyc-extra-submit" onClick={submitExtra} disabled={busy} className="sc-btn-outline inline-flex items-center gap-1.5">
            {busy && <Loader2 size={14} className="animate-spin" />} Upload additional docs
          </button>
          {extra && <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Last update: {extra?.updated_at || "—"}</div>}
        </div>
      </div>
    </Layout>
  );
}
