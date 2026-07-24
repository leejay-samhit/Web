import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import { formatINR } from "@/lib/utils";
import { getCashSummary, getStatement, getSettings, toCSV } from "@/lib/vendorSales";
import { Download, Calendar, Banknote } from "lucide-react";

function Row({ label, value, sign = "", isCount = false }) {
  return (
    <div className="flex justify-between py-1 text-sm border-b border-[color:var(--sc-border)] last:border-0">
      <span className="text-[color:var(--sc-ink-muted)]">{label}</span>
      <span className="font-semibold">
        {isCount
          ? Number(value || 0).toLocaleString("en-IN")
          : <>{sign}{formatINR(value || 0)}</>}
      </span>
    </div>
  );
}

export default function VendorCashSummary() {
  const { user } = useAuth();
  const uid = user?.id;
  const settings = useMemo(() => getSettings(uid), [uid]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const summary = useMemo(() => getCashSummary(uid, new Date(date)), [uid, date]);
  const statement = useMemo(() => getStatement(uid, { from, to }), [uid, from, to]);

  const exportStatement = () => {
    const rows = statement.map((i) => ({
      invoice_no: i.invoice_no, date: i.created_at, customer: i.customer?.name || "Walk-in",
      payment: (i.payments || []).map((p) => p.mode_label || p.mode).join("|"),
      amount: i.totals?.grand_total || 0, gst: i.totals?.gst_total || 0, discount: i.totals?.discount_total || 0,
      status: i.status, delta: i.delta, running_balance: i.running_balance,
    }));
    const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `statement_${from}_to_${to}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <Layout title="Vendor · Cash summary">
      <VendorNav />

      {/* ============================ Daily closing ============================ */}
      <div className="sc-card p-5 mb-4" data-testid="cs-daily">
        <div className="flex items-center justify-between mb-3">
          <div className="font-extrabold inline-flex items-center gap-2"><Banknote size={16} /> Daily closing report</div>
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar size={12} className="text-[color:var(--sc-ink-muted)]" />
            <input type="date" data-testid="cs-date" value={date} onChange={(e) => setDate(e.target.value)} className="sc-input text-xs py-1" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6">
          <div>
            <Row label="Opening balance" value={summary.opening_balance} />
            <Row label="Cash sales (+)" value={summary.cash_sales} />
            <Row label="UPI sales" value={summary.upi_sales} />
            <Row label="Card sales" value={summary.card_sales} />
            <Row label="Net banking" value={summary.netbank_sales} />
            <Row label="Wallet sales" value={summary.wallet_sales} />
          </div>
          <div>
            <Row label="Credit sales (pending)" value={summary.credit_sales} />
            <Row label="Total collections" value={summary.total_collections} />
            <Row label="Bills generated" value={summary.bills_count} isCount />
            <Row label="Refunds (−)" value={summary.refunds} sign="-" />
            <div className="flex justify-between py-2 text-base border-t-2 border-[color:var(--sc-primary)] mt-2">
              <span className="font-extrabold">Closing balance</span>
              <span className="font-extrabold text-[color:var(--sc-primary)]" data-testid="cs-closing">{formatINR(summary.closing_balance)}</span>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-[color:var(--sc-ink-muted)] mt-3 italic">
          Closing = Opening + Cash sales − Refunds. This is a vendor business report only and does NOT affect any Slangcart wallet or platform settlement.
        </div>
      </div>

      {/* ============================ Business statement ============================ */}
      <div className="sc-card p-5" data-testid="cs-statement-card">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="font-extrabold flex-1">Business account statement</div>
          <input type="date" data-testid="cs-from" value={from} onChange={(e) => setFrom(e.target.value)} className="sc-input text-xs py-1" />
          <span className="text-xs text-[color:var(--sc-ink-muted)]">to</span>
          <input type="date" data-testid="cs-to" value={to} onChange={(e) => setTo(e.target.value)} className="sc-input text-xs py-1" />
          <button data-testid="cs-export" onClick={exportStatement} className="sc-btn-outline inline-flex items-center gap-1 text-xs"><Download size={12} /> Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="cs-statement">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr>
                <th className="text-left px-3 py-2">Invoice #</th>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-left px-3 py-2">Payment</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-right px-3 py-2">GST</th>
                <th className="text-right px-3 py-2">Discount</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Running balance</th>
              </tr>
            </thead>
            <tbody>
              {statement.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-[color:var(--sc-ink-muted)]">No transactions in this period.</td></tr>
              ) : statement.map((i) => (
                <tr key={i.id} className="border-t border-[color:var(--sc-border)]">
                  <td className="px-3 py-2 font-mono">{i.invoice_no}</td>
                  <td className="px-3 py-2">{i.customer?.name || "Walk-in"}</td>
                  <td className="px-3 py-2">{(i.payments || []).map((p) => p.mode_label || p.mode).join(", ")}</td>
                  <td className="px-3 py-2 text-right font-bold">{formatINR(i.totals?.grand_total)}</td>
                  <td className="px-3 py-2 text-right">{formatINR(i.totals?.gst_total)}</td>
                  <td className="px-3 py-2 text-right">{formatINR(i.totals?.discount_total)}</td>
                  <td className="px-3 py-2 capitalize">{i.status}</td>
                  <td className="px-3 py-2 text-right font-extrabold">{formatINR(i.running_balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-[color:var(--sc-ink-muted)] mt-2 italic">Opening balance from Shop Settings: {formatINR(settings.opening_balance)}</div>
      </div>
    </Layout>
  );
}
