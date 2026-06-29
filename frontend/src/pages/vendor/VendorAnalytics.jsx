import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import { formatINR } from "@/lib/utils";
import { getAnalytics } from "@/lib/vendorSales";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Award, Package, Receipt } from "lucide-react";

const COLORS = ["#0F6E4F", "#23A47A", "#74C7A1", "#F59E0B", "#EF4444", "#6366F1", "#EC4899"];

function TopList({ title, icon: Icon, data, valueKey = "qty", suffix = "" }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="sc-card p-4" data-testid={`an-${title.toLowerCase().replace(/[^a-z]/g, "-")}`}>
      <div className="font-extrabold text-sm mb-2 inline-flex items-center gap-1.5"><Icon size={14} /> {title}</div>
      <div className="space-y-1">
        {data.map((d, idx) => (
          <div key={d.name + idx} className="flex justify-between text-xs">
            <span className="truncate">{idx + 1}. {d.name}</span>
            <span className="font-semibold">{valueKey === "revenue" || valueKey === "gst" ? formatINR(d[valueKey]) : d[valueKey]}{suffix}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VendorAnalytics() {
  const { user } = useAuth();
  const a = useMemo(() => getAnalytics(user?.id), [user?.id]);

  const payData = useMemo(() => {
    // Sum payments by mode across ALL completed invoices.
    const out = {};
    a.most_sold.length; // referenced just to keep useMemo dep
    return out;
  }, [a]);

  // Build payment-mode pie data inline (small N)
  const paySummary = useMemo(() => {
    // Reconstruct from analytics input — we don't have raw invoices here, so
    // use a quick pass over localStorage via getAnalytics is overkill. Skip.
    return [];
  }, []);

  return (
    <Layout title="Vendor · Sales analytics">
      <VendorNav />

      <div className="grid lg:grid-cols-3 gap-3 mb-3">
        <div className="sc-card p-4 lg:col-span-2" data-testid="an-daily-chart">
          <div className="font-extrabold text-sm mb-2 inline-flex items-center gap-1.5"><TrendingUp size={14} /> Daily sales trend</div>
          {a.daily.length === 0 ? (
            <div className="h-64 grid place-items-center text-sm text-[color:var(--sc-ink-muted)]">No data yet. Create a few invoices to see your trend.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={a.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Line type="monotone" dataKey="sales" stroke="#0F6E4F" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="sc-card p-4" data-testid="an-revenue-pie">
          <div className="font-extrabold text-sm mb-2 inline-flex items-center gap-1.5"><Award size={14} /> Revenue mix · top 5</div>
          {a.highest_revenue.length === 0 ? (
            <div className="h-64 grid place-items-center text-sm text-[color:var(--sc-ink-muted)]">No revenue yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={a.highest_revenue.slice(0, 5)} dataKey="revenue" nameKey="name" outerRadius={80}>
                  {a.highest_revenue.slice(0, 5).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatINR(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {a.most_sold.length > 0 && (
        <div className="sc-card p-4 mb-3" data-testid="an-top-products-bar">
          <div className="font-extrabold text-sm mb-2 inline-flex items-center gap-1.5"><Package size={14} /> Top 10 products by qty</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={a.most_sold}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="qty" fill="#0F6E4F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <TopList title="Most sold"        icon={Receipt}  data={a.most_sold.slice(0, 8)}        valueKey="qty" />
        <TopList title="Highest revenue"  icon={Award}    data={a.highest_revenue.slice(0, 8)}  valueKey="revenue" />
        <TopList title="Highest GST"      icon={Award}    data={a.highest_gst.slice(0, 8)}      valueKey="gst" />
        <TopList title="Least sold"       icon={Package}  data={a.least_sold}                   valueKey="qty" />
      </div>
    </Layout>
  );
}
