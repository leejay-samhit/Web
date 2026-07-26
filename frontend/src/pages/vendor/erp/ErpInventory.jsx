import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import DashboardCard from "@/components/erp/DashboardCard";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/utils";
import { inventorySummary, listProducts, paiseToRupees } from "@/lib/erp";
import { Boxes, AlertTriangle, Ban, Clock, Package, TrendingUp, TrendingDown } from "lucide-react";

export default function ErpInventory() {
  const { user } = useAuth();
  const vendorId = user?.id || user?._id || "anon";
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [s, p] = await Promise.all([inventorySummary(vendorId), listProducts(vendorId)]);
    setSummary(s);
    setProducts(p);
    setLoading(false);
  }, [vendorId]);

  useEffect(() => { refresh(); }, [refresh]);

  const low = products.filter((p) => (p.currentStock || 0) > 0 && (p.currentStock || 0) <= (p.lowStockAlert || 0));
  const outOfStock = products.filter((p) => (p.currentStock || 0) === 0);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6" data-testid="erp-inventory">
        <VendorNav />
        <ErpNav />

        {loading || !summary ? (
          <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading inventory…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <DashboardCard icon={Boxes}       label="Current stock"     value={summary.currentStock} tone="stock" testId="inv-current" />
              <DashboardCard icon={Package}     label="Available stock"   value={summary.availableStock} tone="stock" testId="inv-available" />
              <DashboardCard icon={Clock}       label="Reserved stock"    value={summary.reservedStock} tone="default" testId="inv-reserved" />
              <DashboardCard icon={Package}     label="Inventory value"   value={formatINR(paiseToRupees(summary.inventoryValue_paise))} tone="stock" testId="inv-value" />
              <DashboardCard icon={AlertTriangle} label="Low stock"       value={summary.lowStockCount} tone="danger" testId="inv-low" />
              <DashboardCard icon={Ban}         label="Out of stock"      value={summary.outOfStockCount} tone="danger" testId="inv-oos" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <MoversPanel icon={TrendingUp} title="Fast moving (30 days)" items={summary.fastMoving || []} empty="Sales data will appear once billing goes live." tone="text-emerald-700" />
              <MoversPanel icon={TrendingDown} title="Slow moving (30 days)" items={summary.slowMoving || []} empty="No slow-moving items yet." tone="text-red-700" />
            </div>

            <StockPanel title="Low stock" items={low} tone="amber" testId="inv-low-list" />
            <StockPanel title="Out of stock" items={outOfStock} tone="red" testId="inv-oos-list" />
          </>
        )}
      </div>
    </Layout>
  );
}

function MoversPanel({ icon: Icon, title, items, empty, tone }) {
  return (
    <div className="sc-card p-4">
      <div className={`text-sm font-extrabold mb-2 inline-flex items-center gap-1.5 ${tone}`}><Icon size={14} /> {title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-[color:var(--sc-ink-muted)]">{empty}</div>
      ) : (
        <ul className="text-sm space-y-1.5">
          {items.map((it) => (
            <li key={it.productId} className="flex items-center justify-between">
              <span>{it.name}</span>
              <span className="font-semibold">{it.soldQty30d ?? it.daysSinceLastSale ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StockPanel({ title, items, tone, testId }) {
  if (items.length === 0) return null;
  const bg = tone === "amber" ? "from-amber-50 to-white ring-amber-200 text-amber-800" : "from-red-50 to-white ring-red-200 text-red-800";
  return (
    <div className={`sc-card p-4 mb-4 bg-gradient-to-br ring-1 ${bg}`} data-testid={testId}>
      <div className="font-extrabold text-sm mb-2">{title} ({items.length})</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
        {items.slice(0, 30).map((p) => (
          <div key={p._id} className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-1.5">
            <span className="font-semibold truncate">{p.name}</span>
            <span className="text-xs">{p.currentStock || 0} {p.unit || "pcs"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
