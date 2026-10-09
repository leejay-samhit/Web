import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import apiLocal from "@/lib/apiLocal";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { formatINR, formatDateTime, resolveImageUrl } from "@/lib/utils";
import { Store, Package, TrendingUp, MessageSquare, Plus, X, Loader2, Pencil, Trash2, Search, Sparkles, Check, Info, Strikethrough, ClipboardList, BellRing, ArrowRight, Download } from "lucide-react";
import { log } from "@/lib/log";
import { useAuth } from "@/context/AuthContext";
import VendorNav from "@/components/vendor/VendorNav";
import DeviceIdentitySection, { validateDeviceIdentity } from "@/components/DeviceIdentitySection";
import LocationBlock from "@/components/LocationBlock";
import StockPhotoPicker from "@/components/StockPhotoPicker";
// (loadReceivedProducts intentionally NOT imported — accepted transfers are
// now auto-added to the receiver's live catalog on the backend, so merging
// them here would show duplicates.)
import { searchMaster, getMaster, reportMasterHit } from "@/lib/productMaster";
import {
  parseLines, linesFromArray, parseExtraAttrs, extraAttrsToText,
  toStyled, fromStyled, parseSpecTabs, specTabsToText, specsDictToSpecTabsText,
  flattenMasterImages,
} from "@/lib/productForm";

const CONDITIONS = [
  { key: "new", label: "New" },
  { key: "refurbished", label: "Refurbished" },
  { key: "used_like_new", label: "Used · like new" },
  { key: "used_good", label: "Used · good" },
  { key: "used_fair", label: "Used · fair" },
];

const TABS = [
  { key: "products", label: "Products", icon: Package },
  { key: "sales", label: "Sales", icon: TrendingUp },
  { key: "questions", label: "Q&A", icon: MessageSquare },
];

