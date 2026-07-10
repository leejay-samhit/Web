import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import useRazorpayCheckout from "@/hooks/useRazorpayCheckout";
import { formatINR } from "@/lib/utils";
import api from "@/lib/api";
import { log } from "@/lib/log";
import {
  CreditCard, Loader2, ShieldCheck, AlertCircle, ShoppingBag,
  Banknote, User, Phone, MapPin, Home, Package, Tag,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Big product-detail list — the "review your order" block on the main pane  */
/* -------------------------------------------------------------------------- */
function ItemsPanel({ cart }) {
  const items = Array.isArray(cart?.items) ? cart.items : [];
  if (items.length === 0) return null;
  return (
    <div className="sc-card p-5 space-y-3" data-testid="checkout-items-panel">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)]">
          <Package size={16} />
        </div>
        <div className="flex-1">
          <div className="font-extrabold text-[color:var(--sc-ink)]">
            Review your order · {items.length} {items.length === 1 ? "item" : "items"}
          </div>
          <div className="text-[11px] text-[color:var(--sc-ink-muted)]">
            Confirm the products, quantities and prices below before placing your order.
          </div>
        </div>
      </div>

      <ul className="divide-y divide-[color:var(--sc-border)] -mx-1" data-testid="checkout-items-list">
        {items.map((it) => {
          const qty = Number(it.qty) || 1;
          const price = Number(it.price) || 0;
          const mrp = it.mrp && Number(it.mrp) > price ? Number(it.mrp) : null;
          const rowTotal = price * qty;
          return (
            <li
              key={it.product_id}
              className="py-3 px-1 flex flex-col sm:flex-row sm:items-center gap-3"
              data-testid={`checkout-panel-item-${it.product_id}`}
            >
              {/* Thumbnail */}
              <div className="w-20 h-20 rounded-xl bg-[color:var(--sc-accent-light)] overflow-hidden shrink-0 border border-[color:var(--sc-border)] grid place-items-center">
                {it.image_url ? (
                  <img alt="" src={it.image_url} className="w-full h-full object-cover" />
                ) : (
                  <ShoppingBag size={22} className="text-[color:var(--sc-primary)]/60" />
                )}
              </div>

              {/* Name + meta */}
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-[color:var(--sc-ink)] leading-snug text-[14px] truncate">
                  {it.name || it.product_name || "Product"}
                </div>
                {(it.brand || it.category) && (
                  <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-0.5 flex items-center gap-1 truncate">
                    <Tag size={10} /> {[it.brand, it.category].filter(Boolean).join(" · ")}
                  </div>
                )}
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-[13px] font-extrabold text-[color:var(--sc-primary)]">{formatINR(price)}</span>
                  {mrp && <span className="text-[11px] text-[color:var(--sc-ink-muted)] line-through">{formatINR(mrp)}</span>}
                  {mrp && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
                      {Math.round(((mrp - price) / mrp) * 100)}% off
                    </span>
                  )}
                </div>
              </div>

              {/* Qty */}
              <div className="flex flex-col items-end shrink-0 min-w-[90px]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Qty</div>
                <div className="text-lg font-extrabold text-[color:var(--sc-ink)] leading-none">× {qty}</div>
              </div>

              {/* Line total */}
              <div className="flex flex-col items-end shrink-0 min-w-[100px]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Subtotal</div>
                <div className="text-base font-extrabold text-[color:var(--sc-ink)]">{formatINR(rowTotal)}</div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl bg-[color:var(--sc-accent-light)] border border-[color:var(--sc-border)] p-3 flex items-center justify-between text-sm">
        <div className="font-extrabold text-[color:var(--sc-ink)]">Items subtotal</div>
        <div className="text-lg font-extrabold text-[color:var(--sc-primary)]" data-testid="checkout-panel-subtotal">
          {formatINR(cart.total || 0)}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Address form — matches backend schema (`name`, `phone`, `line1`, …)        */
/* -------------------------------------------------------------------------- */
function AddressForm({ addr, onChange, error }) {
  const set = (k) => (e) => onChange({ ...addr, [k]: e.target.value });
  return (
    <div className="sc-card p-5 space-y-4" data-testid="checkout-address-card">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)]">
          <MapPin size={16} />
        </div>
        <div>
          <div className="font-extrabold text-[color:var(--sc-ink)]">Delivery address</div>
          <div className="text-xs text-[color:var(--sc-ink-muted)]">All fields marked * are required by our courier</div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] flex items-center gap-1"><User size={10} /> Full name *</span>
          <input data-testid="addr-name"     value={addr.name}     onChange={set("name")}     placeholder="e.g. Ramesh Kumar"          className="sc-input mt-1" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] flex items-center gap-1"><Phone size={10} /> Phone *</span>
          <input data-testid="addr-phone"    value={addr.phone}    onChange={set("phone")}    placeholder="10-digit mobile"            className="sc-input mt-1" inputMode="tel" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">PIN code *</span>
          <input data-testid="addr-pincode"  value={addr.pincode}  onChange={set("pincode")}  placeholder="6-digit PIN"                className="sc-input mt-1" inputMode="numeric" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] flex items-center gap-1"><Home size={10} /> Address line 1 *</span>
          <input data-testid="addr-line1"    value={addr.line1}    onChange={set("line1")}    placeholder="House / Flat / Building"    className="sc-input mt-1" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">Address line 2 (landmark, area)</span>
          <input data-testid="addr-line2"    value={addr.line2}    onChange={set("line2")}    placeholder="Landmark, area (optional)"  className="sc-input mt-1" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">City *</span>
          <input data-testid="addr-city"     value={addr.city}     onChange={set("city")}     placeholder="City"                       className="sc-input mt-1" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">State *</span>
          <input data-testid="addr-state"    value={addr.state}    onChange={set("state")}    placeholder="State"                      className="sc-input mt-1" />
        </label>
      </div>
      {error && (
        <div data-testid="checkout-error" className="text-sm font-semibold text-[color:var(--sc-error)] bg-red-50 border border-red-100 rounded-xl px-3 py-2 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}
      <div className="rounded-xl bg-[color:var(--sc-accent-light)] border border-[color:var(--sc-border)] p-3 text-xs flex items-center gap-2 text-[color:var(--sc-primary-700)]">
        <ShieldCheck size={14} /> Secure payment powered by Razorpay · Cash-on-delivery available at checkout
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Payment method picker (Razorpay vs COD)                                    */
/* -------------------------------------------------------------------------- */
function PaymentMethodPicker({ method, onChange }) {
  const opts = [
    { key: "online",  icon: CreditCard, title: "Pay online",       sub: "UPI · Cards · Wallet — powered by Razorpay" },
    { key: "cod",     icon: Banknote,   title: "Cash on delivery", sub: "Pay in cash when the parcel is delivered" },
  ];
  return (
    <div className="sc-card p-5" data-testid="checkout-methods">
      <div className="font-extrabold text-[color:var(--sc-ink)] mb-3">Payment method</div>
      <div className="grid sm:grid-cols-2 gap-2">
        {opts.map((o) => {
          const active = method === o.key;
          return (
            <button
              key={o.key}
              onClick={() => onChange(o.key)}
              type="button"
              data-testid={`checkout-method-${o.key}`}
              className={
                "text-left rounded-xl border-2 p-3 flex items-center gap-3 transition-all " +
                (active
                  ? "border-[color:var(--sc-primary)] bg-[color:var(--sc-accent-light)] shadow-[0_8px_20px_-14px_rgba(15,110,79,0.55)]"
                  : "border-[color:var(--sc-border)] bg-white hover:border-[color:var(--sc-primary)]/40")
              }
            >
              <div className={
                "w-10 h-10 rounded-lg grid place-items-center shrink-0 " +
                (active ? "bg-[color:var(--sc-primary)] text-white" : "bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary)]")
              }>
                <o.icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-sm text-[color:var(--sc-ink)]">{o.title}</div>
                <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{o.sub}</div>
              </div>
              <span
                className={
                  "w-4 h-4 rounded-full border-2 shrink-0 " +
                  (active ? "border-[color:var(--sc-primary)] bg-[color:var(--sc-primary)] ring-4 ring-[color:var(--sc-primary)]/15" : "border-[color:var(--sc-border)]")
                }
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Order summary — now shows product thumbnails (no more blank visual)        */
/* -------------------------------------------------------------------------- */
function OrderSummary({ cart, method, busy, onPay, disabled }) {
  const subtotal = cart.total || 0;
  const label = method === "cod" ? `Place COD order · ${formatINR(subtotal)}` : `Pay ${formatINR(subtotal)}`;
  return (
    <div className="sc-card p-5 h-fit sticky top-20" data-testid="checkout-summary">
      <div className="font-extrabold text-[color:var(--sc-ink)]">Order summary</div>
      <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1" data-testid="checkout-items">
        {cart.items.map((it) => (
          <div key={it.product_id} className="flex items-start gap-3" data-testid={`checkout-item-${it.product_id}`}>
            <div className="w-14 h-14 rounded-xl bg-[color:var(--sc-accent-light)] overflow-hidden shrink-0 border border-[color:var(--sc-border)] grid place-items-center">
              {it.image_url ? (
                <img alt="" src={it.image_url} className="w-full h-full object-cover" />
              ) : (
                <ShoppingBag size={18} className="text-[color:var(--sc-primary)]/60" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[color:var(--sc-ink)] truncate">
                {it.name || it.product_name || "Product"}
              </div>
              <div className="text-[11px] text-[color:var(--sc-ink-muted)]">
                {formatINR(it.price || 0)} × {it.qty || 1}
              </div>
            </div>
            <div className="text-sm font-extrabold whitespace-nowrap">
              {formatINR((it.price || 0) * (it.qty || 1))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[color:var(--sc-border)] mt-4 pt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-[color:var(--sc-ink-muted)]">Items ({cart.count})</span>
          <span className="font-semibold">{formatINR(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[color:var(--sc-ink-muted)]">Shipping</span>
          <span className="font-semibold text-[color:var(--sc-success)]">FREE</span>
        </div>
        <div className="flex justify-between text-lg pt-2 border-t border-dashed border-[color:var(--sc-border)]">
          <span className="font-extrabold">Total</span>
          <span data-testid="checkout-total" className="font-extrabold text-[color:var(--sc-primary)]">
            {formatINR(subtotal)}
          </span>
        </div>
      </div>
      <button
        data-testid="checkout-pay"
        onClick={onPay}
        disabled={busy || disabled || subtotal <= 0}
        className="sc-btn-primary w-full mt-5 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {busy ? <Loader2 className="animate-spin" size={16} /> : (method === "cod" ? <Banknote size={16} /> : <CreditCard size={16} />)}
        {busy ? "Processing…" : label}
      </button>
      <div className="mt-3 text-[10px] text-center text-[color:var(--sc-ink-muted)]">
        By placing this order you agree to Slangcart&apos;s Terms &amp; Refund policy.
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */
function pickInitialAddress(user) {
  const a = user?.address || user?.shipping_address || {};
  return {
    name: a.name || user?.name || "",
    phone: a.phone || user?.phone || user?.mobile || "",
    line1: a.line1 || a.address || "",
    line2: a.line2 || "",
    city: a.city || "",
    state: a.state || "",
    pincode: a.pincode || a.pin || "",
  };
}

function validateAddress(a) {
  if (!a.name?.trim())    return "Please enter the recipient's full name.";
  if (!a.phone?.trim())   return "Please enter a contact phone number.";
  if (!/^\d{10}$/.test((a.phone || "").replace(/\D/g, "").slice(-10))) return "Phone number must be 10 digits.";
  if (!a.line1?.trim())   return "Please enter the address (line 1).";
  if (!a.city?.trim())    return "Please enter the city.";
  if (!a.state?.trim())   return "Please enter the state.";
  if (!/^\d{6}$/.test((a.pincode || "").trim())) return "PIN code must be 6 digits.";
  return "";
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */
export default function Checkout() {
  const { cart, refresh } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [addr, setAddr] = useState(() => pickInitialAddress(user));
  const [method, setMethod] = useState("online");
  const [codBusy, setCodBusy] = useState(false);
  const [codError, setCodError] = useState("");

  useEffect(() => { setAddr(pickInitialAddress(user)); }, [user]);

  const { pay, paying, error: rzpError, setError } = useRazorpayCheckout({
    user,
    cart,
    refreshCart: refresh,
    onSuccess: () => nav("/orders?success=1", { replace: true }),
  });

  const handlePay = async () => {
    setCodError("");
    setError?.("");
    const err = validateAddress(addr);
    if (err) {
      if (method === "cod") setCodError(err);
      else setError?.(err);
      return;
    }
    if (method === "online") {
      // Send both the modern (line1/name/phone) and legacy shape so the
      // backend gets what it needs regardless of schema version.
      pay({ ...addr, address: addr.line1 });
      return;
    }
    // COD path — post directly to /orders/checkout with payment_method=cod
    setCodBusy(true);
    try {
      const shipping_address = { ...addr, address: addr.line1 };
      const res = await api.post("/orders/checkout", {
        shipping_address,
        address: shipping_address,
        payment_method: "cod",
        cod: true,
      });
      await refresh?.();
      // Backend returns the created order; navigate to /orders on success.
      const orderId = res?.data?.order?.id || res?.data?.id || "";
      nav(`/orders?success=cod${orderId ? `&order=${orderId}` : ""}`, { replace: true });
    } catch (e) {
      log.error("Checkout.cod failed", e);
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail
                : Array.isArray(detail) ? detail.map((d) => d.msg || d).join(", ")
                : "Could not place COD order. Please try again.";
      setCodError(msg);
    } finally {
      setCodBusy(false);
    }
  };

  const error = codError || rzpError;
  const busy = paying || codBusy;

  return (
    <Layout title="Checkout">
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <ItemsPanel cart={cart} />
          <AddressForm addr={addr} onChange={setAddr} error={error} />
          <PaymentMethodPicker method={method} onChange={setMethod} />
        </div>
        <OrderSummary
          cart={cart}
          method={method}
          busy={busy}
          onPay={handlePay}
          disabled={false}
        />
      </div>
    </Layout>
  );
}
