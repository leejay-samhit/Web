import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { formatINR, formatDateTime } from "@/lib/utils";
import { Store, Package, TrendingUp, MessageSquare, Plus, X, Loader2 } from "lucide-react";
import { log } from "@/lib/log";
import VendorNav from "@/components/vendor/VendorNav";

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

export default function VendorDashboard() {
  const [tab, setTab] = useState("products");
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", price: 0, image_url: "", description: "", stock: 0, brand: "", category: "", is_published: true });
  const [creating, setCreating] = useState(false);

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
      if (p.status === "fulfilled") setProducts(p.value.data?.items || p.value.data || []);
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

  const createProduct = async () => {
    setCreating(true);
    try {
      await api.post("/vendor/me/products", { ...form, price: Number(form.price), stock: Number(form.stock) });
      setShowNew(false);
      setForm({ name: "", price: 0, image_url: "", description: "", stock: 0, brand: "", category: "", is_published: true });
      loadAll();
    } catch (error) {
      log.error("VendorDashboard.create failed", error);
      alert(error?.response?.data?.detail || "Failed to create");
    } finally {
      setCreating(false);
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
          <div className="flex justify-end mb-2">
            <button data-testid="vd-new" onClick={() => setShowNew(true)} className="sc-btn-primary inline-flex items-center gap-1.5 text-sm">
              <Plus size={14} /> Add product
            </button>
          </div>
          {products.length === 0 ? (
            <EmptyState icon={Package} title="No products yet" hint="Add your first product to start selling." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="vd-products">
              {products.map((p) => (
                <div key={p.id} className="sc-card overflow-hidden flex flex-col" data-testid={`vd-prod-${p.id}`}>
                  <div className="aspect-square bg-[color:var(--sc-accent-light)]">{p.image_url && <img alt="" src={p.image_url} className="w-full h-full object-cover" />}</div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="text-sm font-semibold line-clamp-2">{p.name}</div>
                    <div className="text-xs text-[color:var(--sc-ink-muted)] mt-0.5">Stock: {p.stock ?? "—"}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-extrabold">{formatINR(p.price)}</span>
                      <button onClick={() => del(p.id)} data-testid={`vd-del-${p.id}`} className="text-[color:var(--sc-error)] text-xs font-semibold">Delete</button>
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

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 sc-fade-in" data-testid="vd-new-modal">
            <div className="flex justify-between items-center mb-3">
              <div className="font-extrabold">New product</div>
              <button onClick={() => setShowNew(false)}><X size={18} /></button>
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              <input className="sc-input" data-testid="vd-new-name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="sc-input" data-testid="vd-new-price" type="number" placeholder="Price (₹)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                <input className="sc-input" data-testid="vd-new-stock" type="number" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <input className="sc-input" data-testid="vd-new-brand" placeholder="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              <input className="sc-input" data-testid="vd-new-category" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <textarea className="sc-input min-h-[80px]" data-testid="vd-new-desc" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <input type="file" accept="image/*" onChange={onImg} data-testid="vd-new-img" className="block text-sm" />
              {form.image_url && <img alt="" src={form.image_url} className="h-20 rounded-lg border border-[color:var(--sc-border)]" />}
              <button data-testid="vd-new-save" onClick={createProduct} disabled={creating || !form.name || !form.price} className="sc-btn-primary inline-flex items-center gap-1.5 w-full justify-center">
                {creating && <Loader2 size={14} className="animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
