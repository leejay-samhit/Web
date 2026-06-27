import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { loadRazorpay } from "@/lib/razorpay";
import { formatINR } from "@/lib/utils";
import { CreditCard, Loader2, ShieldCheck, AlertCircle } from "lucide-react";

export default function Checkout() {
  const { cart, refresh } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [addr, setAddr] = useState({ address: "", city: "", state: "", pincode: "" });
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.address || user?.shipping_address) {
      const a = user.address || user.shipping_address || {};
      setAddr({
        address: a.address || "",
        city: a.city || "",
        state: a.state || "",
        pincode: a.pincode || "",
      });
    }
  }, [user]);

  const set = (k) => (e) => setAddr((s) => ({ ...s, [k]: e.target.value }));

  const placeOrder = async () => {
    setError("");
    if (!cart.items || cart.items.length === 0) {
      setError("Your cart is empty.");
      return;
    }
    if (!addr.address || !addr.city || !addr.pincode) {
      setError("Please enter a valid delivery address.");
      return;
    }
    setPaying(true);
    try {
      // Step 1: create checkout/order on server
      const checkoutRes = await api.post("/orders/checkout", { shipping_address: addr, address: addr });
      const order = checkoutRes.data || {};

      // The backend may return either a razorpay order directly or wrap it.
      const razorpayOrder = order.razorpay_order || order.order || order;
      const orderId = razorpayOrder.id || razorpayOrder.order_id || razorpayOrder.razorpay_order_id;
      let amount = razorpayOrder.amount || order.amount || cart.total * 100;
      // Backend may send amount already in paise; if it's near cart.total, convert.
      if (amount < cart.total * 10) amount = Math.round(cart.total * 100);

      // Step 2: pull payment config for key_id and prefill
      const cfgRes = await api.get("/payment/config");
      const cfg = cfgRes.data || {};

      const Razorpay = await loadRazorpay();
      const options = {
        key: cfg.key_id,
        amount,
        currency: razorpayOrder.currency || cfg.currency || "INR",
        name: "Slangcart",
        description: "Order payment",
        order_id: orderId,
        prefill: {
          name: user?.name || cfg.prefill?.name || "",
          email: user?.email || cfg.prefill?.email || "",
          contact: user?.phone || cfg.prefill?.contact || "",
        },
        theme: { color: "#0F6E4F" },
        handler: async (resp) => {
          try {
            await api.post("/payment/verify", {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            await refresh();
            nav("/orders?success=1", { replace: true });
          } catch (e) {
            setError("Payment verification failed. Please contact support.");
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      };

      const rzp = new Razorpay(options);
      rzp.on("payment.failed", async (response) => {
        try {
          await api.post("/payment/failure", { error: response.error });
        } catch (_) {}
        setError(response?.error?.description || "Payment failed.");
        setPaying(false);
      });
      rzp.open();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.detail || "Could not start checkout.");
      setPaying(false);
    }
  };

  return (
    <Layout title="Checkout">
      <div className="grid lg:grid-cols-3 gap-5">
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

        <div className="sc-card p-5 h-fit sticky top-20">
          <div className="font-extrabold text-[color:var(--sc-ink)]">Order summary</div>
          <div className="mt-4 space-y-2 text-sm max-h-64 overflow-y-auto pr-1">
            {cart.items.map((it) => (
              <div key={it.product_id} className="flex justify-between">
                <span className="truncate pr-2">{it.name || it.product_name} × {it.qty || 1}</span>
                <span className="font-semibold whitespace-nowrap">{formatINR((it.price || 0) * (it.qty || 1))}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-[color:var(--sc-border)] mt-4 pt-3 flex justify-between text-lg">
            <span className="font-extrabold">Total</span>
            <span data-testid="checkout-total" className="font-extrabold text-[color:var(--sc-primary)]">{formatINR(cart.total)}</span>
          </div>
          <button
            data-testid="checkout-pay"
            onClick={placeOrder}
            disabled={paying}
            className="sc-btn-primary w-full mt-5 flex items-center justify-center gap-2"
          >
            {paying ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
            {paying ? "Processing…" : `Pay ${formatINR(cart.total)}`}
          </button>
        </div>
      </div>
    </Layout>
  );
}
