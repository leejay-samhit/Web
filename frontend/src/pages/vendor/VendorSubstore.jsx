import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import { formatINR } from "@/lib/utils";
import { log } from "@/lib/log";
import api from "@/lib/api";
import {
  Plus, Repeat, Download, CheckCircle2, XCircle, Search, ArrowRight,
  Loader2, Package, Users,
} from "lucide-react";
import {
  loadSubstores, loadTransfers, createTransfer, acceptTransfer, cancelTransfer,
  transferSummary, downloadTransfersCsv,
} from "@/lib/vendorSubstore";

/* -------------------------------------------------------------------------- */
/*  Vendor · Substore transfer ledger                                          */
/*                                                                             */
/*  A "substore" is either a secondary shop under the same GSTIN or a partner  */
/*  vendor exchanging stock. Transfers are logged locally with search by       */
/*  serial / IMEI / product name.                                              */
/* -------------------------------------------------------------------------- */
export default function VendorSubstore() {
  const { user } = useAuth();
  const shopName = user?.vendor?.shop_name || user?.shop_name || "My shop";
  const myEmail = (user?.email || "").toLowerCase();
  // Use `user` (email-keyed) rather than `uid` for cross-account visibility.
  const identity = user;

  const [substores, setSubstores] = useState(() => loadSubstores(identity));
  const [transfers, setTransfers] = useState([]);
  const [received, setReceived] = useState([]);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const list = await loadTransfers(identity);
      setTransfers(list);
      // Derive received products from the same fetched list to avoid a
      // second round trip.
      const me = (identity?.email || "").toLowerCase();
      setReceived(
        list.filter((t) => t.status === "accepted" && (t.to_email || "").toLowerCase() === me)
          .map((t) => ({
            id: `recv-${t.id}`,
            transfer_order_id: t.transfer_order_id,
            name: t.product_name,
            image_url: t.image_url,
            stock: t.qty,
            price: t.unit_price,
            from_email: t.from_email,
          }))
      );
    } catch (e) {
      setLoadError(e?.message || "Could not load transfers.");
    } finally {
      setLoading(false);
    }
  }, [identity]);

  useEffect(() => {
    setSubstores(loadSubstores(identity));
    refresh();
    api.get("/vendor/me/products", { params: { limit: 200 } })
      .then((r) => setProducts(Array.isArray(r.data) ? r.data : r.data?.items || []))
      .catch((e) => log.info?.("VendorSubstore products fetch failed", e?.response?.status));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myEmail]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return transfers;
    return transfers.filter((t) => {
      const bag = [
        t.transfer_order_id, t.product_name, t.sku, t.serial_number, t.imei,
        t.from_email, t.to_email, t.to_name, t.note, t.status,
      ].join(" ").toLowerCase();
      return bag.includes(needle);
    });
  }, [transfers, q]);

  const summary = useMemo(() => transferSummary(filtered), [filtered]);

  const submit = async (payload) => {
    setBusy(true);
    try {
      const rec = await createTransfer(identity, {
        ...payload,
        from_email: myEmail,
        from_name: shopName,
      });
      log.info?.("VendorSubstore.transfer created", rec.transfer_order_id);
      await refresh();
      setShowForm(false);
    } catch (e) {
      alert(e.message || "Could not create transfer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Vendor · Substore transfers">
      <VendorNav />

      {/* Cross-vendor sync banner — backend endpoint now LIVE */}
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 mb-4 flex items-start gap-3 text-sm" data-testid="vst-cross-vendor-warning">
        <CheckCircle2 size={16} className="mt-[2px] shrink-0" />
        <div>
          <div className="font-semibold">Live cross-device sync</div>
          <div className="text-xs mt-0.5">
            Transfers now sync in real time between vendor accounts, even across different browsers and devices. The receiver sees new transfers instantly on refresh; both sender and receiver can accept or cancel from any device they're signed in on.
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 mb-4 text-sm" data-testid="vst-load-error">
          <div className="font-semibold">Couldn't load transfers</div>
          <div className="text-xs mt-0.5">{loadError} — check your connection and try refreshing.</div>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid sm:grid-cols-4 gap-3 mb-4" data-testid="vst-kpis">
        <Kpi label="Total transfers" value={summary.total} />
        <Kpi label="Pending"   value={summary.pending}   tone="amber" />
        <Kpi label="Accepted"  value={summary.accepted}  tone="green" />
        <Kpi label="Total value" value={formatINR(summary.total_value)} tone="primary" />
      </div>

      {/* Received products (accepted transfers where I am the destination) */}
      {received.length > 0 && (
        <div className="sc-card p-4 mb-3" data-testid="vst-received">
          <div className="flex items-center gap-2 mb-2">
            <Package size={16} className="text-emerald-600" />
            <div>
              <div className="font-extrabold text-[color:var(--sc-ink)]">Received via substore transfer</div>
              <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Accepted transfers appear here and in your My Shop products.</div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {received.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg border border-[color:var(--sc-border)] bg-[color:var(--sc-accent-light)]/30" data-testid={`vst-received-${r.id}`}>
                <div className="w-10 h-10 rounded-lg bg-white overflow-hidden shrink-0 grid place-items-center border border-[color:var(--sc-border)]">
                  {r.image_url ? <img alt="" src={r.image_url} className="w-full h-full object-cover" /> : <Package size={16} className="text-[color:var(--sc-primary)]/60" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[color:var(--sc-ink)] truncate">{r.name}</div>
                  <div className="text-[10px] text-[color:var(--sc-ink-muted)] truncate">
                    Qty {r.stock} · {formatINR(r.price)} · from {r.from_email}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="sc-card p-3 mb-3 flex flex-wrap items-center gap-2" data-testid="vst-toolbar">
        <div className="flex-1 min-w-[220px] flex items-center gap-1.5 border border-[color:var(--sc-border)] rounded-lg px-2 py-1">
          <Search size={14} className="text-[color:var(--sc-ink-muted)]" />
          <input
            data-testid="vst-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by transfer #, product, serial, IMEI, substore"
            className="flex-1 text-sm bg-transparent outline-none"
          />
        </div>
        <button
          data-testid="vst-download"
          onClick={() => downloadTransfersCsv(filtered, shopName)}
          disabled={filtered.length === 0}
          className="sc-btn-outline inline-flex items-center gap-1.5 text-sm disabled:opacity-60"
        >
          <Download size={14} /> CSV ({filtered.length})
        </button>
        <button
          data-testid="vst-new"
          onClick={() => setShowForm(true)}
          disabled={substores.length === 0}
          className="sc-btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-60"
        >
          <Plus size={14} /> New transfer
        </button>
      </div>

      {substores.length === 0 && (
        <div className="sc-card p-4 mb-3 text-sm bg-[color:var(--sc-accent-light)]/40" data-testid="vst-no-substores">
          <div className="font-extrabold text-[color:var(--sc-ink)] mb-1 flex items-center gap-1.5"><Users size={14} /> No substores added yet</div>
          <div className="text-[color:var(--sc-ink-muted)] text-[13px]">
            Add substore emails in <b>My Shop → Shop settings → Substores</b> before creating a transfer.
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="sc-card p-8 text-center text-[color:var(--sc-ink-muted)]" data-testid="vst-empty">
          <Repeat size={28} className="mx-auto opacity-40" />
          <div className="mt-2 text-sm">No transfers yet.</div>
          <div className="text-xs mt-1">Create your first stock transfer to a substore to see it here.</div>
        </div>
      ) : (
        <div className="sc-card p-0 overflow-x-auto" data-testid="vst-list">
          <table className="w-full text-xs">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr>
                <th className="text-left px-3 py-2">Transfer #</th>
                <th className="text-left px-3 py-2">When</th>
                <th className="text-left px-3 py-2">Product</th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">Serial / IMEI</th>
                <th className="text-right px-3 py-2">Qty</th>
                <th className="text-right px-3 py-2">Value</th>
                <th className="text-left px-3 py-2">To</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-[color:var(--sc-border)]" data-testid={`vst-row-${t.transfer_order_id}`}>
                  <td className="px-3 py-2 font-mono">{t.transfer_order_id}</td>
                  <td className="px-3 py-2 text-[color:var(--sc-ink-muted)]">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{t.product_name}{t.sku ? <span className="text-[10px] text-[color:var(--sc-ink-muted)]"> · {t.sku}</span> : null}</td>
                  <td className="px-3 py-2 hidden lg:table-cell text-[10px] text-[color:var(--sc-ink-muted)]">
                    {[t.serial_number && `SN ${t.serial_number}`, t.imei && `IMEI ${t.imei}`].filter(Boolean).join(" · ")}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{t.qty}</td>
                  <td className="px-3 py-2 text-right font-extrabold">{formatINR(t.total_value)}</td>
                  <td className="px-3 py-2">{t.to_name || t.to_email}</td>
                  <td className="px-3 py-2">
                    <StatusChip status={t.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {t.status === "pending" && (
                      <div className="inline-flex gap-1.5">
                        <button
                          data-testid={`vst-accept-${t.id}`}
                          onClick={async () => { try { await acceptTransfer(identity, t.id); await refresh(); } catch (e) { alert(e.message); } }}
                          title="Accept as destination substore"
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                        <button
                          data-testid={`vst-cancel-${t.id}`}
                          onClick={async () => { if (window.confirm("Cancel this transfer?")) { try { await cancelTransfer(identity, t.id); await refresh(); } catch (e) { alert(e.message); } } }}
                          title="Cancel"
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <TransferForm
          substores={substores}
          products={products}
          busy={busy}
          onSubmit={submit}
          onClose={() => setShowForm(false)}
        />
      )}
    </Layout>
  );
}

function Kpi({ label, value, tone = "default" }) {
  const cls = tone === "primary" ? "text-[color:var(--sc-primary)]"
    : tone === "green" ? "text-emerald-700"
    : tone === "amber" ? "text-amber-700"
    : "text-[color:var(--sc-ink)]";
  return (
    <div className="sc-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-[color:var(--sc-ink-muted)] font-semibold">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}

function StatusChip({ status }) {
  const map = {
    pending:   { bg: "#FEF3C7", text: "#92400E", label: "Pending" },
    accepted:  { bg: "#DCFCE7", text: "#166534", label: "Accepted" },
    rejected:  { bg: "#FEE2E2", text: "#991B1B", label: "Rejected" },
    cancelled: { bg: "#F1F5F9", text: "#475569", label: "Cancelled" },
  };
  const s = map[status] || { bg: "#F1F5F9", text: "#475569", label: status };
  return <span className="sc-chip" style={{ background: s.bg, color: s.text }}>{s.label}</span>;
}

/* -------------------------------------------------------------------------- */
/*  Transfer form modal                                                        */
/* -------------------------------------------------------------------------- */
function TransferForm({ substores, products = [], busy, onSubmit, onClose }) {
  const [form, setForm] = useState({
    to_substore_id: substores[0]?.id || "",
    product_id: "",
    product_name: "", sku: "", serial_number: "", imei: "", image_url: "",
    qty: 1, unit_price: 0, note: "",
  });
  const chosen = substores.find((s) => s.id === form.to_substore_id);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "number" ? Number(e.target.value || 0) : e.target.value }));

  const pickProduct = (e) => {
    const pid = e.target.value;
    if (!pid) { setForm((f) => ({ ...f, product_id: "", product_name: "", sku: "", image_url: "" })); return; }
    const p = products.find((x) => (x.id || x._id) === pid);
    if (!p) return;
    setForm((f) => ({
      ...f,
      product_id: pid,
      product_name: p.name || "",
      sku: p.sku || "",
      image_url: p.image_url || p.image || (Array.isArray(p.images) ? p.images[0] : "") || "",
      unit_price: f.unit_price || Number(p.price) || 0,
    }));
  };

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      to_email: chosen?.email || "",
      to_name: chosen?.name || "",
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 space-y-3 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        data-testid="vst-form"
      >
        <div className="font-extrabold text-lg text-[color:var(--sc-ink)] flex items-center gap-2">
          <Package size={18} className="text-[color:var(--sc-primary)]" /> New stock transfer
        </div>

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Destination substore *</span>
          <select data-testid="vst-form-substore" required className="sc-input mt-1" value={form.to_substore_id} onChange={set("to_substore_id")}>
            {substores.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.email}</option>)}
          </select>
        </label>

        <div className="grid sm:grid-cols-2 gap-2">
          {products.length > 0 && (
            <label className="block sm:col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Pick from my shop products</span>
              <select
                data-testid="vst-form-product-picker"
                className="sc-input mt-1"
                value={form.product_id}
                onChange={pickProduct}
              >
                <option value="">— Choose a product from my shop —</option>
                {products.map((p) => {
                  const priceStr = `₹${Number(p.price || 0).toLocaleString("en-IN")}`;
                  return (
                    <option key={p.id || p._id} value={p.id || p._id}>
                      {p.name}{p.sku ? ` · ${p.sku}` : ""} · {priceStr}
                    </option>
                  );
                })}
              </select>
              <span className="text-[10px] text-[color:var(--sc-ink-muted)] italic">Selecting a product auto-fills name, SKU, price and image.</span>
            </label>
          )}
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Product name *</span>
            <input data-testid="vst-form-product" required className="sc-input mt-1" value={form.product_name} onChange={set("product_name")} placeholder="e.g. iPhone 15 Pro 256GB" />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">SKU</span>
            <input data-testid="vst-form-sku" className="sc-input mt-1" value={form.sku} onChange={set("sku")} placeholder="Optional" />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Qty *</span>
            <input data-testid="vst-form-qty" required min={1} type="number" className="sc-input mt-1" value={form.qty} onChange={set("qty")} />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Serial number</span>
            <input data-testid="vst-form-serial" className="sc-input mt-1" value={form.serial_number} onChange={set("serial_number")} placeholder="Optional" />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">IMEI</span>
            <input data-testid="vst-form-imei" className="sc-input mt-1" value={form.imei} onChange={set("imei")} placeholder="Optional" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Unit price (₹)</span>
            <input data-testid="vst-form-price" type="number" className="sc-input mt-1" value={form.unit_price} onChange={set("unit_price")} placeholder="0" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Note</span>
            <textarea data-testid="vst-form-note" className="sc-input mt-1 min-h-[60px]" value={form.note} onChange={set("note")} placeholder="Optional context (loan / sale / return)" />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="sc-btn-outline text-sm">Cancel</button>
          <button data-testid="vst-form-submit" disabled={busy} type="submit" className="sc-btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-60">
            {busy ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} />} Create transfer
          </button>
        </div>
      </form>
    </div>
  );
}
