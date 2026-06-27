import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatINR } from "@/lib/utils";
import { ArrowLeft, Check, Heart, HeartOff, Hand, Plus, ShoppingBag, Tag, Truck, ShieldCheck } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { log } from "@/lib/log";

function ProductErrorCard({ error }) {
  return (
    <div data-testid="pd-error" className="sc-card p-6 text-center">
      {error}
      <div className="mt-4">
        <Link to="/shop" className="sc-btn-primary">Back to shop</Link>
      </div>
    </div>
  );
}

function ProductInfo({ product, busy, inCart, saved, interested, onAdd, onBuyNow, onToggleSave, onToggleInterested }) {
  return (
    <div className="grid lg:grid-cols-2 gap-6 sc-fade-in">
      <div className="sc-card overflow-hidden aspect-square bg-[color:var(--sc-accent-light)]">
        {product.image_url ? (
          <img alt="" src={product.image_url} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full grid place-items-center text-[color:var(--sc-primary)]">
            <ShoppingBag size={64} />
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div>
          {product.brand && <div className="sc-chip"><Tag size={12} /> {product.brand}</div>}
          <h1 data-testid="pd-name" className="text-2xl lg:text-3xl font-extrabold text-[color:var(--sc-ink)] mt-3">
            {product.name}
          </h1>
          {product.description && (
            <p className="text-sm text-[color:var(--sc-ink-muted)] mt-2 whitespace-pre-line">{product.description}</p>
          )}
        </div>
        <div className="text-3xl font-extrabold text-[color:var(--sc-primary)]" data-testid="pd-price">{formatINR(product.price)}</div>
        <div className="flex flex-wrap gap-3">
          <button
            data-testid="pd-add-cart"
            onClick={onAdd}
            disabled={busy || inCart}
            className={inCart ? "sc-btn-ghost flex items-center gap-2" : "sc-btn-outline flex items-center gap-2"}
          >
            {inCart ? <><Check size={16} /> In cart</> : <><Plus size={16} /> Add to cart</>}
          </button>
          <button data-testid="pd-buy-now" onClick={onBuyNow} disabled={busy} className="sc-btn-primary">
            Buy now
          </button>
          <button
            data-testid="pd-save"
            onClick={onToggleSave}
            className={`px-3 py-2.5 rounded-xl border inline-flex items-center gap-1.5 text-sm font-semibold ${saved ? "bg-rose-50 border-rose-200 text-rose-600" : "border-[color:var(--sc-border)] text-[color:var(--sc-ink)]"}`}
            title={saved ? "Remove from wishlist" : "Save to wishlist"}
          >
            <Heart size={16} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save"}
          </button>
          <button
            data-testid="pd-interested"
            onClick={onToggleInterested}
            className={`px-3 py-2.5 rounded-xl border inline-flex items-center gap-1.5 text-sm font-semibold ${interested ? "bg-amber-50 border-amber-200 text-amber-700" : "border-[color:var(--sc-border)] text-[color:var(--sc-ink)]"}`}
          >
            <Hand size={16} /> {interested ? "Interested" : "I'm interested"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-3">
          <div className="sc-card p-3 text-center">
            <Truck size={16} className="mx-auto text-[color:var(--sc-primary)]" />
            <div className="text-[11px] mt-1 font-semibold text-[color:var(--sc-ink-muted)]">Fast delivery</div>
          </div>
          <div className="sc-card p-3 text-center">
            <ShieldCheck size={16} className="mx-auto text-[color:var(--sc-primary)]" />
            <div className="text-[11px] mt-1 font-semibold text-[color:var(--sc-ink-muted)]">Secure pay</div>
          </div>
          <div className="sc-card p-3 text-center">
            <Tag size={16} className="mx-auto text-[color:var(--sc-primary)]" />
            <div className="text-[11px] mt-1 font-semibold text-[color:var(--sc-ink-muted)]">Best price</div>
          </div>
        </div>
        {Array.isArray(product.whats_in_box) && product.whats_in_box.length > 0 && (
          <div className="sc-card p-4">
            <div className="font-extrabold text-sm">What's in the box</div>
            <ul className="mt-2 text-sm text-[color:var(--sc-ink-muted)] list-disc pl-5 space-y-1">
              {product.whats_in_box.map((x, i) => (
                <li key={`${x}-${i}`}>{x}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function renderPd({ loading, error, product, busy, inCart, saved, interested, onAdd, onBuyNow, onToggleSave, onToggleInterested }) {
  if (loading) return <Spinner />;
  if (error || !product) return <ProductErrorCard error={error} />;
  return <ProductInfo product={product} busy={busy} inCart={inCart} saved={saved} interested={interested} onAdd={onAdd} onBuyNow={onBuyNow} onToggleSave={onToggleSave} onToggleInterested={onToggleInterested} />;
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
    return () => {
      alive = false;
    };
  }, [id]);

  const inCart = cart.items?.some((it) => it.product_id === id);

  const handleAdd = async () => {
    setBusy(true);
    try {
      await add(id, 1);
    } finally {
      setBusy(false);
    }
  };
  const buyNow = async () => {
    await handleAdd();
    nav("/cart");
  };
  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    try {
      await api.post(`/products/${id}/save`, { save: next });
    } catch (e) {
      log.error("ProductDetail.toggleSave failed", e);
      setSaved(!next);
    }
  };
  const toggleInterested = async () => {
    const next = !interested;
    setInterested(next);
    try {
      await api.post(`/products/${id}/interested`, { interested: next });
    } catch (e) {
      log.error("ProductDetail.toggleInterested failed", e);
      setInterested(!next);
    }
  };

  return (
    <Layout title="Product">
      <button onClick={() => nav(-1)} data-testid="pd-back" className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--sc-ink-muted)] mb-4">
        <ArrowLeft size={16} /> Back
      </button>
      {renderPd({ loading, error, product, busy, inCart, saved, interested, onAdd: handleAdd, onBuyNow: buyNow, onToggleSave: toggleSave, onToggleInterested: toggleInterested })}
    </Layout>
  );
}
