import { useState } from "react";
import api from "@/lib/api";
import { X, Loader2, ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { log } from "@/lib/log";

export default function WalletTransferModal({ open, onClose, balance, onSuccess }) {
  const [form, setForm] = useState({ recipient: "", amount: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setErr("");
    const n = Number(form.amount);
    if (!form.recipient.trim()) return setErr("Enter a recipient (email or referral code).");
    if (!n || n <= 0) return setErr("Enter a valid amount.");
    if (n > Number(balance || 0)) return setErr("Amount exceeds your wallet balance.");
    setBusy(true);
    try {
      await api.post("/wallet/transfer", { recipient: form.recipient.trim(), amount: n, note: form.note });
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
        setSuccess(false);
        setForm({ recipient: "", amount: "", note: "" });
      }, 1200);
    } catch (error) {
      log.error("WalletTransfer.submit failed", error);
      setErr(error?.response?.data?.detail || "Transfer failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 sc-fade-in" data-testid="wt-modal">
        <div className="flex justify-between items-center mb-3">
          <div className="font-extrabold">Send money</div>
          <button data-testid="wt-close" onClick={onClose}><X size={18} /></button>
        </div>
        {success ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-[color:var(--sc-success)] text-white grid place-items-center mx-auto mb-2">
              <ArrowRight size={20} />
            </div>
            <div className="font-extrabold">Transfer sent!</div>
          </div>
        ) : (
          <>
            <div className="text-xs text-[color:var(--sc-ink-muted)] mb-2">Available: <b>{formatINR(balance)}</b></div>
            <input className="sc-input mb-2" data-testid="wt-recipient" placeholder="Recipient email or code" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
            <input className="sc-input mb-2" data-testid="wt-amount" type="number" placeholder="Amount in ₹" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <input className="sc-input mb-2" data-testid="wt-note" placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            {err && <div data-testid="wt-err" className="text-sm font-semibold text-[color:var(--sc-error)] mb-2">{err}</div>}
            <button data-testid="wt-submit" onClick={submit} disabled={busy} className="sc-btn-primary w-full inline-flex items-center justify-center gap-1.5">
              {busy && <Loader2 size={14} className="animate-spin" />} Send
            </button>
          </>
        )}
      </div>
    </div>
  );
}
