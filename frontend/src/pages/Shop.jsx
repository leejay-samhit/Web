import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import LocationBanner from "@/components/LocationBanner";
import { formatINR } from "@/lib/utils";
import { Search, ShoppingBag, Plus, Check } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useUserLocation } from "@/hooks/useUserLocation";
import { log } from "@/lib/log";

function ProductCard({ p, inCart, busy, onAdd }) {
  const price = Number(p.price) || 0;
  const mrp = Number(p.mrp || p.original_price || 0);
  const hasDiscount = mrp && mrp > price;
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const stock = p.stock != null ? Number(p.stock) : null;
  const outOfStock = stock === 0;
  const lowStock = stock != null && stock > 0 && stock <= 5;

  // Backend returns `distance_km` + `deliverable` when the shop grid is
  // filtered by the customer's location (see BACKLOG_BACKEND_SPEC §13).
  // Chips render only when the backend provides those fields.
  const distanceKm = p.distance_km != null ? Number(p.distance_km) : null;
  const deliverable = p.deliverable ?? (p.delivery_available !== false && distanceKm !== null);
  return (
    <div className="sc-card overflow-hidden flex flex-col group hover:shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 transition-all duration-300" data-testid={`product-card-${p.id}`}>
      {/* Hero image with badges */}
      <Link to={`/product/${p.id}`} className="relative aspect-square bg-white overflow-hidden block">
        {p.image_url ? (
          <img alt="" src={p.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full grid place-items-center text-[color:var(--sc-primary)]/40 bg-[color:var(--sc-accent-light)]"><ShoppingBag size={40} /></div>
        )}
        {/* Discount badge */}
        {hasDiscount && (
          <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-1 rounded-md shadow-sm">
            {discountPct}% OFF
          </span>
        )}
        {/* Stock status */}
        {outOfStock ? (
          <span className="absolute top-2 right-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded-md">Sold out</span>
        ) : lowStock ? (
          <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-md">Only {stock} left</span>
        ) : null}
      </Link>

      {/* Body */}
      <div className="p-3 flex-1 flex flex-col">
        {p.brand && <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--sc-primary)]/80">{p.brand}</div>}
        <Link to={`/product/${p.id}`} className="mt-0.5 text-sm font-semibold text-[color:var(--sc-ink)] line-clamp-2 hover:text-[color:var(--sc-primary)]">
          {p.name}
        </Link>

        {/* Price row */}
        <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
          <span className="text-lg font-extrabold text-[color:var(--sc-ink)] leading-none">{formatINR(price)}</span>
          {hasDiscount && <span className="text-[11px] text-[color:var(--sc-ink-muted)] line-through">{formatINR(mrp)}</span>}
        </div>

        {/* Action row (fills the rest of the card) */}
        <div className="mt-3 pt-2 border-t border-dashed border-[color:var(--sc-border)] flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-[color:var(--sc-ink-muted)]">
            {distanceKm != null ? (
              deliverable ? (
                <span className="text-emerald-700">🛵 {distanceKm.toFixed(1)} km · Deliverable</span>
              ) : (
                <span className="text-rose-700">🚫 Not deliverable</span>
              )
            ) : outOfStock ? "Notify me" : "Free delivery"}
          </span>
          <button
            data-testid={`add-cart-${p.id}`}
            onClick={() => onAdd(p)}
            disabled={busy || inCart || outOfStock}
            className={
              "inline-flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-extrabold transition-all " +
              (outOfStock
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : inCart
                  ? "bg-[color:var(--sc-success)] text-white"
                  : "bg-[color:var(--sc-primary)] text-white hover:bg-[color:var(--sc-primary-700)] hover:shadow-md")
            }
            title={inCart ? "In cart" : outOfStock ? "Out of stock" : "Add to cart"}
          >
            {inCart ? <><Check size={13} /> Added</> : <><Plus size={13} /> Add</>}
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
  const { user } = useAuth();
  const { location } = useUserLocation();
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
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
        // Only fetch products + categories — shop-layout is intentionally
        // NOT consumed on web (see business rule 04-Jul-2026).
        const [p, c] = await Promise.allSettled([
          api.get("/products", { params: { limit: 200, ...locParams } }),
          api.get("/shop-categories"),
        ]);
        if (!alive) return;
        if (p.status === "fulfilled") setProducts(Array.isArray(p.value.data) ? p.value.data : p.value.data?.items || []);
        if (c.status === "fulfilled") setCats(c.value.data?.items || []);
      } catch (e) { log.error("Shop load failed", e); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [locParams]);

  const cartIds = useMemo(() => new Set((cart.items || []).map((i) => i.product_id)), [cart.items]);

  // First layer: vendors don't see their own products anywhere in Shop
  // (not in category grid, not in home-page blocks). Admins/users see all.
  const visibleProducts = useMemo(() => {
    const hideOwn = user?.role === "vendor" && user?.id;
    if (!hideOwn) return products;
    return products.filter((p) => !(p.vendor_id && p.vendor_id === user.id));
  }, [products, user?.id, user?.role]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return visibleProducts.filter((p) => {
      if (!productMatchesCat(p, activeCat)) return false;
      if (!qq) return true;
      return ((p.name || "").toLowerCase().includes(qq) || (p.brand || "").toLowerCase().includes(qq) || (p.description || "").toLowerCase().includes(qq));
    });
  }, [visibleProducts, q, activeCat]);

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

        {/* Shop layout blocks intentionally NOT rendered on web — the mobile
            app and web have decoupled shop layouts per business rule
            (04-Jul-2026). Web always shows the category-wise product grid. */}

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
