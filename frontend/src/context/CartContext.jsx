import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { log } from "@/lib/log";

const CartContext = createContext(null);

/**
 * Hydrate cart items with product name / image / price if the backend didn't
 * return them. The external Slangcart backend returns `/cart` as roughly
 * `{ items: [{product_id, qty}], total, count }` without per-item metadata,
 * so we look up any missing product data and merge it in. Results are cached
 * across refreshes so we don't refetch on every re-render.
 */
async function hydrateCartItems(items, productCache) {
  if (!Array.isArray(items) || items.length === 0) return [];
  // Which items still need enrichment?
  const missing = items.filter((it) => {
    if (!it || !it.product_id) return false;
    const hasName = !!(it.name || it.product_name);
    const hasImage = !!(it.image_url || it.image);
    const hasPrice = it.price !== undefined && it.price !== null;
    return !(hasName && hasImage && hasPrice);
  });
  // Fetch each unique missing product (respecting the cache).
  const uniqueIds = [...new Set(missing.map((it) => it.product_id))]
    .filter((id) => !productCache.has(id));
  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const { data } = await api.get(`/products/${id}`);
        productCache.set(id, data || {});
      } catch (e) {
        // Mark as fetched-and-empty so we don't loop.
        productCache.set(id, {});
        log.info?.("CartContext.hydrate: product fetch failed", id, e?.response?.status);
      }
    })
  );
  // Merge cached product info into each cart line.
  return items.map((it) => {
    const p = productCache.get(it.product_id) || {};
    const image_url = it.image_url || it.image || p.image_url || p.image || (Array.isArray(p.images) ? p.images[0] : null);
    return {
      ...it,
      name: it.name || it.product_name || p.name || "Product",
      image_url,
      price: it.price != null ? it.price : (p.price != null ? p.price : 0),
      mrp: it.mrp ?? p.mrp ?? p.original_price ?? null,
      product: it.product || p, // keep the full snapshot for anyone who wants it
    };
  });
}

/** Given (possibly hydrated) items, compute total + count as a safety net if
 *  the backend didn't send them or sent them stale. */
function computeTotals(items) {
  const count = items.reduce((n, it) => n + (Number(it.qty) || 0), 0);
  const total = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  return { count, total };
}

export function CartProvider({ children }) {
  const { token } = useAuth();
  const [cart, setCart] = useState({ items: [], total: 0, count: 0 });
  const [loading, setLoading] = useState(false);
  // Long-lived across refreshes — avoids re-fetching /products/{id} every time
  // the cart is refreshed. Cleared on logout.
  const productCacheRef = useRef(new Map());

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await api.get("/cart");
      const rawItems = Array.isArray(data?.items) ? data.items : [];
      const items = await hydrateCartItems(rawItems, productCacheRef.current);
      // Prefer backend-computed totals, but fall back to client compute if the
      // backend returns them as null / 0 / missing.
      const clientTotals = computeTotals(items);
      const total = data?.total != null && data.total > 0 ? data.total : clientTotals.total;
      const count = data?.count != null && data.count > 0 ? data.count : clientTotals.count;
      setCart({ items, total, count });
    } catch (error) {
      log.error("CartContext.refresh failed", error);
      setCart({ items: [], total: 0, count: 0 });
    } finally {
      setLoading(false);
    }
  }, [token]);

  const add = useCallback(
    async (product_id, qty = 1) => {
      await api.post("/cart/add", { product_id, qty });
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (product_id) => {
      await api.post("/cart/remove", { product_id });
      await refresh();
    },
    [refresh]
  );

  const clear = useCallback(async () => {
    try {
      await api.post("/cart/clear");
    } catch (error) {
      log.error("CartContext.clear failed", error);
    }
    await refresh();
  }, [refresh]);

  // Reset the product cache when the auth token flips (login / logout).
  useEffect(() => {
    productCacheRef.current = new Map();
    if (token) refresh();
    else setCart({ items: [], total: 0, count: 0 });
  }, [token, refresh]);

  const value = useMemo(
    () => ({ cart, loading, refresh, add, remove, clear }),
    [cart, loading, refresh, add, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart must be inside CartProvider");
  return c;
};
