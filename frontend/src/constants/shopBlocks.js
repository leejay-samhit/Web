// Centralized list of all 12 shop-layout block types supported by the backend.
// The configs drive both the admin editor (which fields to show) and the
// user-shop renderer (how to display the block). Mirrors mobile-app parity.

export const BLOCK_TYPES = [
  {
    type: "banner_slider",
    label: "Banner slider",
    description: "Auto-playing slider with multiple images/CTAs",
    needs: { items: true, image: false, products: false, title: true },
  },
  {
    type: "new_banner",
    label: "New banner",
    description: "Single banner with title, subtitle, CTA",
    needs: { items: false, image: true, products: false, title: true, cta: true, height: true, colors: true },
  },
  {
    type: "announcement",
    label: "Announcement",
    description: "Top-of-page announcement bar (text only)",
    needs: { items: false, image: false, products: false, title: true, body: true, colors: true },
  },
  {
    type: "category_circles",
    label: "Category circles",
    description: "Circular category pills with icon + label",
    needs: { items: true, image: false, products: false, title: true },
  },
  {
    type: "brand_slider",
    label: "Brand slider",
    description: "Horizontal scroll of brand logos / chips",
    needs: { items: true, image: false, products: false, title: true },
  },
  {
    type: "product_grid",
    label: "Product grid",
    description: "Grid of products (manual selection or by category)",
    needs: { items: false, image: false, products: true, title: true, layout: true, viewall: true },
  },
  {
    type: "horizontal_slider",
    label: "Horizontal slider",
    description: "Horizontally-scrolling product carousel",
    needs: { items: false, image: false, products: true, title: true, viewall: true },
  },
  {
    type: "content_box",
    label: "Content box",
    description: "Rich content block with image + title + body",
    needs: { items: false, image: true, products: false, title: true, body: true, cta: true, colors: true },
  },
  {
    type: "flash_sale",
    label: "Flash sale",
    description: "Time-limited flash sale with countdown timer",
    needs: { items: false, image: false, products: true, title: true, flash: true, colors: true },
  },
  {
    type: "offer_cards",
    label: "Offer cards",
    description: "Multiple offer cards in a grid (e.g. promo tiles)",
    needs: { items: true, image: false, products: false, title: true },
  },
  {
    type: "sub_category_label",
    label: "Sub-category label",
    description: "Section heading / divider with optional 'View all'",
    needs: { items: false, image: false, products: false, title: true, viewall: true, colors: true },
  },
  {
    type: "free_text",
    label: "Free text",
    description: "Pure text block (paragraph or rich markdown)",
    needs: { items: false, image: false, products: false, title: true, body: true, colors: true },
  },
];

export const BLOCK_TYPE_BY_KEY = Object.fromEntries(BLOCK_TYPES.map((b) => [b.type, b]));

export const LAYOUT_STYLES = ["grid", "list", "carousel"];
export const SIZES = ["small", "medium", "large"];
export const TEXT_ALIGNS = ["left", "center", "right"];
export const DATA_SOURCES = ["manual", "auto_latest", "auto_category", "auto_featured"];
