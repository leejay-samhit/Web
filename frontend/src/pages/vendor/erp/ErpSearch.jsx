import { useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import { erpSearch } from "@/lib/erp";
import { Search as SearchIcon } from "lucide-react";

const TYPES = [
  { code: "product",  label: "Product" },
  { code: "barcode",  label: "Barcode" },
  { code: "supplier", label: "Supplier" },
  { code: "invoice",  label: "Invoice" },
  { code: "gstin",    label: "GSTIN" },
  { code: "category", label: "Category" },
  { code: "brand",    label: "Brand" },
  { code: "batch",    label: "Batch" },
];

export default function ErpSearch() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("product");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);

  const run = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setPending(false);
    try {
      const d = await erpSearch({ q, type });
      setResults(Array.isArray(d) ? d : d?.items || []);
    } catch {
      setPending(true);
      setResults([]);
    }
    setBusy(false);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6" data-testid="erp-search">
        <VendorNav />
        <ErpNav />

        <form onSubmit={run} className="sc-card p-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <SearchIcon size={16} className="text-[color:var(--sc-ink-muted)]" />
              <input
                type="text"
                placeholder="Type to search…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="flex-1 border-none outline-none text-sm bg-transparent"
                data-testid="erp-search-input"
              />
            </div>
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm" data-testid="erp-search-type">
              {TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
            <button type="submit" disabled={busy} className="rounded-full px-4 py-2 bg-[color:var(--sc-primary)] text-white text-sm font-semibold disabled:opacity-50">
              {busy ? "Searching…" : "Search"}
            </button>
          </div>
        </form>


        {results.length === 0 ? (
          <div className="sc-card p-8 text-center text-sm text-[color:var(--sc-ink-muted)]" data-testid="erp-search-empty">Enter a query above.</div>
        ) : (
          <div className="sc-card">
            {results.map((r, i) => (
              <div key={i} className="p-3 border-b border-[color:var(--sc-border)] text-sm">
                <div className="font-semibold">{r.title || r.name}</div>
                {r.subtitle && <div className="text-xs text-[color:var(--sc-ink-muted)]">{r.subtitle}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
