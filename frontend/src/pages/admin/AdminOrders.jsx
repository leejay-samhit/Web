import { useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatINR, formatDateTime } from "@/lib/utils";

const STATUSES = ["placed", "paid", "processing", "shipped", "delivered", "cancelled"];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const { data } = await api.get("/admin/orders", { params });
      setOrders(Array.isArray(data) ? data : data?.items || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [statusFilter]);

  const updateStatus = async (id, status) => {
    setBusy(id);
    try {
      await api.patch(`/admin/orders/${id}/status`, { status });
      load();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Layout title="Admin · Orders">
      <div className="flex gap-2 flex-wrap mb-3">
        <button
          onClick={() => setStatusFilter("")}
          data-testid="ao-filter-all"
          className={`text-xs font-bold px-3 py-1.5 rounded-full border ${!statusFilter ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            data-testid={`ao-filter-${s}`}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border capitalize ${statusFilter === s ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}
          >
            {s}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <div className="sc-card overflow-x-auto" data-testid="ao-table">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr>
                <th className="text-left px-4 py-2.5">Order</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Customer</th>
                <th className="text-left px-4 py-2.5">Total</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5 hidden lg:table-cell">Created</th>
                <th className="text-right px-4 py-2.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-[color:var(--sc-border)]" data-testid={`ao-${o.id}`}>
                  <td className="px-4 py-2.5 font-mono text-xs">{(o.id || "").slice(0, 8)}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell">{o.user_name || o.customer_name || o.user_id?.slice(0, 8)}</td>
                  <td className="px-4 py-2.5 font-extrabold">{formatINR(o.total || o.amount)}</td>
                  <td className="px-4 py-2.5"><span className="sc-chip">{o.status}</span></td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(o.created_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <select
                      data-testid={`ao-status-${o.id}`}
                      disabled={busy === o.id}
                      value={o.status || ""}
                      onChange={(e) => updateStatus(o.id, e.target.value)}
                      className="text-xs border border-[color:var(--sc-border)] rounded-lg px-2 py-1"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No orders.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
