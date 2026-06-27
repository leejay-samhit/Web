import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Loader2, Store, Save } from "lucide-react";
import { log } from "@/lib/log";

export default function BecomeVendor() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ shop_name: "", gst_number: "", pan_number: "", bank_name: "", bank_account: "", bank_ifsc: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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
      }
    } catch (error) {
      // Not a vendor yet — that's fine
      log.info && log.info("BecomeVendor.load: not a vendor yet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setBusy(true); setMsg("");
    try {
      await api.post("/vendor/apply", form);
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
      <div className="sc-card p-5 max-w-2xl space-y-3" data-testid="bv-form">
        <div className="flex items-center gap-2 font-extrabold">
          <Store size={18} className="text-[color:var(--sc-primary)]" /> Sell on Slangcart
        </div>
        <input className="sc-input" data-testid="bv-shop" placeholder="Shop name" value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input className="sc-input" data-testid="bv-gst" placeholder="GST number" value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value.toUpperCase() })} />
          <input className="sc-input" data-testid="bv-pan" placeholder="PAN number" value={form.pan_number} onChange={(e) => setForm({ ...form, pan_number: e.target.value.toUpperCase() })} />
        </div>
        <input className="sc-input" data-testid="bv-bank-name" placeholder="Bank name" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input className="sc-input" data-testid="bv-bank-acc" placeholder="Bank account" value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} />
          <input className="sc-input" data-testid="bv-bank-ifsc" placeholder="IFSC" value={form.bank_ifsc} onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value.toUpperCase() })} />
        </div>
        <textarea className="sc-input min-h-[100px]" data-testid="bv-desc" placeholder="What will you sell?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button data-testid="bv-submit" onClick={submit} disabled={busy || !form.shop_name} className="sc-btn-primary inline-flex items-center gap-1.5">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Apply
        </button>
        {msg && <div data-testid="bv-msg" className="text-sm font-semibold text-[color:var(--sc-primary)]">{msg}</div>}
      </div>
    </Layout>
  );
}
