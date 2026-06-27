import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { formatINR } from "@/lib/utils";
import { Heart, ShoppingBag } from "lucide-react";
import { log } from "@/lib/log";

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/me/wishlist");
      setItems(Array.isArray(data) ? data : data?.items || []);
    } catch (error) {
      log.error("Wishlist.load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (p) => {
    setBusyId(p.id);
    try {
      await api.post(`/products/${p.id}/save`, { save: false });
    } catch (error) {
      log.error("Wishlist.remove failed", error);
    } finally {
      setBusyId(null);
      load();
    }
  };

  if (loading) return <Layout title="Wishlist"><Spinner /></Layout>;
  if (items.length === 0) {
    return (
      <Layout title="Wishlist">
        <EmptyState
          icon={Heart}
          title="No saved items yet"
          hint="Tap the heart on any product to save it for later."
          action={<Link to="/shop" className="sc-btn-primary">Browse shop</Link>}
        />
      </Layout>
    );
  }
  return (
    <Layout title="Wishlist">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="wishlist-grid">
        {items.map((p) => (
          <div key={p.id} className="sc-card overflow-hidden flex flex-col" data-testid={`wl-card-${p.id}`}>
            <Link to={`/product/${p.id}`} className="aspect-square bg-[color:var(--sc-accent-light)]">
              {p.image_url && <img alt="" src={p.image_url} className="w-full h-full object-cover" />}
              {!p.image_url && <div className="w-full h-full grid place-items-center text-[color:var(--sc-primary)]"><ShoppingBag size={28} /></div>}
            </Link>
            <div className="p-3 flex-1 flex flex-col">
              <Link to={`/product/${p.id}`} className="text-sm font-semibold line-clamp-2">{p.name}</Link>
              <div className="mt-2 flex items-center justify-between">
                <div className="font-extrabold">{formatINR(p.price)}</div>
                <button
                  data-testid={`wl-remove-${p.id}`}
                  onClick={() => remove(p)}
                  disabled={busyId === p.id}
                  className="w-8 h-8 rounded-lg grid place-items-center bg-rose-50 text-rose-600 hover:bg-rose-100"
                  title="Remove"
                >
                  <Heart size={16} fill="currentColor" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
