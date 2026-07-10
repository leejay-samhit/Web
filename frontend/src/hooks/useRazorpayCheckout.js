import { useCallback, useState } from "react";
import api from "@/lib/api";
import { loadRazorpay } from "@/lib/razorpay";
import { log } from "@/lib/log";
import { RZP_THEME_COLOR } from "@/constants/config";

/* -------------------------------------------------------------------------- */
/*  Pure helpers — no React state, easy to unit-test                          */
/* -------------------------------------------------------------------------- */

/** Normalise the shipping address so we speak whichever key the backend accepts. */
export function normaliseShippingAddress(a) {
  const line1 = a.line1 || a.address;
  return {
    name: a.name,
    phone: a.phone,
    line1,
    line2: a.line2 || "",
    address: line1, // legacy alias
    city: a.city,
    state: a.state,
    pincode: a.pincode,
  };
}

/** Backend sometimes sends amount in paise, sometimes rupees. Detect and coerce. */
export function resolveAmountInPaise(razorpayOrder, fallbackOrder, cartTotal) {
  const a = razorpayOrder.amount || fallbackOrder.amount || cartTotal * 100;
  return a < cartTotal * 10 ? Math.round(cartTotal * 100) : a;
}

/** Client-side validation of the delivery address. */
export function validateShipping(cart, address) {
  if (!cart.items || cart.items.length === 0) return "Your cart is empty.";
  const line1 = address.line1 || address.address;
  if (!address.name || !address.phone || !line1 || !address.city || !address.pincode) {
    return "Please enter a valid delivery address (name, phone, address, city, PIN).";
  }
  return "";
}

/* -------------------------------------------------------------------------- */
/*  API glue — small, self-contained coroutines                                */
/* -------------------------------------------------------------------------- */

async function createCheckoutOrder(shipping_address) {
  const { data } = await api.post("/orders/checkout", {
    shipping_address,
    address: shipping_address,
    payment_method: "online",
  });
  const razorpayOrder = data?.razorpay_order || data?.order || data || {};
  const orderId =
    razorpayOrder.id || razorpayOrder.order_id || razorpayOrder.razorpay_order_id;
  return { raw: data, razorpayOrder, orderId };
}

async function fetchPaymentConfig() {
  const { data } = await api.get("/payment/config");
  return data || {};
}

async function verifyPayment(resp) {
  await api.post("/payment/verify", {
    razorpay_order_id: resp.razorpay_order_id,
    razorpay_payment_id: resp.razorpay_payment_id,
    razorpay_signature: resp.razorpay_signature,
  });
}

async function reportPaymentFailure(errorPayload) {
  try {
    await api.post("/payment/failure", { error: errorPayload });
  } catch (e) {
    log.error("useRazorpayCheckout: report failure failed", e);
  }
}

/* -------------------------------------------------------------------------- */
/*  Razorpay options builder                                                   */
/* -------------------------------------------------------------------------- */

function buildRazorpayOptions({ cfg, razorpayOrder, amount, orderId, user, onHandler, onDismiss }) {
  return {
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
    theme: { color: RZP_THEME_COLOR },
    handler: onHandler,
    modal: { ondismiss: onDismiss },
  };
}

/* -------------------------------------------------------------------------- */
/*  Main hook — orchestrates the pieces above                                  */
/* -------------------------------------------------------------------------- */
export default function useRazorpayCheckout({ user, cart, onSuccess, refreshCart }) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const pay = useCallback(async (address) => {
    setError("");
    const msg = validateShipping(cart, address);
    if (msg) { setError(msg); return; }
    setPaying(true);

    try {
      const shipping_address = normaliseShippingAddress(address);
      const { raw, razorpayOrder, orderId } = await createCheckoutOrder(shipping_address);
      const amount = resolveAmountInPaise(razorpayOrder, raw, cart.total);
      const cfg = await fetchPaymentConfig();
      const Razorpay = await loadRazorpay();

      const options = buildRazorpayOptions({
        cfg,
        razorpayOrder,
        amount,
        orderId,
        user,
        onHandler: async (resp) => {
          try {
            await verifyPayment(resp);
            await refreshCart?.();
            onSuccess?.();
          } catch (verifyError) {
            log.error("useRazorpayCheckout: verify failed", verifyError);
            setError("Payment verification failed. Please contact support.");
          } finally {
            setPaying(false);
          }
        },
        onDismiss: () => setPaying(false),
      });

      const rzp = new Razorpay(options);
      rzp.on("payment.failed", async (response) => {
        await reportPaymentFailure(response.error);
        setError(response?.error?.description || "Payment failed.");
        setPaying(false);
      });
      rzp.open();
    } catch (e) {
      log.error("useRazorpayCheckout.pay failed", e);
      setError(e?.response?.data?.detail || "Could not start checkout.");
      setPaying(false);
    }
  }, [cart, user, onSuccess, refreshCart]);

  return { pay, paying, error, setError };
}