function Stats({ stats }) {
  if (!stats) return null;
  const items = [
    { label: "Total products", val: stats.total_products ?? 0 },
    { label: "Total sales", val: formatINR(stats.total_sales ?? 0) },
    { label: "Pending questions", val: stats.pending_questions ?? 0 },
    { label: "Orders", val: stats.total_orders ?? 0 },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5" data-testid="vd-stats">
      {items.map((s) => (
        <div key={s.label} className="sc-card p-4">
          <div className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">{s.label}</div>
          <div className="text-xl font-extrabold mt-1">{s.val}</div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  New Orders alert — polls upstream + local mirror every 30s, matches app    */
/* -------------------------------------------------------------------------- */
function NewOrdersAlert() {
  const [pending, setPending] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const prevIdsRef = useRef(new Set());
  const initedRef = useRef(false);

  const load = useCallback(async () => {
    const params = { status: "placed" };
    let merged = [];
    const seen = new Set();
    // Upstream
    try {
      const { data } = await api.get("/vendor/me/orders", { params });
      const arr = Array.isArray(data) ? data : data?.items || [];
      arr.forEach((o) => { if (o?.id && !seen.has(o.id)) { seen.add(o.id); merged.push(o); } });
    } catch { /* ignore */ }
    // Local mirror
    try {
      const { data } = await apiLocal.get("/vendor/me/orders", { params });
      const arr = Array.isArray(data?.items) ? data.items : [];
      arr.forEach((o) => { if (o?.id && !seen.has(o.id)) { seen.add(o.id); merged.push(o); } });
    } catch { /* ignore */ }

    // Detect newly-arrived orders and toast.
    if (initedRef.current) {
      const prev = prevIdsRef.current;
      const brandNew = merged.filter((o) => !prev.has(o.id));
      if (brandNew.length > 0) {
        toast.success(
          brandNew.length === 1
            ? "🛎️  New order received!"
            : `🛎️  ${brandNew.length} new orders received`,
          { id: "vd-new-orders", description: "Open Orders to accept & ship" }
        );
      }
    }
    prevIdsRef.current = new Set(merged.map((o) => o.id));
    initedRef.current = true;
    setPending(merged);
    setLastSyncedAt(new Date());
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 30000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  if (pending.length === 0) {
    return (
      <div className="sc-card p-3 mb-4 flex items-center gap-3" data-testid="vd-new-orders-empty">
        <div className="w-9 h-9 rounded-xl bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-primary)] shrink-0">
          <ClipboardList size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-[color:var(--sc-ink)]">All caught up — no new orders</div>
          <div className="text-[11px] text-[color:var(--sc-ink-muted)]">
            {lastSyncedAt ? <>Auto-syncing every 30s · last {lastSyncedAt.toLocaleTimeString()}</> : "Watching for orders from the app & web…"}
          </div>
        </div>
        <Link to="/vendor/orders" className="text-xs font-bold text-[color:var(--sc-primary)] inline-flex items-center gap-1 hover:underline" data-testid="vd-orders-link">
          Open orders <ArrowRight size={11} />
        </Link>
      </div>
    );
  }
  const first = pending[0];
  return (
    <Link
      to="/vendor/orders"
      data-testid="vd-new-orders-alert"
      className="block mb-4 rounded-2xl overflow-hidden ring-1 ring-amber-200 bg-gradient-to-r from-amber-50 to-white hover:from-amber-100 hover:to-white transition"
    >
      <div className="p-3 flex items-center gap-3">
        <div className="relative">
          <div className="w-11 h-11 rounded-xl bg-amber-500 text-white grid place-items-center shrink-0 shadow">
            <BellRing size={18} />
          </div>
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold grid place-items-center ring-2 ring-white">
            {pending.length}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-amber-900 truncate">
            {pending.length === 1 ? "New order awaiting your action" : `${pending.length} new orders awaiting action`}
          </div>
          <div className="text-[11px] text-amber-800/80 truncate">
            #{(first.id || "").slice(0, 8)} · {formatINR(first.amount || first.total || 0)}
            {lastSyncedAt && <> · synced {lastSyncedAt.toLocaleTimeString()}</>}
          </div>
        </div>
        <div className="text-xs font-bold text-amber-900 inline-flex items-center gap-1">
          Open orders <ArrowRight size={12} />
        </div>
      </div>
    </Link>
  );
}

export default function VendorDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("products");
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = create mode, id = edit mode
  // Vendors don't control the publish state — only admins can publish a
  // vendor's product to the public Shop. So `is_published` is intentionally
  // NOT part of the vendor-editable form.
  //
  // Fields split by ownership:
  //   • Master-derived (auto-filled when a product master is selected):
  //     name, brand, category, description, image_url, mrp
  //   • Vendor-only (this vendor's inventory + selling data): everything else
  const emptyForm = {
    // link to /product_master document — set when vendor picked an
    // autocomplete suggestion. Backend defaults it to null (manual entry).
    master_id: null,
    // Master-derived fields (still editable so vendors can override)
    name: "", brand: "", category: "", sub_category: "",
    description: "", image_url: "", mrp: 0,
    // Vendor-only pricing + inventory
    price: 0, offer_price: 0, stock: 0,
    // GST + cashback + private purchase economics (feed POS + Smart GST)
    selling_gst_pct: 18,   // → saved as product.gst_pct (POS reads this)
    purchase_price: 0,     // private — inclusive of GST
    purchase_gst_pct: 0,
    cashback_pct: 0,
    free_delivery: false,
    // Vendor-only fulfilment / condition
    store_location: "", condition: "new",
    cash_on_delivery: true, delivery_available: true,
    warranty_months_override: 0, store_notes: "",
    // Device-identity (Luhn-validated at submit)
    imei_1: "", imei_2: "", serial_number: "", batch_number: "",
    track_by_unit: false, units: [],
    // — Rich detail fields (parity with admin form; auto-populated by smart search)
    sub_features: "",     // newline-separated
    images: [],           // array of image data-urls or master URLs (up to 10)
    attrs_brand: "", attrs_os: "", attrs_ram: "",
    attrs_cpu_model: "", attrs_cpu_speed: "", attrs_storage: "",
    clothing_size: "",
    extra_attrs: "",      // free-form key:value textarea
    price_summary: "", protection_summary: "",
    warranty_summary: "", delivery_summary: "",
    whats_in_box: "",     // newline-separated
    spec_tabs: "",        // "Tab | k:v; k:v" per line
    // Location + delivery (see LocationBlock component + BACKLOG_BACKEND_SPEC §13)
    location: {
      pincode: "", state: "", district: "", city: "", address: "",
      latitude: "", longitude: "",
      delivery_radius_km: 5, delivery_scope: "km", delivery_available: true,
    },
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  // Free stock-photo picker — target "cover" sets image_url, "gallery" appends.
  const [picker, setPicker] = useState(null); // null | "cover" | "gallery"
  // Autocomplete state (queried against `/api/products/master/search`).
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const debounceRef = useRef(null);
  // Categories dropdown (admin-managed). Falls back to a text input when
  // the /categories endpoint isn't shipped or returns [].
  const [categories, setCategories] = useState([]);
  const [subcatMap, setSubcatMap] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) Try dedicated catalogue endpoints (not shipped on this backend yet).
      for (const path of ["/admin/categories", "/categories"]) {
        try {
          const { data } = await api.get(path);
          const list = Array.isArray(data) ? data : (data?.items || []);
          const names = list
            .map((c) => (typeof c === "string" ? c : (c?.name || c?.title || c?.slug)))
            .filter(Boolean);
          if (!cancelled && names.length) { setCategories(names); return; }
        } catch { /* try next */ }
      }
      // 2) Fallback: derive the existing category / sub-category taxonomy from
      //    the live product catalogue so vendors can pick existing values.
      try {
        const { data } = await api.get("/products", { params: { limit: 1000 } });
        const items = Array.isArray(data) ? data : (data?.items || []);
        const cats = [...new Set(items.map((p) => p.category).filter(Boolean))].sort();
        const subs = {};
        items.forEach((p) => {
          const sc = p.sub_category || p.subCategory;
          if (p.category && sc) { (subs[p.category] = subs[p.category] || new Set()).add(sc); }
        });
        const subMap = Object.fromEntries(Object.entries(subs).map(([k, v]) => [k, [...v].sort()]));
        if (!cancelled) { setCategories(cats); setSubcatMap(subMap); }
      } catch { /* vendors can still type values by hand */ }
    })();
    return () => { cancelled = true; };
  }, []);
  // Strikethrough tool for Price Summary — wraps the current textarea
  // selection with `~~ ~~` markers that the product detail page renders.
  const priceSummaryRef = useRef(null);
  const applyStrikethrough = () => {
    const el = priceSummaryRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const cur = form.price_summary || "";
    const sel = cur.slice(start, end);
    if (!sel) {
      // No selection — insert a template with placeholder text.
      const next = cur.slice(0, start) + "~~old price~~" + cur.slice(end);
      setForm({ ...form, price_summary: next });
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + 2, start + 11); });
      return;
    }
    const next = cur.slice(0, start) + `~~${sel}~~` + cur.slice(end);
    setForm({ ...form, price_summary: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start, end + 4); });
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, sa, q] = await Promise.allSettled([
        api.get("/vendor/me/stats"),
        api.get("/vendor/me/products"),
        api.get("/vendor/me/sales"),
        api.get("/vendor/me/questions"),
      ]);
      if (s.status === "fulfilled") setStats(s.value.data);
      if (p.status === "fulfilled") {
        // Accepted substore transfers now auto-create/patch the receiver's
        // product upstream (see /app/backend/server.py accept_transfer), so
        // we only display the backend list here — no local merge — to avoid
        // duplicated stock cards.
        const backendProducts = p.value.data?.items || p.value.data || [];
        setProducts(backendProducts);
      }
      if (sa.status === "fulfilled") setSales(sa.value.data?.items || sa.value.data || []);
      if (q.status === "fulfilled") setQuestions(q.value.data?.items || q.value.data || []);
    } catch (error) {
      log.error("VendorDashboard.load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onImg = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setForm((s) => ({ ...s, image_url: r.result?.toString() || "" }));
    r.readAsDataURL(f);
  };

  // Multi-image upload for the Gallery. Preserves original quality — we just
  // convert to data-URL and stash. NEVER compress or downscale, so the
  // gallery reflects the exact quality the vendor uploaded (matches spec:
  // "without compress and without low quality images").
  const onExtraImgs = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 10);
    const urls = await Promise.all(
      files.map(
        (f) =>
          new Promise((res) => {
            const r = new FileReader();
            r.onload = () => res(r.result?.toString() || "");
            r.readAsDataURL(f);
          })
      )
    );
    setForm((s) => ({ ...s, images: [...(s.images || []), ...urls].slice(0, 10) }));
  };
  const removeImage = (i) =>
    setForm((s) => ({ ...s, images: (s.images || []).filter((_, idx) => idx !== i) }));
  const onPickStock = (url) => {
    if (!url) return;
    if (picker === "cover") setForm((s) => ({ ...s, image_url: url }));
    else setForm((s) => ({ ...s, images: [...(s.images || []), url].slice(0, 10) }));
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setQuery("");
    setSuggestions([]);
    setSuggestOpen(false);
    setShowForm(true);
  };
  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      ...emptyForm,
      master_id: p.master_id || null,
      name: p.name || "",
      brand: p.brand || "",
      category: p.category || "",
      sub_category: p.sub_category || "",
      description: p.description || "",
      image_url: p.image_url || "",
      mrp: p.mrp ?? 0,
      price: p.price ?? p.selling_price ?? 0,
      offer_price: p.offer_price ?? 0,
      stock: p.stock ?? 0,
      selling_gst_pct: p.gst_pct ?? p.selling_gst_pct ?? 18,
      purchase_price: p.purchase_price ?? 0,
      purchase_gst_pct: p.purchase_gst_pct ?? 0,
      cashback_pct: p.cashback_pct ?? 0,
      free_delivery: !!p.free_delivery,
      track_by_unit: !!p.track_by_unit,
      units: Array.isArray(p.units) ? p.units : [],
      store_location: p.store_location || "",
      condition: p.condition || "new",
      cash_on_delivery: p.cash_on_delivery !== false,
      delivery_available: p.delivery_available !== false,
      warranty_months_override: p.warranty_months_override ?? 0,
      store_notes: p.store_notes || "",
      imei_1: p.imei_1 || "",
      imei_2: p.imei_2 || "",
      serial_number: p.serial_number || "",
      batch_number: p.batch_number || "",
      // Rich detail hydration (edit-mode)
      sub_features: linesFromArray(p.sub_features),
      images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
      attrs_brand: p.attrs_brand || "",
      attrs_os: p.attrs_os || "",
      attrs_ram: p.attrs_ram || "",
      attrs_cpu_model: p.attrs_cpu_model || "",
      attrs_cpu_speed: p.attrs_cpu_speed || "",
      attrs_storage: p.attrs_storage || "",
      clothing_size: p.clothing_size || "",
      extra_attrs: extraAttrsToText(p.extra_attrs),
      price_summary: fromStyled(p.price_summary),
      protection_summary: fromStyled(p.protection_summary),
      warranty_summary: fromStyled(p.warranty_summary),
      delivery_summary: fromStyled(p.delivery_summary),
      whats_in_box: linesFromArray(
        Array.isArray(p.whats_in_box) ? p.whats_in_box.map((it) => it?.name || it) : []
      ),
      spec_tabs: specTabsToText(p.spec_tabs),
    });
    setQuery(p.name || "");
    setSuggestions([]);
    setSuggestOpen(false);
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setQuery("");
    setSuggestions([]);
    setSuggestOpen(false);
  };

  // Debounced Product-Master lookup. Silently no-ops when the backend
  // endpoint isn't shipped — vendor keeps typing manually.
  useEffect(() => {
    if (!showForm) return;
    if (editingId) return; // edit mode — don't run autocomplete
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    setSuggestLoading(true);
    debounceRef.current = setTimeout(async () => {
      const hits = await searchMaster(q, { limit: 10 });
      setSuggestions(hits);
      setSuggestOpen(hits.length > 0);
      setSuggestLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, showForm, editingId]);

  const pickMaster = async (m) => {
    setSuggestOpen(false);
    reportMasterHit(m.id);
    // Optimistically fill the form from the search hit, then hydrate the
    // full record in the background.
    setForm((prev) => ({
      ...prev,
      master_id: m.id,
      name: m.name || prev.name,
      brand: m.brand || prev.brand,
      category: m.category || prev.category,
      image_url: m.thumbnail || m.image_url || prev.image_url,
      mrp: m.mrp ?? prev.mrp,
    }));
    setQuery(m.name || "");
    const full = await getMaster(m.id);
    if (full) {
      // Preserve original quality of gallery images — no client-side
      // compression, no resizing: just take the URLs as the backend
      // returned them.
      const galleryFromMaster = flattenMasterImages(full.images).slice(0, 10);
      const primary =
        full.image_url ||
        (full.images && (full.images[0]?.url || full.images[0])) ||
        galleryFromMaster[0] ||
        "";
      // Convert master.specs (flat dict) → spec_tabs textarea text.
      const specTabsText =
        specTabsToText(full.spec_tabs) || specsDictToSpecTabsText(full.specs);
      // Build extra_attrs from any spec that doesn't map to a first-class
      // attribute above.
      const specs = full.specs || {};
      const claimed = new Set([
        "brand", "os", "operating_system", "ram", "cpu", "cpu_model",
        "cpu_speed", "storage", "processor",
      ]);
      const extras = Object.fromEntries(
        Object.entries(specs).filter(([k]) => !claimed.has(k.toLowerCase()))
      );
      setForm((prev) => ({
        ...prev,
        master_id: full.id,
        name: full.name || prev.name,
        brand: full.brand || prev.brand,
        category: full.category || prev.category,
        sub_category: full.sub_category || prev.sub_category,
        description: full.description || prev.description,
        image_url: primary || prev.image_url,
        images: galleryFromMaster.length ? galleryFromMaster : prev.images,
        mrp: full.mrp ?? prev.mrp,
        warranty_months_override: full.warranty_months ?? prev.warranty_months_override,
        // Key attributes — pull directly from master.specs when present
        attrs_brand: full.brand || specs.brand || prev.attrs_brand,
        attrs_os: specs.operating_system || specs.os || prev.attrs_os,
        attrs_ram: specs.ram || prev.attrs_ram,
        attrs_cpu_model: specs.processor || specs.cpu_model || specs.cpu || prev.attrs_cpu_model,
        attrs_cpu_speed: specs.cpu_speed || prev.attrs_cpu_speed,
        attrs_storage: specs.storage || prev.attrs_storage,
        extra_attrs: extraAttrsToText(extras) || prev.extra_attrs,
        sub_features: linesFromArray(full.key_features || full.sub_features) || prev.sub_features,
        whats_in_box: linesFromArray(
          Array.isArray(full.whats_in_box)
            ? full.whats_in_box.map((it) => it?.name || it)
            : []
        ) || prev.whats_in_box,
        spec_tabs: specTabsText || prev.spec_tabs,
      }));
    }
  };

  const submitProduct = async () => {
    // Device identity block — required for anyone who typed anything into
    // the IMEI fields. See DeviceIdentitySection.validateDeviceIdentity.
    const idErr = validateDeviceIdentity(form);
    if (idErr) { alert(idErr); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price) || 0,
        offer_price: Number(form.offer_price) || 0,
        stock: Number(form.stock) || 0,
        mrp: Number(form.mrp) || 0,
        // Selling GST is stored as `gst_pct` so the POS auto-applies it at
        // billing (VendorPOS reads p.gst_pct). Keep selling_gst_pct too.
        gst_pct: Number(form.selling_gst_pct) || 0,
        selling_gst_pct: Number(form.selling_gst_pct) || 0,
        purchase_price: Number(form.purchase_price) || 0,
        purchase_gst_pct: Number(form.purchase_gst_pct) || 0,
        cashback_pct: Number(form.cashback_pct) || 0,
        free_delivery: !!form.free_delivery,
        warranty_months_override: Number(form.warranty_months_override) || 0,
        // Serialise the rich detail fields into the shapes the backend
        // (same as the admin flow) expects.
        sub_features: parseLines(form.sub_features),
        images: Array.isArray(form.images) ? form.images.slice(0, 10) : [],
        extra_attrs: parseExtraAttrs(form.extra_attrs),
        price_summary: toStyled(form.price_summary),
        protection_summary: toStyled(form.protection_summary),
        warranty_summary: toStyled(form.warranty_summary),
        delivery_summary: toStyled(form.delivery_summary),
        whats_in_box: parseLines(form.whats_in_box).map((name) => ({ name, image_data_url: "" })),
        spec_tabs: parseSpecTabs(form.spec_tabs),
        // Per-unit device identities → flat arrays the POS searches on.
        track_by_unit: !!form.track_by_unit,
        units: form.track_by_unit ? (form.units || []) : [],
        serial_numbers: form.track_by_unit
          ? (form.units || []).map((u) => u.serial_number).filter(Boolean)
          : (form.serial_number ? [form.serial_number] : []),
        imei_numbers: form.track_by_unit
          ? (form.units || []).flatMap((u) => [u.imei_1, u.imei_2].filter(Boolean))
          : [form.imei_1, form.imei_2].filter(Boolean),
        // Flatten location fields so backend can persist them directly on
        // the product doc (see BACKLOG_BACKEND_SPEC §13).
        location_pincode: form.location?.pincode || null,
        location_state: form.location?.state || null,
        location_district: form.location?.district || null,
        location_city: form.location?.city || null,
        location_address: form.location?.address || null,
        location_latitude: form.location?.latitude ? Number(form.location.latitude) : null,
        location_longitude: form.location?.longitude ? Number(form.location.longitude) : null,
        delivery_radius_km: form.location?.delivery_radius_km ?? null,
        delivery_scope: form.location?.delivery_scope || "km",
        delivery_available: form.location?.delivery_available !== false,
      };
      // Drop empty strings so backend receives explicit nulls / omits them.
      [
        "imei_1", "imei_2", "serial_number", "batch_number",
        "store_location", "store_notes",
        "attrs_brand", "attrs_os", "attrs_ram",
        "attrs_cpu_model", "attrs_cpu_speed", "attrs_storage",
        "clothing_size", "sub_category",
      ].forEach((k) => { if (!payload[k]) delete payload[k]; });
      if (editingId) {
        await api.patch(`/vendor/me/products/${editingId}`, payload);
      } else {
        await api.post("/vendor/me/products", { ...payload, is_published: false });
      }
      closeForm();
      loadAll();
    } catch (error) {
      log.error("VendorDashboard.save failed", error);
      const detail = error?.response?.data?.detail;
      if (detail === "imei_already_registered") {
        alert("This IMEI is already registered by another vendor. Please double-check the number.");
      } else {
        alert(detail || (editingId ? "Failed to update" : "Failed to create"));
      }
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await api.delete(`/vendor/me/products/${id}`);
      loadAll();
    } catch (error) {
      log.error("VendorDashboard.delete failed", error);
    }
  };

  if (loading) return <Layout title="Vendor"><Spinner /></Layout>;

  return (
    <Layout title="Vendor dashboard">
      <VendorNav />
      <div className="flex items-center gap-2 mb-4 font-extrabold text-[color:var(--sc-ink)]">
        <Store size={18} className="text-[color:var(--sc-primary)]" /> {stats?.vendor?.shop_name || "My shop"}
      </div>
      <NewOrdersAlert />
      <Stats stats={stats} />

      <div className="flex gap-2 mb-3 overflow-x-auto" data-testid="vd-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            data-testid={`vd-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`text-xs font-bold px-3 py-2 rounded-full border inline-flex items-center gap-1.5 ${tab === t.key ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "products" && (
        <>
          <div className="flex justify-end mb-2 gap-2">
            <button
              data-testid="vd-download-stock"
              onClick={() => {
                // Export CSV: Stock qty · Name · Price · Category · Sub-category · Pincode
                const rows = products.map((p) => ({
                  name: p.name || "",
                  stock: p.stock ?? 0,
                  price: p.price ?? 0,
                  mrp: p.mrp ?? "",
                  category: p.category || "",
                  sub_category: p.sub_category || p.subCategory || "",
                  brand: p.brand || "",
                  hsn: p.hsn || "",
                  sku: p.sku || "",
                  pincode: p.pincode || p.location?.pincode || "",
                  updated_at: p.updated_at || p.updatedAt || "",
                }));
                const headers = ["name","stock","price","mrp","category","sub_category","brand","hsn","sku","pincode","updated_at"];
                const escape = (v) => {
                  const s = String(v ?? "");
                  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
                };
                const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `stock_report_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              }}
              disabled={products.length === 0}
              className="sc-btn-outline inline-flex items-center gap-1.5 text-sm disabled:opacity-60"
              title="Download stock report — synced to admin (same data)"
            >
              <Download size={14} /> Stock report ({products.length})
            </button>
            <button data-testid="vd-new" onClick={openNew} className="sc-btn-primary inline-flex items-center gap-1.5 text-sm">
              <Plus size={14} /> Add product
            </button>
          </div>
          {products.length === 0 ? (
            <EmptyState icon={Package} title="No products yet" hint="Add your first product to start selling." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="vd-products">
              {products.map((p) => (
                <div key={p.id} className="sc-card overflow-hidden flex flex-col" data-testid={`vd-prod-${p.id}`}>
                  <div className="aspect-square bg-[color:var(--sc-accent-light)]">{p.image_url && <img alt="" src={resolveImageUrl(p.image_url)} className="w-full h-full object-cover" />}</div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="text-sm font-semibold line-clamp-2">{p.name}</div>
                    <div className="text-xs text-[color:var(--sc-ink-muted)] mt-0.5">Stock: {p.stock ?? "—"}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-extrabold">{formatINR(p.price)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => openEdit(p)}
                        data-testid={`vd-edit-${p.id}`}
                        className="inline-flex items-center justify-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-primary-700)] hover:bg-[color:var(--sc-accent-light)] transition-colors"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => del(p.id)}
                        data-testid={`vd-del-${p.id}`}
                        className="inline-flex items-center justify-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "sales" && (
        sales.length === 0
          ? <EmptyState icon={TrendingUp} title="No sales yet" />
          : (
            <div className="sc-card overflow-x-auto" data-testid="vd-sales">
              <table className="w-full text-sm">
                <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
                  <tr><th className="text-left px-4 py-2">Order</th><th className="text-left px-4 py-2">Product</th><th className="text-left px-4 py-2">Amount</th><th className="text-left px-4 py-2">Date</th></tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id} className="border-t border-[color:var(--sc-border)]">
                      <td className="px-4 py-2 font-mono text-xs">{(s.order_id || s.id || "").slice(0, 8)}</td>
                      <td className="px-4 py-2">{s.product_name || "—"}</td>
                      <td className="px-4 py-2 font-extrabold">{formatINR(s.amount || s.total)}</td>
                      <td className="px-4 py-2 text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}

      {tab === "questions" && (
        questions.length === 0
          ? <EmptyState icon={MessageSquare} title="No pending questions" />
          : (
            <div className="space-y-2" data-testid="vd-questions">
              {questions.map((q) => (
                <div key={q.id} className="sc-card p-4">
                  <div className="text-xs text-[color:var(--sc-ink-muted)]">{q.product_name} · {formatDateTime(q.created_at)}</div>
                  <div className="font-semibold mt-1">{q.question || q.text}</div>
                </div>
              ))}
            </div>
          )
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 sc-fade-in" data-testid="vd-form-modal">
            <div className="flex justify-between items-center mb-3">
              <div className="font-extrabold">{editingId ? "Edit product" : "New product"}</div>
              <button onClick={closeForm} aria-label="Close" data-testid="vd-form-close"><X size={18} /></button>
            </div>
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

              {/* ---- Section 1: Smart autocomplete (create mode only) ---- */}
              {!editingId && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-1.5 flex items-center gap-1.5">
                    <Sparkles size={12} /> Smart search
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-2 sc-input">
                      <Search size={16} className="text-[color:var(--sc-ink-muted)] shrink-0" />
                      <input
                        className="flex-1 bg-transparent outline-none"
                        placeholder="Start typing a product name, e.g. iPhone 15…"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setForm((f) => ({ ...f, name: e.target.value, master_id: null })); }}
                        data-testid="vd-form-search"
                        autoFocus
                      />
                      {suggestLoading && <Loader2 size={14} className="animate-spin text-[color:var(--sc-primary)]" />}
                      {form.master_id && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
                          <Check size={10} /> Master
                        </span>
                      )}
                    </div>
                    {suggestOpen && suggestions.length > 0 && (
                      <div
                        className="absolute z-10 left-0 right-0 mt-1 rounded-xl bg-white border border-[color:var(--sc-border)] shadow-lg max-h-72 overflow-y-auto"
                        data-testid="vd-form-suggestions"
                      >
                        {suggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => pickMaster(s)}
                            className="w-full flex items-center gap-3 p-2.5 hover:bg-[color:var(--sc-accent-light)] text-left border-b border-[color:var(--sc-border)] last:border-0"
                            data-testid={`vd-form-suggestion-${s.id}`}
                          >
                            {s.thumbnail ? (
                              <img alt="" src={s.thumbnail} className="w-10 h-10 rounded-md object-cover shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-[color:var(--sc-accent-light)] grid place-items-center shrink-0">
                                <Package size={16} className="text-[color:var(--sc-primary)]" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-[color:var(--sc-ink)] truncate">{s.name}</div>
                              <div className="text-[11px] text-[color:var(--sc-ink-muted)] truncate">
                                {s.brand}{s.model_number ? ` · ${s.model_number}` : ""}{s.category ? ` · ${s.category}` : ""}
                              </div>
                            </div>
                            {s.mrp ? <div className="text-xs font-bold text-[color:var(--sc-ink)] shrink-0">{formatINR(s.mrp)}</div> : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-1.5 text-[11px] text-[color:var(--sc-ink-muted)] flex items-start gap-1">
                    <Info size={11} className="mt-0.5 shrink-0" />
                    <span>Selecting a match auto-fills name, brand, description, image & MRP — you only add your selling price, stock and (for electronics) IMEI/serial.</span>
                  </div>
                </div>
              )}

              {/* ---- Section 2: Product basics ---- */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-1.5">Product details</div>
                <div className="space-y-2">
                  {editingId && (
                    <input className="sc-input" data-testid="vd-form-name" placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input className="sc-input" data-testid="vd-form-brand" placeholder="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                    <input
                      className="sc-input"
                      data-testid="vd-form-category"
                      placeholder="Category (pick or type)"
                      list="vd-cat-list"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    />
                    <datalist id="vd-cat-list">
                      {categories.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <input
                    className="sc-input"
                    data-testid="vd-form-sub-category"
                    placeholder="Sub-category (pick or type)"
                    list="vd-subcat-list"
                    value={form.sub_category}
                    onChange={(e) => setForm({ ...form, sub_category: e.target.value })}
                  />
                  <datalist id="vd-subcat-list">
                    {(subcatMap[form.category] || [...new Set(Object.values(subcatMap).flat())]).map((s) => <option key={s} value={s} />)}
                  </datalist>
                  <textarea className="sc-input min-h-[70px]" data-testid="vd-form-desc" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  <div className="flex items-center gap-3">
                    <input type="file" accept="image/*" onChange={onImg} data-testid="vd-form-img" className="block text-sm flex-1" />
                    <button type="button" onClick={() => setPicker("cover")} data-testid="vd-form-img-free" className="text-xs font-bold text-[color:var(--sc-primary-700)] border border-[color:var(--sc-border)] rounded-lg px-2.5 py-2 hover:bg-[color:var(--sc-accent-light)] whitespace-nowrap">Free image</button>
                    {form.image_url && <img alt="" src={form.image_url} className="h-14 w-14 rounded-lg border border-[color:var(--sc-border)] object-cover" />}
                  </div>

                  {/* Gallery — up to 10 images. Hydrated from Product Master
                      when the vendor picks a smart-search suggestion; also
                      accepts vendor-uploaded images. No compression applied. */}
                  <div>
                    <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                      Gallery (up to 10)
                      <span className="ml-1 font-normal text-[color:var(--sc-ink-muted)] text-[11px]">
                        auto-filled from smart-search master (no compression)
                      </span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={onExtraImgs}
                      className="block mt-1 text-sm"
                      data-testid="vd-form-gallery"
                    />
                    <button type="button" onClick={() => setPicker("gallery")} data-testid="vd-form-gallery-free" className="mt-1.5 text-xs font-bold text-[color:var(--sc-primary-700)] border border-[color:var(--sc-border)] rounded-lg px-2.5 py-1.5 hover:bg-[color:var(--sc-accent-light)]">+ Add free images</button>
                    {form.images?.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap" data-testid="vd-form-gallery-preview">
                        {form.images.map((u, i) => (
                          <div key={`${String(u).slice(-16)}-${i}`} className="relative">
                            <img alt="" src={u} className="h-14 w-14 rounded border border-[color:var(--sc-border)] object-cover" />
                            <button
                              type="button"
                              onClick={() => removeImage(i)}
                              aria-label={`Remove image ${i + 1}`}
                              className="absolute -top-1 -right-1 bg-[color:var(--sc-error)] text-white rounded-full w-4 h-4 grid place-items-center text-[10px]"
                              data-testid={`vd-form-gallery-remove-${i}`}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ---- Section 3: Vendor pricing + inventory ---- */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-1.5">Your pricing & stock</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Selling price
                    <input className="sc-input mt-1" data-testid="vd-form-price" type="number" placeholder="₹" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Offer price
                    <input className="sc-input mt-1" data-testid="vd-form-offer" type="number" placeholder="₹ (optional)" value={form.offer_price} onChange={(e) => setForm({ ...form, offer_price: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    MRP
                    <input className="sc-input mt-1" data-testid="vd-form-mrp" type="number" placeholder="₹" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Stock
                    <input className="sc-input mt-1" data-testid="vd-form-stock" type="number" placeholder="Qty" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                  </label>
                </div>
                {/* GST + cashback + private purchase economics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Selling GST %
                    <input className="sc-input mt-1" data-testid="vd-form-selling-gst" type="number" placeholder="%" value={form.selling_gst_pct} onChange={(e) => setForm({ ...form, selling_gst_pct: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Cashback %
                    <input className="sc-input mt-1" data-testid="vd-form-cashback" type="number" placeholder="%" value={form.cashback_pct} onChange={(e) => setForm({ ...form, cashback_pct: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Purchase price <span className="text-[color:var(--sc-ink-muted)] font-normal">(private, inc GST)</span>
                    <input className="sc-input mt-1" data-testid="vd-form-purchase-price" type="number" placeholder="₹" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Purchase GST %
                    <input className="sc-input mt-1" data-testid="vd-form-purchase-gst" type="number" placeholder="%" value={form.purchase_gst_pct} onChange={(e) => setForm({ ...form, purchase_gst_pct: e.target.value })} />
                  </label>
                </div>
                <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-1">Selling GST auto-applies on every POS bill. Purchase price &amp; GST stay private and feed your Smart-GST / profit math.</div>
              </div>

              {/* ---- Section 4: Fulfilment ---- */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] mb-1.5">Fulfilment</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Store location
                    <input className="sc-input mt-1" data-testid="vd-form-loc" placeholder="City / area" value={form.store_location} onChange={(e) => setForm({ ...form, store_location: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Condition
                    <select className="sc-input mt-1" data-testid="vd-form-condition" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                      {CONDITIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--sc-ink)]">
                    Warranty override (months)
                    <input className="sc-input mt-1" data-testid="vd-form-warranty" type="number" placeholder="0 = use manufacturer" value={form.warranty_months_override} onChange={(e) => setForm({ ...form, warranty_months_override: e.target.value })} />
                  </label>
                  <div className="grid grid-cols-2 gap-2 items-end">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--sc-ink)] px-3 py-2 rounded-lg border border-[color:var(--sc-border)]">
                      <input type="checkbox" data-testid="vd-form-cod" checked={form.cash_on_delivery} onChange={(e) => setForm({ ...form, cash_on_delivery: e.target.checked })} />
                      Cash on delivery
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--sc-ink)] px-3 py-2 rounded-lg border border-[color:var(--sc-border)]">
                      <input type="checkbox" data-testid="vd-form-delivery" checked={form.delivery_available} onChange={(e) => setForm({ ...form, delivery_available: e.target.checked })} />
                      Delivery available
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--sc-ink)] px-3 py-2 rounded-lg border border-[color:var(--sc-border)] sm:col-span-2">
                    <input type="checkbox" data-testid="vd-form-free-delivery" checked={form.free_delivery} onChange={(e) => setForm({ ...form, free_delivery: e.target.checked })} />
                    Free delivery (no shipping charge for this product)
                  </label>
                </div>
              </div>

              {/* ---- Section 4.5: Brand & Sub-Features ---- */}
              <details open>
                <summary className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] cursor-pointer py-1">Brand & Sub-Features</summary>
                <div className="space-y-2 mt-2">
                  <textarea
                    className="sc-input min-h-[70px]"
                    data-testid="vd-form-sub-features"
                    placeholder={"Key features (one per line)\nExample:\n8 GB RAM · 256 GB storage\n120 Hz AMOLED display"}
                    value={form.sub_features}
                    onChange={(e) => setForm({ ...form, sub_features: e.target.value })}
                  />
                  <textarea
                    className="sc-input min-h-[60px]"
                    data-testid="vd-form-whats-in-box"
                    placeholder="What's in the box (one item per line)"
                    value={form.whats_in_box}
                    onChange={(e) => setForm({ ...form, whats_in_box: e.target.value })}
                  />
                </div>
              </details>

              {/* ---- Section 4.5.5: Location & Delivery ---- */}
              <details open>
                <summary className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] cursor-pointer py-1">Location &amp; Delivery *</summary>
                <div className="mt-2">
                  <LocationBlock
                    value={form.location}
                    onChange={(loc) => setForm({ ...form, location: loc })}
                    testIdRoot="vd-form-loc"
                  />
                </div>
              </details>

              {/* ---- Section 4.6: Key Attributes ---- */}
              <details>
                <summary className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] cursor-pointer py-1">Key Attributes</summary>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input className="sc-input" data-testid="vd-form-attrs-brand" placeholder="Brand" value={form.attrs_brand} onChange={(e) => setForm({ ...form, attrs_brand: e.target.value })} />
                  <input className="sc-input" data-testid="vd-form-attrs-os" placeholder="OS" value={form.attrs_os} onChange={(e) => setForm({ ...form, attrs_os: e.target.value })} />
                  <input className="sc-input" data-testid="vd-form-attrs-ram" placeholder="RAM" value={form.attrs_ram} onChange={(e) => setForm({ ...form, attrs_ram: e.target.value })} />
                  <input className="sc-input" data-testid="vd-form-attrs-cpu" placeholder="CPU model" value={form.attrs_cpu_model} onChange={(e) => setForm({ ...form, attrs_cpu_model: e.target.value })} />
                  <input className="sc-input" data-testid="vd-form-attrs-speed" placeholder="CPU speed" value={form.attrs_cpu_speed} onChange={(e) => setForm({ ...form, attrs_cpu_speed: e.target.value })} />
                  <input className="sc-input" data-testid="vd-form-attrs-storage" placeholder="Storage" value={form.attrs_storage} onChange={(e) => setForm({ ...form, attrs_storage: e.target.value })} />
                  <input className="sc-input col-span-2" data-testid="vd-form-clothing" placeholder="Clothing size (if apparel)" value={form.clothing_size} onChange={(e) => setForm({ ...form, clothing_size: e.target.value })} />
                  <textarea
                    className="sc-input col-span-2 min-h-[60px]"
                    data-testid="vd-form-extra-attrs"
                    placeholder={"Extra attributes (one key:value per line)\nExample:\nColor: Black\nWeight: 250g"}
                    value={form.extra_attrs}
                    onChange={(e) => setForm({ ...form, extra_attrs: e.target.value })}
                  />
                </div>
              </details>

              {/* ---- Section 4.7: Specification Tabs ---- */}
              <details>
                <summary className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] cursor-pointer py-1">Specification Tabs</summary>
                <div className="space-y-1 mt-2">
                  <textarea
                    className="sc-input min-h-[80px] font-mono text-xs"
                    data-testid="vd-form-spec-tabs"
                    placeholder={"One tab per line.\nFormat: Tab Name | Label1:Value1; Label2:Value2\nExample:\nGeneral | Color:Black; Weight:250g\nDisplay | Size:6.5; Refresh:120Hz"}
                    value={form.spec_tabs}
                    onChange={(e) => setForm({ ...form, spec_tabs: e.target.value })}
                  />
                  <div className="text-[11px] text-[color:var(--sc-ink-muted)]">Each tab becomes a section on the product detail page. Auto-populated from smart search.</div>
                </div>
              </details>

              {/* ---- Section 4.8: Styled Summaries ---- */}
              <details>
                <summary className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--sc-ink-muted)] cursor-pointer py-1">Styled Summaries</summary>
                <div className="space-y-2 mt-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[color:var(--sc-ink)]">Price Summary</label>
                      <button
                        type="button"
                        onClick={applyStrikethrough}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-[color:var(--sc-primary-700)] hover:bg-[color:var(--sc-accent-light)] px-2 py-1 rounded"
                        data-testid="vd-form-strike"
                        title="Wrap selected text with ~~strikethrough~~ markers"
                      >
                        <Strikethrough size={12} /> Strike selected
                      </button>
                    </div>
                    <textarea
                      ref={priceSummaryRef}
                      className="sc-input mt-1 min-h-[50px]"
                      data-testid="vd-form-price-summary"
                      placeholder={"e.g. Was ~~₹49,999~~ now ₹32,999 · Extra ₹2,000 off on card"}
                      value={form.price_summary}
                      onChange={(e) => setForm({ ...form, price_summary: e.target.value })}
                    />
                  </div>
                  <input
                    className="sc-input"
                    data-testid="vd-form-protection-summary"
                    placeholder="Protection Summary"
                    value={form.protection_summary}
                    onChange={(e) => setForm({ ...form, protection_summary: e.target.value })}
                  />
                  <input
                    className="sc-input"
                    data-testid="vd-form-warranty-summary"
                    placeholder="Warranty Summary"
                    value={form.warranty_summary}
                    onChange={(e) => setForm({ ...form, warranty_summary: e.target.value })}
                  />
                  <input
                    className="sc-input"
                    data-testid="vd-form-delivery-summary"
                    placeholder="Delivery Summary"
                    value={form.delivery_summary}
                    onChange={(e) => setForm({ ...form, delivery_summary: e.target.value })}
                  />
                </div>
              </details>

              {/* ---- Section 5: Device identity ---- */}
              <DeviceIdentitySection form={form} setForm={setForm} testIdPrefix="vd-form" />

              {/* ---- Section 6: Store notes ---- */}
              <label className="block text-xs font-semibold text-[color:var(--sc-ink)]">
                Store notes (private — only admins see this)
                <textarea className="sc-input mt-1 min-h-[60px]" data-testid="vd-form-notes" placeholder="Anything you want the review team to know" value={form.store_notes} onChange={(e) => setForm({ ...form, store_notes: e.target.value })} />
              </label>

              <div className="rounded-lg bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)] text-[11px] px-3 py-2 leading-relaxed">
                Products you add are reviewed by our admin team and published to Slangcart Shop after approval. Publish state is managed by admins — you focus on the product details.
              </div>
              <button data-testid="vd-form-save" onClick={submitProduct} disabled={saving || !form.name || !form.price} className="sc-btn-primary inline-flex items-center gap-1.5 w-full justify-center py-2.5">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editingId ? "Save changes" : "Create product"}
              </button>
            </div>
          </div>
          <StockPhotoPicker
            open={!!picker}
            multiple={picker === "gallery"}
            onPick={onPickStock}
            onClose={() => setPicker(null)}
            testIdPrefix="vd-stock"
          />
        </div>
      )}
    </Layout>
  );
}
