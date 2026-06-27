import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { token } = useAuth();
  const [cart, setCart] = useState({ items: [], total: 0, count: 0 });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await api.get("/cart");
      setCart(data || { items: [], total: 0, count: 0 });
    } catch (e) {
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
    } catch (_) {}
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (token) refresh();
  }, [token, refresh]);

  return (
    <CartContext.Provider value={{ cart, loading, refresh, add, remove, clear }}>{children}</CartContext.Provider>
  );
}

export const useCart = () => {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart must be inside CartProvider");
  return c;
};
