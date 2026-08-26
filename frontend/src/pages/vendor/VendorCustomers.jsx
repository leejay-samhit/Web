import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import { listCustomers, deleteCustomer, toCSV } from "@/lib/vendorSales";
import { formatINR, formatDateTime } from "@/lib/utils";
import { Search, Download, Trash2, BookUser, Phone, Users } from "lucide-react";

export default function VendorCustomers() {
  const { user } = useAuth();
  const uid = user?.id;
  const [bump, setBump] = useState(0);
  const [q, setQ] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const customers = useMemo(() => listCustomers(uid), [uid, bump]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return customers;
    return customers.filter((c) =>
      [c.name, c.phone, c.gstin, c.address].filter(Boolean).join(" ").toLowerCase().includes(n)
    );
  }, [customers, q]);

  const totalSpent = customers.reduce((s, c) => s + (Number(c.total_spent) || 0), 0);

  const remove = (id) => {
    if (window.confirm("Remove this customer from your book?")) {
      deleteCustomer(uid, id);
      setBump((b) => b + 1);
    }
  };

  const exportCsv = () => {
    const rows = filtered.map((c) => ({
      Name: c.name || "",
      Phone: c.phone || "",
      GSTIN: c.gstin || "",
      Address: c.address || "",
      Visits: c.visits || 1,
      "Total Spent": c.total_spent || 0,
      "First Purchase": formatDateTime(c.created_at) || "",
      "Last Purchase": formatDateTime(c.last_purchase_at) || "",
    }));
    const csv = toCSV(rows.length ? rows : [{ Name: "", Phone: "", GSTIN: "", Address: "", Visits: "", "Total Spent": "", "First Purchase": "", "Last Purchase": "" }]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `customer-book-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <Layout title="Vendor · Customer Book">
      <VendorNav />

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <div className="sc-card p-3 flex items-center gap-2" data-testid="vc-total-customers">
          <div className="w-9 h-9 rounded-xl grid place-items-center bg-[color:var(--sc-primary)] text-white"><Users size={16} /></div>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--sc-ink-muted)]">Customers</div>
            <div className="text-lg font-extrabold">{customers.length}</div>
          </div>
        </div>
        <div className="sc-card p-3 flex items-center gap-2" data-testid="vc-total-spent">
          <div className="w-9 h-9 rounded-xl grid place-items-center bg-amber-500 text-white"><BookUser size={16} /></div>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--sc-ink-muted)]">Lifetime value</div>
            <div className="text-lg font-extrabold">{formatINR(totalSpent)}</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sc-card p-3 mb-3 flex flex-wrap items-center gap-2" data-testid="vc-toolbar">
        <div className="flex-1 min-w-[220px] flex items-center gap-1.5 border border-[color:var(--sc-border)] rounded-lg px-2 py-1">
          <Search size={14} className="text-[color:var(--sc-ink-muted)]" />
          <input
            data-testid="vc-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, GSTIN…"
            className="flex-1 text-sm bg-transparent outline-none"
          />
        </div>
        <button
          data-testid="vc-export"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="sc-btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-60"
        >
          <Download size={14} /> Download CSV ({filtered.length})
        </button>
      </div>

      <div className="sc-card p-0 overflow-x-auto" data-testid="vc-list">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-[color:var(--sc-ink-muted)]" data-testid="vc-empty">
            <BookUser size={28} className="mx-auto opacity-40" />
            <div className="mt-2 text-sm">No customers yet.</div>
            <div className="text-xs mt-1">Every "Named customer" you bill in POS is saved here automatically.</div>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-left px-3 py-2">GSTIN</th>
                <th className="text-center px-3 py-2">Visits</th>
                <th className="text-right px-3 py-2">Total spent</th>
                <th className="text-left px-3 py-2">Last purchase</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-[color:var(--sc-border)]" data-testid={`vc-row-${c.id}`}>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{c.name || "—"}</div>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="text-[11px] text-[color:var(--sc-primary)] inline-flex items-center gap-1 hover:underline">
                        <Phone size={10} /> {c.phone}
                      </a>
                    )}
                    {c.address && <div className="text-[10px] text-[color:var(--sc-ink-muted)] truncate max-w-[200px]">{c.address}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">{c.gstin || "—"}</td>
                  <td className="px-3 py-2 text-center font-semibold">{c.visits || 1}</td>
                  <td className="px-3 py-2 text-right font-extrabold text-[color:var(--sc-primary)]">{formatINR(c.total_spent)}</td>
                  <td className="px-3 py-2 text-[color:var(--sc-ink-muted)]">{formatDateTime(c.last_purchase_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <button data-testid={`vc-del-${c.id}`} onClick={() => remove(c.id)} className="text-[color:var(--sc-error)]"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
