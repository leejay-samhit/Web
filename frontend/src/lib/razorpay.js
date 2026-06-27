// Razorpay script loader
let scriptPromise = null;

export function loadRazorpay() {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve(window.Razorpay);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-rzp="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Razorpay));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.dataset.rzp = "1";
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Razorpay SDK"));
    };
    document.body.appendChild(s);
  });

  return scriptPromise;
}
