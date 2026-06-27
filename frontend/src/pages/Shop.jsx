import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { formatINR } from "@/lib/utils";
import { Search, ShoppingBag, Plus, Check } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function Shop() {
  const { cart, add } = useCart();
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [p, c] = await Promise.allSettled([api.get("/products"), api.get("/shop-categories")]);
        if (!alive) return;
        if (p.status === "fulfilled") setProducts(Array.isArray(p.value.data) ? p.value.data : p.value.data?.items || []);
        if (c.status === "fulfilled") setCats(c.value.data?.items || []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const cartIds = useMemo(() => new Set((cart.items || []).map((i) => i.product_id)), [cart.items]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat && (p.category || p.category_id) !== activeCat && p.sub_category !== activeCat) return false;
      if (!qq) return true;
      return (
        (p.name || "").toLowerCase().includes(qq) ||
        (p.brand || "").toLowerCase().includes(qq) ||
        (p.description || "").toLowerCase().includes(qq)
      );
    });
  }, [products, q, activeCat]);

  const addToCart = async (p) => {
    setBusyId(p.id);
    try {
      await add(p.id, 1);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Layout title="Shop">
      <div className="space-y-5">
        {/* Search */}
        <div className="sc-card p-3 flex items-center gap-2">
          <Search size={18} className="text-[color:var(--sc-ink-muted)] ml-1" />
          <input
            data-testid="shop-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, brands…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>

        {/* Categories */}
        {cats.length > 0 && (
          <div data-testid="shop-categories" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setActiveCat(null)}
              data-testid="cat-all"
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
                !activeCat
                  ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]"
                  : "bg-white text-[color:var(--sc-ink)] border-[color:var(--sc-border)]"
              }`}
            >
              All
            </button>
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.slug || c.name || c.id)}
                data-testid={`cat-${c.slug || c.id}`}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap ${
                  activeCat === (c.slug || c.name || c.id)
                    ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]"
                    : "bg-white text-[color:var(--sc-ink)] border-[color:var(--sc-border)]"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Products */}
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="No products found" hint="Try a different search or category." />
        ) : (
          <div data-testid="products-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
            {filtered.map((p) => {
              const inCart = cartIds.has(p.id);
              return (
                <div key={p.id} className="sc-card overflow-hidden flex flex-col group" data-testid={`product-card-${p.id}`}>
                  <Link to={`/product/${p.id}`} className="aspect-square bg-[color:var(--sc-accent-light)] overflow-hidden">
                    {p.image_url ? (
                      <img
alt=""                         src={p.image_url}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[color:var(--sc-primary)]">
                        <ShoppingBag size={28} />
                      </div>
                    )}
                  </Link>
                  <div className="p-3 flex-1 flex flex-col">
                    <Link to={`/product/${p.id}`} className="text-sm font-semibold text-[color:var(--sc-ink)] line-clamp-2">
                      {p.name}
                    </Link>
                    {p.brand && (
                      <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-0.5">{p.brand}</div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="font-extrabold text-[color:var(--sc-ink)]">{formatINR(p.price)}</div>
                      <button
                        data-testid={`add-cart-${p.id}`}
                        onClick={() => addToCart(p)}
                        disabled={busyId === p.id || inCart}
                        className={`w-8 h-8 rounded-lg grid place-items-center transition ${
                          inCart
                            ? "bg-[color:var(--sc-success)] text-white"
                            : "bg-[color:var(--sc-primary)] text-white hover:bg-[color:var(--sc-primary-600)]"
                        }`}
                        title={inCart ? "In cart" : "Add to cart"}
                      >
                        {inCart ? <Check size={16} /> : <Plus size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
