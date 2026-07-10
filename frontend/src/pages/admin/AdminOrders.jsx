import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatINR, formatDateTime } from "@/lib/utils";
import { log } from "@/lib/log";
import { Download, Search, ShieldCheck, Eye } from "lucide-react";
import {
  ORDER_STAGES, stageChipClass, stageMeta,
  orderCustomerName, orderCustomerPhone, orderAmount, orderProductName,
  orderVendorName, orderVendorEmail, orderVendorMobile,
  exportOrdersToExcel,
} from "@/lib/orders";

/* -------------------------------------------------------------------------- */
/*  Admin · Orders — READ-ONLY view                                            */
/*                                                                             */
/*  Per business rule (04-Jul-2026): the Vendor now owns order status         */
/*  transitions (packed / shipped / delivered). Admin can only observe and    */
/*  download an Excel report. No "Update status" dropdown here.               */
/* -------------------------------------------------------------------------- */
export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const { data } = await api.get("/admin/orders", { params });
      setOrders(Array.isArray(data) ? data : data?.items || []);
    } catch (error) {
      log.error("AdminOrders.load failed", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((o) => {
      const bag = [
        o.id, orderCustomerName(o), orderCustomerPhone(o), orderProductName(o),
        orderVendorName(o), orderVendorEmail(o), orderVendorMobile(o),
      ].join(" ").toLowerCase();
      return bag.includes(needle);
    });
  }, [orders, q]);

  const download = () => {
    const filename = exportOrdersToExcel(filtered, { role: "admin" });
    log.info?.("AdminOrders.download →", filename);
  };

  return (
    <Layout title="Admin · Orders (read-only)">
      <div className="sc-card p-3 mb-3 flex flex-wrap items-center gap-2" data-testid="ao-toolbar">
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] text-[11px] font-bold" data-testid="ao-readonly-chip">
          <ShieldCheck size={12} /> Read-only · vendors own order stages
        </div>
        <div className="flex-1 min-w-[220px] flex items-center gap-1.5 border border-[color:var(--sc-border)] rounded-lg px-2 py-1">
          <Search size={14} className="text-[color:var(--sc-ink-muted)]" />
          <input
            data-testid="ao-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by user, vendor, product, order ID"
            className="flex-1 text-sm bg-transparent outline-none"
          />
        </div>
        <button
          data-testid="ao-download"
          onClick={download}
          disabled={filtered.length === 0}
          className="sc-btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-60"
        >
          <Download size={14} /> Download Excel ({filtered.length})
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        <button
          onClick={() => setStatusFilter("")}
          data-testid="ao-filter-all"
          className={
            "text-xs font-bold px-3 py-1.5 rounded-full border " +
            (!statusFilter ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]")
          }
        >
          All
        </button>
        {ORDER_STAGES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            data-testid={`ao-filter-${s.key}`}
            className={
              "text-xs font-bold px-3 py-1.5 rounded-full border capitalize " +
              (statusFilter === s.key ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]")
            }
          >
            {s.label}
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
                <th className="text-left px-4 py-2.5 hidden lg:table-cell">Product</th>
                <th className="text-left px-4 py-2.5 hidden xl:table-cell">Vendor</th>
                <th className="text-right px-4 py-2.5">Total</th>
                <th className="text-left px-4 py-2.5">Stage</th>
                <th className="text-left px-4 py-2.5 hidden lg:table-cell">Created</th>
                <th className="text-right px-4 py-2.5">View</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-[color:var(--sc-border)]" data-testid={`ao-${o.id}`}>
                  <td className="px-4 py-2.5 font-mono text-xs">{(o.id || "").slice(0, 8)}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <div className="font-semibold text-[color:var(--sc-ink)]">{orderCustomerName(o) || "—"}</div>
                    <div className="text-[10px] text-[color:var(--sc-ink-muted)]">{orderCustomerPhone(o)}</div>
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell max-w-[220px] truncate">{orderProductName(o) || "—"}</td>
                  <td className="px-4 py-2.5 hidden xl:table-cell">
                    <div className="text-[color:var(--sc-ink)]">{orderVendorName(o) || "—"}</div>
                    <div className="text-[10px] text-[color:var(--sc-ink-muted)]">{orderVendorEmail(o)}</div>
                  </td>
                  <td className="px-4 py-2.5 font-extrabold text-right">{formatINR(orderAmount(o))}</td>
                  <td className="px-4 py-2.5"><span className={stageChipClass(o.status)}>{stageMeta(o.status).label}</span></td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(o.created_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      data-testid={`ao-view-${o.id}`}
                      onClick={() => setDetail(o)}
                      className="text-xs font-semibold text-[color:var(--sc-primary)] inline-flex items-center gap-1 hover:underline"
                    >
                      <Eye size={12} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No orders.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detail && <OrderDetailModal order={detail} onClose={() => setDetail(null)} />}
    </Layout>
  );
}

/* -------------------------------------------------------------------------- */
/*  Read-only order detail modal                                              */
/* -------------------------------------------------------------------------- */
function OrderDetailModal({ order, onClose }) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="ao-detail-modal"
      >
        <div className="px-5 py-3 border-b border-[color:var(--sc-border)] flex items-center justify-between">
          <div>
            <div className="font-extrabold text-[color:var(--sc-ink)]">Order · {(order.id || "").slice(0, 8)}</div>
            <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Placed {formatDateTime(order.created_at)}</div>
          </div>
          <span className={stageChipClass(order.status)}>{stageMeta(order.status).label}</span>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Customer</div>
              <div className="font-semibold text-[color:var(--sc-ink)]">{orderCustomerName(order) || "—"}</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)]">{orderCustomerPhone(order)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Vendor</div>
              <div className="font-semibold text-[color:var(--sc-ink)]">{orderVendorName(order) || "—"}</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)]">{orderVendorEmail(order)}</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)]">{orderVendorMobile(order)}</div>
            </div>
          </div>

          {order.shipping_address && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Shipping address</div>
              <div className="text-xs text-[color:var(--sc-ink)]">
                {[order.shipping_address.line1, order.shipping_address.line2, order.shipping_address.city, order.shipping_address.state, order.shipping_address.pincode].filter(Boolean).join(", ")}
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-2">Items ({items.length})</div>
            <div className="space-y-2">
              {items.length === 0 && <div className="text-xs text-[color:var(--sc-ink-muted)]">No item lines returned by the backend.</div>}
              {items.map((it, i) => (
                <div key={`${it.product_id || it.id || i}`} className="flex items-center justify-between p-2 border border-[color:var(--sc-border)] rounded-lg">
                  <div className="min-w-0 flex-1 truncate">
                    <div className="font-semibold truncate">{it.product_name || it.name || "Product"}</div>
                    <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Qty {it.qty || 1} · {formatINR(it.price || 0)}</div>
                  </div>
                  <div className="font-extrabold ml-2 whitespace-nowrap">{formatINR((it.price || 0) * (it.qty || 1))}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between font-extrabold text-lg border-t border-dashed border-[color:var(--sc-border)] pt-2">
              <span>Total</span>
              <span className="text-[color:var(--sc-primary)]">{formatINR(orderAmount(order))}</span>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[color:var(--sc-border)] text-right">
          <button onClick={onClose} className="sc-btn-outline text-sm" data-testid="ao-detail-close">Close</button>
        </div>
      </div>
    </div>
  );
}
