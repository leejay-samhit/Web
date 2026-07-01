import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatINR } from "@/lib/utils";
import {
  ArrowLeft, Check, Heart, Hand, Plus, Minus, ShoppingBag, Tag, Truck, ShieldCheck,
  Star, MapPin, RotateCcw, Award, Zap, ChevronRight, Store, Share2,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { log } from "@/lib/log";

/* ---------- Error card ------------------------------------------------ */

function ProductErrorCard({ error }) {
  return (
    <div data-testid="pd-error" className="sc-card p-10 text-center">
      <ShoppingBag size={44} className="mx-auto text-[color:var(--sc-ink-muted)] opacity-60" />
      <div className="mt-3 font-extrabold text-[color:var(--sc-ink)]">{error || "Product not found"}</div>
      <div className="mt-1 text-sm text-[color:var(--sc-ink-muted)]">The product you&apos;re looking for may have been removed.</div>
      <div className="mt-5">
        <Link to="/shop" className="sc-btn-primary inline-flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back to shop
        </Link>
      </div>
    </div>
  );
}

/* ---------- Gallery --------------------------------------------------- */

function Gallery({ images, name }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState({ on: false, x: 50, y: 50 });
  const list = images.length ? images : [null];
  const src = list[active];

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setZoom((z) => ({ ...z, x, y }));
  };

  return (
    <div className="md:sticky md:top-24 w-full max-w-sm mx-auto md:mx-0 space-y-3" data-testid="pd-gallery">
      <div
        className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-[color:var(--sc-accent-light)] to-white border border-[color:var(--sc-border)]"
        onMouseEnter={() => setZoom((z) => ({ ...z, on: true }))}
        onMouseLeave={() => setZoom((z) => ({ ...z, on: false }))}
        onMouseMove={onMove}
      >
        {src ? (
          <img
            alt={name}
            src={src}
            className="w-full h-full object-contain p-3 transition-transform duration-300"
            style={{
              transform: zoom.on ? `scale(1.5)` : "scale(1)",
              transformOrigin: `${zoom.x}% ${zoom.y}%`,
            }}
            data-testid="pd-image"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-[color:var(--sc-primary)]/40">
            <ShoppingBag size={72} />
          </div>
        )}
        {zoom.on && src && (
          <div className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider bg-white/85 backdrop-blur px-2 py-1 rounded-full text-[color:var(--sc-ink)] shadow-sm">
            Zoom
          </div>
        )}
      </div>
      {list.length > 1 && (
        <div className="grid grid-cols-5 gap-2" data-testid="pd-thumbs">
          {list.map((im, i) => (
            <button
              key={`${im || "none"}-${i}`}
              onClick={() => setActive(i)}
              className={
                "aspect-square rounded-xl overflow-hidden border-2 transition-all " +
                (i === active ? "border-[color:var(--sc-primary)] shadow-[0_4px_14px_-6px_rgba(15,110,79,0.4)]" : "border-[color:var(--sc-border)] opacity-70 hover:opacity-100")
              }
              data-testid={`pd-thumb-${i}`}
            >
              {im ? (
                <img alt="" src={im} className="w-full h-full object-cover bg-white" />
              ) : (
                <div className="w-full h-full grid place-items-center bg-[color:var(--sc-accent-light)]">
                  <ShoppingBag size={16} className="text-[color:var(--sc-primary)]" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Price block ---------------------------------------------- */

function PriceBlock({ price, mrp }) {
  const showMrp = mrp && mrp > price;
  const off = showMrp ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <div className="text-3xl sm:text-4xl font-extrabold text-[color:var(--sc-ink)]" data-testid="pd-price">
          {formatINR(price)}
        </div>
        {showMrp && (
          <>
            <div className="text-base font-semibold text-[color:var(--sc-ink-muted)] line-through" data-testid="pd-mrp">
              {formatINR(mrp)}
            </div>
            <span
              className="inline-flex items-center gap-1 text-xs font-extrabold px-2 py-1 rounded-full bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]"
              data-testid="pd-discount"
            >
              <Zap size={11} /> {off}% OFF
            </span>
          </>
        )}
      </div>
      <div className="mt-0.5 text-[11px] text-[color:var(--sc-ink-muted)]">Inclusive of all taxes</div>
    </div>
  );
}

/* ---------- Stock strip ---------------------------------------------- */

function StockStrip({ stock }) {
  const s = Number(stock ?? 0);
  if (s <= 0) {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold border border-rose-200" data-testid="pd-stock">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Out of stock
      </div>
    );
  }
  if (s <= 5) {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-200" data-testid="pd-stock">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Only {s} left — order soon
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200" data-testid="pd-stock">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> In stock
    </div>
  );
}

/* ---------- Quantity picker ------------------------------------------ */

function QtyPicker({ qty, setQty, max }) {
  const dec = () => setQty(Math.max(1, qty - 1));
  const inc = () => setQty(max ? Math.min(max, qty + 1) : qty + 1);
  return (
    <div className="inline-flex items-center rounded-xl border border-[color:var(--sc-border)] bg-white overflow-hidden" data-testid="pd-qty">
      <button onClick={dec} disabled={qty <= 1} className="w-10 h-10 grid place-items-center hover:bg-[color:var(--sc-accent-light)] disabled:opacity-40" data-testid="pd-qty-dec">
        <Minus size={14} />
      </button>
      <div className="w-10 text-center font-extrabold text-[color:var(--sc-ink)]" data-testid="pd-qty-val">{qty}</div>
      <button onClick={inc} className="w-10 h-10 grid place-items-center hover:bg-[color:var(--sc-accent-light)]" data-testid="pd-qty-inc">
        <Plus size={14} />
      </button>
    </div>
  );
}

/* ---------- Trust chips ---------------------------------------------- */

const TRUST = [
  { icon: Truck, title: "Fast delivery", sub: "Ships within 24h" },
  { icon: RotateCcw, title: "Easy returns", sub: "7-day window" },
  { icon: ShieldCheck, title: "Secure payments", sub: "UPI · Cards · Wallet" },
  { icon: Award, title: "Genuine product", sub: "Verified vendor" },
];

function TrustGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="pd-trust">
      {TRUST.map((t) => (
        <div key={t.title} className="rounded-xl bg-white border border-[color:var(--sc-border)] p-2.5 hover:border-[color:var(--sc-primary)] transition-colors">
          <t.icon size={16} className="text-[color:var(--sc-primary)]" />
          <div className="mt-1.5 text-xs font-extrabold text-[color:var(--sc-ink)] leading-tight">{t.title}</div>
          <div className="text-[10px] text-[color:var(--sc-ink-muted)] mt-0.5 leading-tight">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Tabs (Description / Specs / Box / Vendor) ---------------- */

function DetailsTabs({ product }) {
  const specs = useMemo(() => {
    if (Array.isArray(product.specs)) return product.specs;
    if (product.specs && typeof product.specs === "object") {
      return Object.entries(product.specs).map(([k, v]) => ({ label: k, value: String(v) }));
    }
    return [];
  }, [product.specs]);

  const tabs = [
    { key: "desc", label: "Description", show: !!product.description },
    { key: "specs", label: "Specifications", show: specs.length > 0 },
    { key: "box", label: "What's in the box", show: Array.isArray(product.whats_in_box) && product.whats_in_box.length > 0 },
    { key: "vendor", label: "Sold by", show: !!(product.vendor_name || product.shop_name || product.vendor_id) },
  ].filter((t) => t.show);

  const [tab, setTab] = useState(tabs[0]?.key || "desc");
  useEffect(() => { if (tabs.length && !tabs.find((t) => t.key === tab)) setTab(tabs[0].key); }, [tabs, tab]);

  if (!tabs.length) return null;

  return (
    <div className="mt-10 rounded-3xl bg-white border border-[color:var(--sc-border)] overflow-hidden" data-testid="pd-tabs">
      <div className="flex border-b border-[color:var(--sc-border)] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "px-5 py-4 text-sm font-bold whitespace-nowrap relative " +
              (tab === t.key
                ? "text-[color:var(--sc-primary)]"
                : "text-[color:var(--sc-ink-muted)] hover:text-[color:var(--sc-ink)]")
            }
            data-testid={`pd-tab-${t.key}`}
          >
            {t.label}
            {tab === t.key && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-[color:var(--sc-primary)] rounded-full" />}
          </button>
        ))}
      </div>

      <div className="p-6 sm:p-8">
        {tab === "desc" && (
          <div className="prose max-w-none">
            <p className="text-[15px] text-[color:var(--sc-ink)] leading-relaxed whitespace-pre-line" data-testid="pd-desc">
              {product.description}
            </p>
          </div>
        )}

        {tab === "specs" && (
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3" data-testid="pd-specs">
            {specs.map((s, i) => (
              <div key={`${s.label}-${i}`} className="flex items-start justify-between gap-4 py-2 border-b border-dashed border-[color:var(--sc-border)] last:border-0">
                <dt className="text-sm font-semibold text-[color:var(--sc-ink-muted)]">{s.label}</dt>
                <dd className="text-sm font-bold text-[color:var(--sc-ink)] text-right">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {tab === "box" && (
          <ul className="grid sm:grid-cols-2 gap-2" data-testid="pd-box">
            {product.whats_in_box.map((x, i) => (
              <li key={`${x}-${i}`} className="flex items-start gap-2 rounded-lg bg-[color:var(--sc-accent-light)] p-3">
                <Check size={16} className="text-[color:var(--sc-primary)] mt-0.5 shrink-0" />
                <span className="text-sm font-semibold text-[color:var(--sc-ink)]">{x}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "vendor" && (
          <div className="flex items-start gap-4" data-testid="pd-vendor">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[color:var(--sc-primary)] to-[color:var(--sc-primary-700)] text-white grid place-items-center">
              <Store size={22} />
            </div>
            <div className="flex-1">
              <div className="font-extrabold text-[color:var(--sc-ink)]">
                {product.shop_name || product.vendor_name || "Verified vendor"}
              </div>
              <div className="text-xs text-[color:var(--sc-ink-muted)] mt-0.5 flex items-center gap-1.5">
                <Award size={12} className="text-[color:var(--sc-primary)]" /> Verified seller on Slangcart
              </div>
              {product.vendor_id && (
                <Link
                  to={`/shop?vendor=${product.vendor_id}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--sc-primary)] hover:text-[color:var(--sc-primary-700)]"
                >
                  Visit shop <ChevronRight size={14} />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Product info panel --------------------------------------- */

function ProductInfo({ product, busy, inCart, saved, interested, qty, setQty, onAdd, onBuyNow, onToggleSave, onToggleInterested, onShare }) {
  const rating = Number(product.rating || 0);
  const reviewCount = Number(product.review_count || product.reviews_count || 0);
  const outOfStock = Number(product.stock ?? 1) <= 0;

  return (
    <div className="space-y-4" data-testid="pd-info">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          {product.brand && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <Tag size={11} /> {product.brand}
            </span>
          )}
          {product.category && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-[color:var(--sc-border)] text-[color:var(--sc-ink-muted)]">
              {product.category}
            </span>
          )}
        </div>
        <h1
          data-testid="pd-name"
          className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[color:var(--sc-ink)] mt-2 leading-tight"
        >
          {product.name}
        </h1>
        {rating > 0 && (
          <div className="mt-2 flex items-center gap-3" data-testid="pd-rating">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[color:var(--sc-primary)] text-white text-xs font-bold">
              <Star size={12} fill="currentColor" /> {rating.toFixed(1)}
            </div>
            {reviewCount > 0 && (
              <div className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">
                {reviewCount.toLocaleString("en-IN")} ratings
              </div>
            )}
          </div>
        )}
      </div>

      <PriceBlock price={product.price} mrp={product.mrp || product.original_price} />
      <StockStrip stock={product.stock} />

      {/* Delivery estimator */}
      <div className="rounded-xl bg-white border border-[color:var(--sc-border)] p-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)] shrink-0">
          <MapPin size={16} />
        </div>
        <div className="flex-1 text-sm">
          <div className="font-extrabold text-[color:var(--sc-ink)] text-[13px]">Delivery to your area</div>
          <div className="text-[color:var(--sc-ink-muted)] text-xs mt-0.5">
            Free delivery · Get it in <span className="font-bold text-[color:var(--sc-primary-700)]">2–4 business days</span>
          </div>
        </div>
      </div>

      {/* Qty + CTAs */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-1.5">Quantity</div>
        <div className="flex flex-wrap items-center gap-2">
          <QtyPicker qty={qty} setQty={setQty} max={Number(product.stock) || undefined} />
          <button
            data-testid="pd-add-cart"
            onClick={onAdd}
            disabled={busy || inCart || outOfStock}
            className={
              "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 " +
              (inCart
                ? "bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] border border-[color:var(--sc-primary)]/30"
                : "bg-white border border-[color:var(--sc-primary)] text-[color:var(--sc-primary-700)] hover:bg-[color:var(--sc-accent-light)]")
            }
          >
            {inCart ? <><Check size={14} /> In cart</> : <><Plus size={14} /> Add to cart</>}
          </button>
          <button
            data-testid="pd-buy-now"
            onClick={onBuyNow}
            disabled={busy || outOfStock}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm bg-[color:var(--sc-primary)] text-white shadow-[0_8px_20px_-10px_rgba(15,110,79,0.7)] hover:bg-[color:var(--sc-primary-700)] transition-colors disabled:opacity-60"
          >
            <Zap size={14} /> Buy now
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            data-testid="pd-save"
            onClick={onToggleSave}
            className={
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors " +
              (saved
                ? "bg-rose-50 border-rose-200 text-rose-600"
                : "border-[color:var(--sc-border)] text-[color:var(--sc-ink)] hover:bg-[color:var(--sc-accent-light)]")
            }
          >
            <Heart size={12} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Wishlist"}
          </button>
          <button
            data-testid="pd-interested"
            onClick={onToggleInterested}
            className={
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors " +
              (interested
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "border-[color:var(--sc-border)] text-[color:var(--sc-ink)] hover:bg-[color:var(--sc-accent-light)]")
            }
          >
            <Hand size={12} /> {interested ? "Interested" : "I'm interested"}
          </button>
          <button
            data-testid="pd-share"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[color:var(--sc-border)] text-[11px] font-bold text-[color:var(--sc-ink)] hover:bg-[color:var(--sc-accent-light)] transition-colors"
          >
            <Share2 size={12} /> Share
          </button>
        </div>
      </div>

      <TrustGrid />
    </div>
  );
}

/* ---------- Page ------------------------------------------------------ */

function useShare(product) {
  return async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try { await navigator.share({ title: product.name, text: product.name, url }); return; } catch { /* user cancelled */ }
    }
    try {
      await navigator.clipboard?.writeText(url);
      alert("Link copied to clipboard");
    } catch { /* ignore */ }
  };
}

export default function ProductDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { add, cart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [interested, setInterested] = useState(false);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/products/${id}`);
        if (alive) {
          setProduct(data);
          setSaved(!!data?.is_saved);
          setInterested(!!data?.is_interested);
        }
      } catch (e) {
        log.error("ProductDetail.fetch failed", e);
        if (alive) setError("Product not found");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const inCart = cart.items?.some((it) => it.product_id === id);

  const handleAdd = async () => {
    setBusy(true);
    try { await add(id, qty); } finally { setBusy(false); }
  };
  const buyNow = async () => {
    await handleAdd();
    nav("/cart");
  };
  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    try { await api.post(`/products/${id}/save`, { save: next }); }
    catch (e) { log.error("ProductDetail.toggleSave failed", e); setSaved(!next); }
  };
  const toggleInterested = async () => {
    const next = !interested;
    setInterested(next);
    try { await api.post(`/products/${id}/interested`, { interested: next }); }
    catch (e) { log.error("ProductDetail.toggleInterested failed", e); setInterested(!next); }
  };
  const onShare = useShare(product || { name: "Slangcart product" });

  const images = useMemo(() => {
    if (!product) return [];
    const list = [];
    if (product.image_url) list.push(product.image_url);
    if (Array.isArray(product.images)) list.push(...product.images.filter(Boolean));
    if (Array.isArray(product.gallery)) list.push(...product.gallery.filter(Boolean));
    return Array.from(new Set(list));
  }, [product]);

  return (
    <Layout title={product?.name || "Product"}>
      {/* Breadcrumbs */}
      <nav className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-[color:var(--sc-ink-muted)]" data-testid="pd-breadcrumbs">
        <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 hover:text-[color:var(--sc-primary)]" data-testid="pd-back">
          <ArrowLeft size={12} /> Back
        </button>
        <span>·</span>
        <Link to="/shop" className="hover:text-[color:var(--sc-primary)]">Shop</Link>
        {product?.category && (
          <>
            <ChevronRight size={12} />
            <span className="text-[color:var(--sc-ink)]">{product.category}</span>
          </>
        )}
      </nav>

      {loading && <Spinner />}
      {!loading && (error || !product) && <ProductErrorCard error={error} />}
      {!loading && product && (
        <div className="sc-fade-in" data-testid="pd-page">
          <div className="grid md:grid-cols-12 gap-6 lg:gap-8 items-start">
            <div className="md:col-span-5 lg:col-span-5">
              <Gallery images={images} name={product.name} />
            </div>
            <div className="md:col-span-7 lg:col-span-7">
              <ProductInfo
                product={product}
                busy={busy}
                inCart={inCart}
                saved={saved}
                interested={interested}
                qty={qty}
                setQty={setQty}
                onAdd={handleAdd}
                onBuyNow={buyNow}
                onToggleSave={toggleSave}
                onToggleInterested={toggleInterested}
                onShare={onShare}
              />
            </div>
          </div>
          <DetailsTabs product={product} />
        </div>
      )}
    </Layout>
  );
}
