import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { formatINR } from "@/lib/utils";
import {
  ArrowLeft, Check, Heart, Hand, Plus, Minus, ShoppingBag, Tag, Truck, ShieldCheck,
  Star, MapPin, RotateCcw, Award, Zap, ChevronRight, Store, Share2,
  BadgePercent, Package, Cpu, HardDrive, MonitorSmartphone, Ruler, Palette, Layers,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { log } from "@/lib/log";

/* ---------- Styled-text renderer -------------------------------------
 * The backend stores summary/description fields as `StyledText` objects
 * (`{ text: "..." }`) with lightweight markdown tokens:
 *   ~~strike~~   →   <s>strike</s>
 *   **bold**     →   <strong>bold</strong>
 *   *italic*     →   <em>italic</em>
 * Line-breaks are preserved. Kept intentionally tiny — no full MD engine.
 */
function renderStyled(input) {
  const raw = typeof input === "string" ? input : (input && input.text) || "";
  if (!raw) return null;
  const lines = String(raw).split(/\r?\n/);
  const inlineToNodes = (line, keyPrefix) => {
    // token pattern: ~~...~~  |  **...**  |  *...*
    const re = /(~~[^~]+~~|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    const parts = line.split(re).filter((p) => p !== "");
    return parts.map((seg, i) => {
      const k = `${keyPrefix}-${i}`;
      if (/^~~[^~]+~~$/.test(seg)) return <s key={k} className="opacity-60">{seg.slice(2, -2)}</s>;
      if (/^\*\*[^*]+\*\*$/.test(seg)) return <strong key={k}>{seg.slice(2, -2)}</strong>;
      if (/^\*[^*]+\*$/.test(seg)) return <em key={k}>{seg.slice(1, -1)}</em>;
      return <span key={k}>{seg}</span>;
    });
  };
  return lines.map((ln, i) => (
    <span key={i}>
      {inlineToNodes(ln, `l${i}`)}
      {i < lines.length - 1 && <br />}
    </span>
  ));
}

const hasStyled = (v) => {
  if (!v) return false;
  const t = typeof v === "string" ? v : v.text;
  return !!(t && String(t).trim());
};

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

/* ---------- Styled summaries (Price / Protection / Warranty / Delivery) ----
 * These are the vendor-authored "why buy this" cards. Renders as a 2x2 grid
 * with soft-gradient tiles, icons on the left, styled markdown copy right.
 */
const SUMMARY_META = {
  price:      { icon: BadgePercent, title: "Best Price",   accent: "from-emerald-50 to-white",   ring: "ring-emerald-200",   ic: "bg-emerald-600" },
  protection: { icon: ShieldCheck,  title: "Protection",   accent: "from-indigo-50 to-white",    ring: "ring-indigo-200",    ic: "bg-indigo-600" },
  warranty:   { icon: Award,        title: "Warranty",     accent: "from-amber-50 to-white",     ring: "ring-amber-200",     ic: "bg-amber-500" },
  delivery:   { icon: Truck,        title: "Delivery",     accent: "from-sky-50 to-white",       ring: "ring-sky-200",       ic: "bg-sky-600" },
};

function StyledSummaries({ product }) {
  const items = [
    { key: "price",      value: product.price_summary },
    { key: "protection", value: product.protection_summary },
    { key: "warranty",   value: product.warranty_summary },
    { key: "delivery",   value: product.delivery_summary },
  ].filter((it) => hasStyled(it.value));
  if (!items.length) return null;
  return (
    <div className="grid sm:grid-cols-2 gap-2.5" data-testid="pd-styled-summaries">
      {items.map(({ key, value }) => {
        const meta = SUMMARY_META[key];
        const Icon = meta.icon;
        return (
          <div
            key={key}
            className={`relative rounded-2xl border border-[color:var(--sc-border)] bg-gradient-to-br ${meta.accent} p-3.5 ring-1 ${meta.ring} hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-16px_rgba(15,23,42,0.35)] transition-all`}
            data-testid={`pd-summary-${key}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${meta.ic} text-white grid place-items-center shrink-0 shadow-sm`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-[color:var(--sc-ink-muted)]">
                  {meta.title}
                </div>
                <div className="mt-0.5 text-[13.5px] leading-snug font-semibold text-[color:var(--sc-ink)] break-words">
                  {renderStyled(value)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Key Attributes (Brand / OS / RAM / CPU / Storage / Size) ------
 * The backend stores these as top-level scalar fields (attrs_*, clothing_size)
 * plus a free-form `extra_attrs` object. We surface up-to N as pill cards.
 */
const ATTR_META = [
  { key: "attrs_brand",     label: "Brand",     Icon: Tag },
  { key: "attrs_os",        label: "OS",        Icon: MonitorSmartphone },
  { key: "attrs_ram",       label: "RAM",       Icon: Layers },
  { key: "attrs_storage",   label: "Storage",   Icon: HardDrive },
  { key: "attrs_cpu_model", label: "Processor", Icon: Cpu },
  { key: "attrs_cpu_speed", label: "CPU Speed", Icon: Zap },
  { key: "clothing_size",   label: "Size",      Icon: Ruler },
  { key: "color",           label: "Colour",    Icon: Palette },
];

function KeyAttributes({ product }) {
  const items = ATTR_META
    .map((m) => ({ ...m, value: product?.[m.key] }))
    .filter((m) => m.value && String(m.value).trim());

  // fold `extra_attrs` (object OR array-of-pairs) into extra chips
  const extras = [];
  const ea = product?.extra_attrs;
  if (ea && typeof ea === "object" && !Array.isArray(ea)) {
    for (const [k, v] of Object.entries(ea)) {
      if (k && v !== null && v !== undefined && String(v).trim()) {
        extras.push({ label: k, value: String(v), Icon: Package });
      }
    }
  } else if (Array.isArray(ea)) {
    for (const row of ea) {
      const label = row?.label || row?.key;
      const value = row?.value ?? row?.val;
      if (label && value) extras.push({ label, value: String(value), Icon: Package });
    }
  }

  const all = [...items, ...extras];
  if (!all.length) return null;

  return (
    <section className="mt-8 rounded-3xl bg-white border border-[color:var(--sc-border)] p-5 sm:p-6" data-testid="pd-key-attrs">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 rounded-full bg-[color:var(--sc-primary)]" />
        <h2 className="text-base sm:text-lg font-extrabold text-[color:var(--sc-ink)]">Key attributes</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {all.map((a, i) => (
          <div
            key={`${a.label}-${i}`}
            className="group flex items-center gap-3 rounded-xl border border-[color:var(--sc-border)] bg-[color:var(--sc-accent-light)]/50 hover:bg-[color:var(--sc-accent-light)] hover:border-[color:var(--sc-primary)]/40 p-3 transition-all"
            data-testid={`pd-attr-${(a.label || "attr").toString().toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className="w-9 h-9 rounded-lg bg-white border border-[color:var(--sc-border)] grid place-items-center text-[color:var(--sc-primary)] shrink-0 group-hover:scale-105 transition-transform">
              <a.Icon size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] truncate">{a.label}</div>
              <div className="text-sm font-extrabold text-[color:var(--sc-ink)] truncate">{a.value}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Tabs (Description / Specs / Box / Vendor) ---------------- */

function DetailsTabs({ product }) {
  // Legacy specs fallback (product.specs as dict or array)
  const legacySpecs = useMemo(() => {
    if (Array.isArray(product.specs)) return product.specs;
    if (product.specs && typeof product.specs === "object") {
      return Object.entries(product.specs).map(([k, v]) => ({ label: k, value: String(v) }));
    }
    return [];
  }, [product.specs]);

  // Structured spec_tabs from admin/vendor form.
  const specTabs = useMemo(() => {
    if (!Array.isArray(product.spec_tabs)) return [];
    return product.spec_tabs
      .filter(Boolean)
      .map((t) => ({
        name: t?.name || "Specifications",
        rows: Array.isArray(t?.rows) ? t.rows.filter((r) => r && (r.label || r.value)) : [],
      }))
      .filter((t) => t.rows.length > 0);
  }, [product.spec_tabs]);

  // Sub-features (vendor-authored highlights)
  const subFeatures = useMemo(() => {
    if (!Array.isArray(product.sub_features)) return [];
    return product.sub_features.map((s) => (typeof s === "string" ? s : s?.text)).filter(Boolean);
  }, [product.sub_features]);

  // What's in the box — supports `[string]` and `[{name, image_data_url}]`
  const boxItems = useMemo(() => {
    if (!Array.isArray(product.whats_in_box)) return [];
    return product.whats_in_box
      .map((x) => (typeof x === "string" ? { name: x } : { name: x?.name, image: x?.image_data_url }))
      .filter((x) => x.name);
  }, [product.whats_in_box]);

  // Tab ordering as requested by product: Specification → Description → Sold by
  const hasSpecs = specTabs.length > 0 || legacySpecs.length > 0;

  const tabs = [
    { key: "specs",  label: specTabs[0]?.name || "Specifications", show: hasSpecs },
    ...specTabs.slice(1).map((t, i) => ({ key: `spec-${i + 1}`, label: t.name || `Spec ${i + 2}`, show: true, _tabIndex: i + 1 })),
    { key: "features", label: "Highlights", show: subFeatures.length > 0 },
    { key: "desc",   label: "Description",  show: !!product.description },
    { key: "box",    label: "What's in the box", show: boxItems.length > 0 },
    { key: "vendor", label: "Sold by",      show: !!(product.vendor_name || product.shop_name || product.vendor_id) },
  ].filter((t) => t.show);

  const [tab, setTab] = useState(tabs[0]?.key || "specs");
  useEffect(() => { if (tabs.length && !tabs.find((t) => t.key === tab)) setTab(tabs[0].key); }, [tabs, tab]);

  if (!tabs.length) return null;

  const activeSpecTab =
    tab === "specs"
      ? (specTabs[0] || { name: "Specifications", rows: legacySpecs })
      : (tab.startsWith("spec-") ? specTabs[Number(tab.slice(5))] : null);

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
        {activeSpecTab && (
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3" data-testid="pd-specs">
            {activeSpecTab.rows.map((s, i) => (
              <div key={`${s.label}-${i}`} className="flex items-start justify-between gap-4 py-2 border-b border-dashed border-[color:var(--sc-border)] last:border-0">
                <dt className="text-sm font-semibold text-[color:var(--sc-ink-muted)]">{s.label}</dt>
                <dd className="text-sm font-bold text-[color:var(--sc-ink)] text-right">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {tab === "features" && (
          <ul className="grid sm:grid-cols-2 gap-2" data-testid="pd-features">
            {subFeatures.map((f, i) => (
              <li key={`${f}-${i}`} className="flex items-start gap-2 rounded-lg bg-[color:var(--sc-accent-light)] p-3">
                <Check size={16} className="text-[color:var(--sc-primary)] mt-0.5 shrink-0" />
                <span className="text-sm font-semibold text-[color:var(--sc-ink)]">{f}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "desc" && (
          <div className="prose max-w-none">
            <p className="text-[15px] text-[color:var(--sc-ink)] leading-relaxed whitespace-pre-line" data-testid="pd-desc">
              {product.description}
            </p>
          </div>
        )}

        {tab === "box" && (
          <ul className="grid sm:grid-cols-2 gap-2" data-testid="pd-box">
            {boxItems.map((x, i) => (
              <li key={`${x.name}-${i}`} className="flex items-center gap-3 rounded-lg bg-[color:var(--sc-accent-light)] p-3">
                {x.image ? (
                  <img alt="" src={x.image} className="w-10 h-10 rounded-lg object-cover bg-white border border-[color:var(--sc-border)] shrink-0" />
                ) : (
                  <Check size={16} className="text-[color:var(--sc-primary)] mt-0.5 shrink-0" />
                )}
                <span className="text-sm font-semibold text-[color:var(--sc-ink)]">{x.name}</span>
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

      {/* Vendor-authored styled summaries (price / protection / warranty / delivery) */}
      <StyledSummaries product={product} />

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
          <KeyAttributes product={product} />
          <DetailsTabs product={product} />
        </div>
      )}
    </Layout>
  );
}
