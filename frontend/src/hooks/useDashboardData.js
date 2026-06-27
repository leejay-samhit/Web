import { useEffect, useState } from "react";
import api from "@/lib/api";
import { log } from "@/lib/log";

/**
 * useDashboardData — fetches dashboard, recent orders, and promo banners
 * in parallel. Returns { dash, orders, banners, loading }.
 */
export default function useDashboardData() {
  const [dash, setDash] = useState(null);
  const [orders, setOrders] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [d, o, b] = await Promise.allSettled([
          api.get("/users/me/dashboard"),
          api.get("/orders/me"),
          api.get("/promo-banners"),
        ]);
        if (!alive) return;
        if (d.status === "fulfilled") setDash(d.value.data);
        else log.error("useDashboardData: /users/me/dashboard failed", d.reason);
        if (o.status === "fulfilled") setOrders(Array.isArray(o.value.data) ? o.value.data : []);
        else log.error("useDashboardData: /orders/me failed", o.reason);
        if (b.status === "fulfilled") setBanners(b.value.data?.items || []);
        else log.error("useDashboardData: /promo-banners failed", b.reason);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { dash, orders, banners, loading };
}
