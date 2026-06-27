import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import useRazorpayCheckout from "@/hooks/useRazorpayCheckout";
import { formatINR } from "@/lib/utils";
import { CreditCard, Loader2, ShieldCheck, AlertCircle } from "lucide-react";

function AddressForm({ addr, onChange, error }) {
  const set = (k) => (e) => onChange({ ...addr, [k]: e.target.value });
  return (
    <div className="lg:col-span-2 sc-card p-5 space-y-4">
      <div className="font-extrabold text-[color:var(--sc-ink)]">Delivery address</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input data-testid="addr-line" placeholder="Street, house no." value={addr.address} onChange={set("address")} className="sc-input sm:col-span-2" />
        <input data-testid="addr-city" placeholder="City" value={addr.city} onChange={set("city")} className="sc-input" />
        <input data-testid="addr-state" placeholder="State" value={addr.state} onChange={set("state")} className="sc-input" />
        <input data-testid="addr-pincode" placeholder="PIN code" value={addr.pincode} onChange={set("pincode")} className="sc-input" />
      </div>
      {error && (
        <div data-testid="checkout-error" className="text-sm font-semibold text-[color:var(--sc-error)] bg-red-50 border border-red-100 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      <div className="rounded-xl bg-[color:var(--sc-accent-light)] border border-[color:var(--sc-border)] p-3 text-xs flex items-center gap-2 text-[color:var(--sc-primary-700)]">
        <ShieldCheck size={14} /> Secure payment powered by Razorpay
      </div>
    </div>
  );
}

function OrderSummary({ cart, paying, onPay }) {
  return (
    <div className="sc-card p-5 h-fit sticky top-20">
      <div className="font-extrabold text-[color:var(--sc-ink)]">Order summary</div>
      <div className="mt-4 space-y-2 text-sm max-h-64 overflow-y-auto pr-1">
        {cart.items.map((it) => (
          <div key={it.product_id} className="flex justify-between">
            <span className="truncate pr-2">
              {it.name || it.product_name} × {it.qty || 1}
            </span>
            <span className="font-semibold whitespace-nowrap">{formatINR((it.price || 0) * (it.qty || 1))}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-[color:var(--sc-border)] mt-4 pt-3 flex justify-between text-lg">
        <span className="font-extrabold">Total</span>
        <span data-testid="checkout-total" className="font-extrabold text-[color:var(--sc-primary)]">
          {formatINR(cart.total)}
        </span>
      </div>
      <button
        data-testid="checkout-pay"
        onClick={onPay}
        disabled={paying}
        className="sc-btn-primary w-full mt-5 flex items-center justify-center gap-2"
      >
        {paying ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
        {paying ? "Processing…" : `Pay ${formatINR(cart.total)}`}
      </button>
    </div>
  );
}

function pickInitialAddress(user) {
  const a = user?.address || user?.shipping_address || {};
  return {
    address: a.address || "",
    city: a.city || "",
    state: a.state || "",
    pincode: a.pincode || "",
  };
}

export default function Checkout() {
  const { cart, refresh } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [addr, setAddr] = useState(() => pickInitialAddress(user));

  useEffect(() => {
    setAddr(pickInitialAddress(user));
  }, [user]);

  const { pay, paying, error } = useRazorpayCheckout({
    user,
    cart,
    refreshCart: refresh,
    onSuccess: () => nav("/orders?success=1", { replace: true }),
  });

  return (
    <Layout title="Checkout">
      <div className="grid lg:grid-cols-3 gap-5">
        <AddressForm addr={addr} onChange={setAddr} error={error} />
        <OrderSummary cart={cart} paying={paying} onPay={() => pay(addr)} />
      </div>
    </Layout>
  );
}
