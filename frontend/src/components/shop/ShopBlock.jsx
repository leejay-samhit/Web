// Thin dispatcher — picks the right renderer per block.block_type.
// Per-type renderers and helpers live in ./blocks.jsx to keep this file small
// and the cyclomatic complexity per renderer low.
import { useMemo } from "react";
import {
  AnnouncementBlock, FreeTextBlock, SubCategoryLabelBlock, NewBannerBlock,
  ContentBoxBlock, BannerSliderBlock, CategoryCirclesBlock, BrandSliderBlock,
  OfferCardsBlock, ProductGridBlock, HorizontalSliderBlock, FlashSaleBlock,
  FallbackBlock,
} from "./blocks";

const RENDERERS = {
  announcement: AnnouncementBlock,
  free_text: FreeTextBlock,
  sub_category_label: SubCategoryLabelBlock,
  new_banner: NewBannerBlock,
  content_box: ContentBoxBlock,
  banner_slider: BannerSliderBlock,
  category_circles: CategoryCirclesBlock,
  brand_slider: BrandSliderBlock,
  offer_cards: OfferCardsBlock,
  product_grid: ProductGridBlock,
  horizontal_slider: HorizontalSliderBlock,
  flash_sale: FlashSaleBlock,
};

const PRODUCT_BLOCK_TYPES = new Set(["product_grid", "horizontal_slider", "flash_sale"]);

function resolveProducts(b, allProducts) {
  if (b.product_ids?.length) {
    const map = new Map(allProducts.map((p) => [p.id, p]));
    return b.product_ids.map((id) => map.get(id)).filter(Boolean);
  }
  let pool = allProducts;
  if (b.category_filter) {
    pool = pool.filter((p) => p.category === b.category_filter || p.category_id === b.category_filter || p.sub_category === b.category_filter);
  }
  return pool.slice(0, b.product_count || 10);
}

export default function ShopBlock({ block, allProducts = [] }) {
  const b = block;
  const needsProducts = PRODUCT_BLOCK_TYPES.has(b.block_type);

  // Only resolve products for block types that actually consume them.
  const products = useMemo(
    () => (needsProducts ? resolveProducts(b, allProducts) : []),
    [needsProducts, b, allProducts],
  );

  if (!b.active) return null;

  const style = {
    background: b.bg_color || undefined,
    color: b.text_color || undefined,
    textAlign: b.text_align || undefined,
  };

  const Renderer = RENDERERS[b.block_type] || FallbackBlock;
  return <Renderer b={b} style={style} products={products} />;
}
