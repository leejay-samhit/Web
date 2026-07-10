import { useCallback, useState } from "react";
import api from "@/lib/api";
import { loadRazorpay } from "@/lib/razorpay";
import { log } from "@/lib/log";
import { RZP_THEME_COLOR } from "@/constants/config";

/**
 * Computes the Razorpay amount in paise.
 * The external backend sometimes sends `amount` already in paise and sometimes
 * sends it in rupees. If the value is suspiciously small relative to the cart
 * total, treat it as rupees and convert.
 */
function resolveAmountInPaise(razorpayOrder, fallbackOrder, cartTotal) {
  const a = razorpayOrder.amount || fallbackOrder.amount || cartTotal * 100;
  return a < cartTotal * 10 ? Math.round(cartTotal * 100) : a;
}

/**
 * useRazorpayCheckout — single hook that drives the full checkout flow:
 *   1. POST /orders/checkout to create the server-side order
 *   2. GET  /payment/config for the key_id + prefill
 *   3. Load Razorpay checkout.js and open the modal
 *   4. On success: POST /payment/verify
 *   5. On failure: POST /payment/failure
 */
export default function useRazorpayCheckout({ user, cart, onSuccess, refreshCart }) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const validate = useCallback(
    (address) => {
      if (!cart.items || cart.items.length === 0) {
        setError("Your cart is empty.");
        return false;
      }
      const line1 = address.line1 || address.address;
      if (!address.name || !address.phone || !line1 || !address.city || !address.pincode) {
        setError("Please enter a valid delivery address (name, phone, address, city, PIN).");
        return false;
      }
      return true;
    },
    [cart.items]
  );

  const pay = useCallback(
    async (address) => {
      setError("");
      if (!validate(address)) return;
      setPaying(true);
      try {
        // Normalise the payload so we speak whichever key the backend accepts.
        const shipping_address = {
          name: address.name,
          phone: address.phone,
          line1: address.line1 || address.address,
          line2: address.line2 || "",
          address: address.line1 || address.address, // legacy alias
          city: address.city,
          state: address.state,
          pincode: address.pincode,
        };
        const checkoutRes = await api.post("/orders/checkout", {
          shipping_address,
          address: shipping_address,
          payment_method: "online",
        });
        const order = checkoutRes.data || {};
        const razorpayOrder = order.razorpay_order || order.order || order;
        const orderId = razorpayOrder.id || razorpayOrder.order_id || razorpayOrder.razorpay_order_id;
        const amount = resolveAmountInPaise(razorpayOrder, order, cart.total);

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
          theme: { color: RZP_THEME_COLOR },
          handler: async (resp) => {
            try {
              await api.post("/payment/verify", {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              });
              await refreshCart?.();
              onSuccess?.();
            } catch (verifyError) {
              log.error("useRazorpayCheckout: verify failed", verifyError);
              setError("Payment verification failed. Please contact support.");
            } finally {
              setPaying(false);
            }
          },
          modal: { ondismiss: () => setPaying(false) },
        };

        const rzp = new Razorpay(options);
        rzp.on("payment.failed", async (response) => {
          try {
            await api.post("/payment/failure", { error: response.error });
          } catch (failureError) {
            log.error("useRazorpayCheckout: report failure failed", failureError);
          }
          setError(response?.error?.description || "Payment failed.");
          setPaying(false);
        });
        rzp.open();
      } catch (e) {
        log.error("useRazorpayCheckout.pay failed", e);
        setError(e?.response?.data?.detail || "Could not start checkout.");
        setPaying(false);
      }
    },
    [cart.total, user, onSuccess, refreshCart, validate]
  );

  return { pay, paying, error, setError };
}
