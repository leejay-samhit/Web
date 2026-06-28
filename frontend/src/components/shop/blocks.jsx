// Per-block-type renderers — extracted from ShopBlock.jsx to keep that file
// small and the cyclomatic complexity per renderer low. Each render function
// receives the block and a pre-resolved `products` array.
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { formatINR } from "@/lib/utils";

const cardCls = "sc-card p-4 mb-3";

function CTA({ b, defaultLink = "/shop" }) {
  if (!b.cta_label) return null;
  return (
    <Link
      to={b.view_all_link || defaultLink}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold mt-2"
      style={{ background: b.button_color || "var(--sc-primary)", color: b.button_text_color || "#fff" }}
    >
      {b.cta_label} <ChevronRight size={12} />
    </Link>
  );
}

function SectionHeader({ b }) {
  if (!b.title && !b.show_view_all) return null;
  return (
    <div className="flex items-center justify-between mb-2">
      <div>
        {b.title && <div className="font-extrabold text-base text-[color:var(--sc-ink)]">{b.title}</div>}
        {b.subtitle && <div className="text-xs text-[color:var(--sc-ink-muted)]">{b.subtitle}</div>}
      </div>
      {b.show_view_all && (
        <Link to={b.view_all_link || "/shop"} className="text-xs font-bold text-[color:var(--sc-primary)] inline-flex items-center gap-1">
          View all <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

function MiniProductCard({ p }) {
  return (
    <Link to={`/product/${p.id}`} className="sc-card overflow-hidden flex flex-col shrink-0 w-36" data-testid={`shop-mini-${p.id}`}>
      <div className="aspect-square bg-[color:var(--sc-accent-light)] overflow-hidden">
        {p.image_url ? <img alt="" src={p.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-[color:var(--sc-primary)]"><ShoppingBag size={20} /></div>}
      </div>
      <div className="p-2">
        <div className="text-xs font-semibold line-clamp-2">{p.name}</div>
        <div className="font-extrabold text-sm mt-1">{formatINR(p.price)}</div>
      </div>
    </Link>
  );
}

function FlashTimer({ endsAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ends = useMemo(() => endsAt ? new Date(endsAt).getTime() : 0, [endsAt]);
  const diff = Math.max(0, ends - now);
  if (!endsAt || diff <= 0) return null;
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return <div className="text-xs font-mono font-bold">{pad(h)}:{pad(m)}:{pad(s)}</div>;
}

// Stable key for items array (shop_layout block items lack ids). Combines
// link, label and image fingerprint so a re-render doesn't shuffle DOM nodes.
const itemKey = (it, idx) => `${it.link_value || ""}|${it.label || ""}|${(it.image_data_url || "").slice(-12)}|${idx}`;

export function AnnouncementBlock({ b, style }) {
  return (
    <div className="px-4 py-2 mb-3 rounded-xl text-center text-sm font-semibold" style={style} data-testid={`block-${b.id}`}>
      {b.title}{b.body && <> · <span className="font-normal">{b.body}</span></>}
    </div>
  );
}

export function FreeTextBlock({ b, style }) {
  return (
    <div className={cardCls} style={style} data-testid={`block-${b.id}`}>
      {b.title && <div className="font-extrabold mb-1">{b.title}</div>}
      {b.body && <div className="text-sm whitespace-pre-line">{b.body}</div>}
    </div>
  );
}

export function SubCategoryLabelBlock({ b, style }) {
  return (
    <div className="flex items-center justify-between mt-2 mb-2" data-testid={`block-${b.id}`} style={style}>
      <div className="font-extrabold text-base">{b.title || ""}</div>
      {b.show_view_all && <Link to={b.view_all_link || "/shop"} className="text-xs font-bold text-[color:var(--sc-primary)]">View all →</Link>}
    </div>
  );
}

export function NewBannerBlock({ b, style }) {
  return (
    <Link to={b.view_all_link || "/shop"} className={`block ${cardCls} overflow-hidden`} style={{ ...style, height: b.height || undefined }} data-testid={`block-${b.id}`}>
      <div className="flex gap-3 items-center">
        {b.image_data_url && <img alt="" src={b.image_data_url} className="w-24 h-24 rounded-lg object-cover" />}
        <div className="flex-1">
          {b.title && <div className="font-extrabold text-lg">{b.title}</div>}
          {b.subtitle && <div className="text-sm text-[color:var(--sc-ink-muted)]">{b.subtitle}</div>}
          {b.body && <div className="text-xs mt-1 line-clamp-2">{b.body}</div>}
          <CTA b={b} />
        </div>
      </div>
    </Link>
  );
}

export function ContentBoxBlock({ b, style }) {
  return (
    <div className={cardCls} style={style} data-testid={`block-${b.id}`}>
      {b.image_data_url && <img alt="" src={b.image_data_url} className="w-full h-40 rounded-xl object-cover mb-3" />}
      {b.title && <div className="font-extrabold text-lg">{b.title}</div>}
      {b.subtitle && <div className="text-sm text-[color:var(--sc-ink-muted)] mt-1">{b.subtitle}</div>}
      {b.body && <div className="text-sm mt-2 whitespace-pre-line">{b.body}</div>}
      <CTA b={b} />
    </div>
  );
}

export function BannerSliderBlock({ b, style }) {
  return (
    <div className={cardCls} style={style} data-testid={`block-${b.id}`}>
      <SectionHeader b={b} />
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(b.items || []).map((it, idx) => (
          <Link key={itemKey(it, idx)} to={it.link_value || "/shop"} className="shrink-0 w-72 rounded-xl overflow-hidden border border-[color:var(--sc-border)]" style={{ background: it.color || undefined }} data-testid={`block-${b.id}-item-${idx}`}>
            {it.image_data_url && <img alt="" src={it.image_data_url} className="w-full h-32 object-cover" />}
            <div className="p-2">
              <div className="font-bold text-sm">{it.label}</div>
              {it.subtitle && <div className="text-xs text-[color:var(--sc-ink-muted)]">{it.subtitle}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CategoryCirclesBlock({ b, style }) {
  return (
    <div className={cardCls} style={style} data-testid={`block-${b.id}`}>
      <SectionHeader b={b} />
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {(b.items || []).map((it, idx) => (
          <Link key={itemKey(it, idx)} to={it.link_value || "/shop"} className="shrink-0 flex flex-col items-center gap-1 w-20" data-testid={`block-${b.id}-circle-${idx}`}>
            <div className="w-16 h-16 rounded-full overflow-hidden grid place-items-center" style={{ background: it.color || "var(--sc-accent-light)" }}>
              {it.image_data_url ? <img alt="" src={it.image_data_url} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-[color:var(--sc-primary)]">{it.label?.slice(0, 2).toUpperCase()}</span>}
            </div>
            <span className="text-xs font-semibold text-center line-clamp-1">{it.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function BrandSliderBlock({ b, style }) {
  return (
    <div className={cardCls} style={style} data-testid={`block-${b.id}`}>
      <SectionHeader b={b} />
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(b.items || []).map((it, idx) => (
          <Link key={itemKey(it, idx)} to={it.link_value || "/shop"} className="shrink-0 px-4 py-3 rounded-xl border border-[color:var(--sc-border)] bg-white flex items-center gap-2" data-testid={`block-${b.id}-brand-${idx}`}>
            {it.image_data_url ? <img alt="" src={it.image_data_url} className="h-8 object-contain" /> : <div className="w-8 h-8 rounded-full bg-[color:var(--sc-accent-light)]" />}
            <span className="text-xs font-bold">{it.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function OfferCardsBlock({ b, style }) {
  return (
    <div className={cardCls} style={style} data-testid={`block-${b.id}`}>
      <SectionHeader b={b} />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {(b.items || []).map((it, idx) => (
          <Link key={itemKey(it, idx)} to={it.link_value || "/shop"} className="rounded-xl overflow-hidden border border-[color:var(--sc-border)]" style={{ background: it.color || undefined }} data-testid={`block-${b.id}-offer-${idx}`}>
            {it.image_data_url && <img alt="" src={it.image_data_url} className="w-full h-24 object-cover" />}
            <div className="p-2">
              <div className="font-bold text-sm">{it.label}</div>
              {it.subtitle && <div className="text-xs text-[color:var(--sc-ink-muted)]">{it.subtitle}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ProductGridBlock({ b, style, products }) {
  return (
    <div className={cardCls} style={style} data-testid={`block-${b.id}`}>
      <SectionHeader b={b} />
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${b.products_per_row || 2}, minmax(0, 1fr))` }}>
        {products.map((p) => <MiniProductCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}

export function HorizontalSliderBlock({ b, style, products }) {
  return (
    <div className={cardCls} style={style} data-testid={`block-${b.id}`}>
      <SectionHeader b={b} />
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {products.map((p) => <MiniProductCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}

export function FlashSaleBlock({ b, style, products }) {
  return (
    <div className={cardCls} style={style} data-testid={`block-${b.id}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-extrabold text-lg" style={{ color: b.text_color || "var(--sc-error)" }}>⚡ {b.title || "Flash sale"}</div>
          {b.subtitle && <div className="text-xs text-[color:var(--sc-ink-muted)]">{b.subtitle}</div>}
        </div>
        <FlashTimer endsAt={b.flash_sale_ends_at} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {products.map((p) => <MiniProductCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}

export function FallbackBlock({ b }) {
  return (
    <div className={cardCls} data-testid={`block-${b.id}`}>
      <div className="text-xs uppercase font-bold text-[color:var(--sc-ink-muted)]">{b.block_type}</div>
      {b.title && <div className="font-extrabold mt-1">{b.title}</div>}
    </div>
  );
}
