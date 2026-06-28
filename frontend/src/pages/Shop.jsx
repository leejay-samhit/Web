import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import LocationBanner from "@/components/LocationBanner";
import ShopBlock from "@/components/shop/ShopBlock";
import { formatINR } from "@/lib/utils";
import { Search, ShoppingBag, Plus, Check } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useUserLocation } from "@/hooks/useUserLocation";
import { log } from "@/lib/log";

function ProductCard({ p, inCart, busy, onAdd }) {
  return (
    <div className="sc-card overflow-hidden flex flex-col group" data-testid={`product-card-${p.id}`}>
      <Link to={`/product/${p.id}`} className="aspect-square bg-[color:var(--sc-accent-light)] overflow-hidden">
        {p.image_url ? (
          <img alt="" src={p.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full grid place-items-center text-[color:var(--sc-primary)]"><ShoppingBag size={28} /></div>
        )}
      </Link>
      <div className="p-3 flex-1 flex flex-col">
        <Link to={`/product/${p.id}`} className="text-sm font-semibold text-[color:var(--sc-ink)] line-clamp-2">{p.name}</Link>
        {p.brand && <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-0.5">{p.brand}</div>}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="font-extrabold text-[color:var(--sc-ink)]">{formatINR(p.price)}</div>
          <button
            data-testid={`add-cart-${p.id}`}
            onClick={() => onAdd(p)}
            disabled={busy || inCart}
            className={`w-8 h-8 rounded-lg grid place-items-center transition ${inCart ? "bg-[color:var(--sc-success)] text-white" : "bg-[color:var(--sc-primary)] text-white hover:bg-[color:var(--sc-primary-600)]"}`}
            title={inCart ? "In cart" : "Add to cart"}
          >
            {inCart ? <Check size={16} /> : <Plus size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// Robust category match: a product belongs to a category if ANY of its
// category-ish fields matches the active category by id/slug/name.
function productMatchesCat(p, cat) {
  if (!cat) return true;
  const wants = [cat.id, cat.slug, (cat.name || "").toLowerCase()].filter(Boolean);
  const have = [
    p.category_id, p.category, p.category_slug, p.sub_category, p.shop_category_id,
    p.category_name, (p.brand || ""),
  ].map((v) => (v || "").toString().toLowerCase());
  return wants.some((w) => have.includes(String(w).toLowerCase()));
}

export default function Shop() {
  const { cart, add } = useCart();
  const { location } = useUserLocation();
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [activeCat, setActiveCat] = useState(null); // entire category object
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  // Build location-aware query params. Backend may not yet filter by these,
  // but FastAPI ignores unknown params so it's safe to forward — when the
  // nearby-products endpoint ships, this UI works without any change.
  const locParams = useMemo(() => {
    if (!location?.latitude || !location?.longitude) return {};
    return {
      lat: location.latitude,
      lng: location.longitude,
      ...(location.pincode ? { pincode: location.pincode } : {}),
    };
  }, [location?.latitude, location?.longitude, location?.pincode]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [p, c, b] = await Promise.allSettled([
          api.get("/products", { params: { limit: 200, ...locParams } }),
          api.get("/shop-categories"),
          api.get("/shop-layout", { params: { scope: "home", ...locParams } }),
        ]);
        if (!alive) return;
        if (p.status === "fulfilled") setProducts(Array.isArray(p.value.data) ? p.value.data : p.value.data?.items || []);
        if (c.status === "fulfilled") setCats(c.value.data?.items || []);
        if (b.status === "fulfilled") setBlocks(b.value.data?.items || []);
      } catch (e) { log.error("Shop load failed", e); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [locParams]);

  const cartIds = useMemo(() => new Set((cart.items || []).map((i) => i.product_id)), [cart.items]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return products.filter((p) => {
      if (!productMatchesCat(p, activeCat)) return false;
      if (!qq) return true;
      return ((p.name || "").toLowerCase().includes(qq) || (p.brand || "").toLowerCase().includes(qq) || (p.description || "").toLowerCase().includes(qq));
    });
  }, [products, q, activeCat]);

  const addToCart = async (p) => {
    setBusyId(p.id);
    try { await add(p.id, 1); } finally { setBusyId(null); }
  };

  return (
    <Layout title="Shop">
      <div className="space-y-3">
        <LocationBanner />

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

        {/* Shop layout blocks — only when not filtering */}
        {!q && !activeCat && blocks.length > 0 && (
          <div data-testid="shop-blocks">
            {blocks.map((b) => <ShopBlock key={b.id} block={b} allProducts={products} />)}
          </div>
        )}

        {/* Category chips */}
        {cats.length > 0 && (
          <div data-testid="shop-categories" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setActiveCat(null)}
              data-testid="cat-all"
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border ${!activeCat ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white text-[color:var(--sc-ink)] border-[color:var(--sc-border)]"}`}
            >
              All
            </button>
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c)}
                data-testid={`cat-${c.slug || c.id}`}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap ${activeCat?.id === c.id ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white text-[color:var(--sc-ink)] border-[color:var(--sc-border)]"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Products grid */}
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="No products found" hint={activeCat ? `No products in "${activeCat.name}". Try All or a different category.` : "Try a different search."} />
        ) : (
          <div data-testid="products-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} p={p} inCart={cartIds.has(p.id)} busy={busyId === p.id} onAdd={addToCart} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
