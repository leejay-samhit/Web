import { useState, useCallback } from "react";
import { Search, X, Loader2, ImageIcon, Check } from "lucide-react";
import { searchStockImages } from "@/lib/erp";

/**
 * Keyless stock-photo picker (Openverse via local backend). Lets the vendor
 * search free images and pick one (cover) or several (gallery). No API key or
 * device upload needed.
 *
 * Props:
 *   open, onClose
 *   onPick(url)        — called for each selected image url
 *   multiple=false     — allow picking several before closing
 *   testIdPrefix="stock"
 */
export default function StockPhotoPicker({ open, onClose, onPick, multiple = false, testIdPrefix = "stock" }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState([]);

  const run = useCallback(async () => {
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchStockImages(query);
      setResults(res);
    } finally {
      setLoading(false);
    }
  }, [q]);

  if (!open) return null;

  const choose = (url) => {
    if (multiple) {
      setPicked((p) => (p.includes(url) ? p.filter((u) => u !== url) : [...p, url]));
    } else {
      onPick(url);
      onClose();
    }
  };

  const confirmMulti = () => {
    picked.forEach((u) => onPick(u));
    setPicked([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 grid place-items-center p-4" data-testid={`${testIdPrefix}-modal`}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden sc-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--sc-border)]">
          <div className="flex items-center gap-2 font-extrabold text-[color:var(--sc-ink)]">
            <ImageIcon size={18} className="text-[color:var(--sc-primary)]" /> Free image picker
          </div>
          <button onClick={onClose} aria-label="Close" data-testid={`${testIdPrefix}-close`}><X size={18} /></button>
        </div>

        <div className="p-4 flex items-center gap-2 border-b border-[color:var(--sc-border)]">
          <div className="flex-1 flex items-center gap-2 sc-input py-2">
            <Search size={16} className="text-[color:var(--sc-ink-muted)]" />
            <input
              autoFocus
              data-testid={`${testIdPrefix}-q`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="Search free photos e.g. rice bag, t-shirt, phone"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
          <button onClick={run} disabled={loading || !q.trim()} className="sc-btn-primary text-sm py-2" data-testid={`${testIdPrefix}-search`}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Search"}
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1" data-testid={`${testIdPrefix}-results`}>
          {loading && <div className="py-10 grid place-items-center text-[color:var(--sc-ink-muted)]"><Loader2 className="animate-spin" /></div>}
          {!loading && searched && results.length === 0 && (
            <div className="py-10 text-center text-sm text-[color:var(--sc-ink-muted)]">No images found. Try another keyword.</div>
          )}
          {!loading && !searched && (
            <div className="py-10 text-center text-sm text-[color:var(--sc-ink-muted)]">Type a keyword and search to browse free images.</div>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {results.map((r, i) => {
              const sel = picked.includes(r.url);
              return (
                <button
                  key={r.id || i}
                  type="button"
                  onClick={() => choose(r.url)}
                  data-testid={`${testIdPrefix}-img-${i}`}
                  className={"relative aspect-square rounded-lg overflow-hidden border-2 transition-colors " + (sel ? "border-[color:var(--sc-primary)]" : "border-transparent hover:border-[color:var(--sc-border)]")}
                  title={r.title}
                >
                  <img alt={r.title} src={r.thumb} className="w-full h-full object-cover" loading="lazy" />
                  {sel && (
                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[color:var(--sc-primary)] text-white grid place-items-center">
                      <Check size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {multiple && (
          <div className="p-3 border-t border-[color:var(--sc-border)] flex items-center justify-between">
            <span className="text-xs text-[color:var(--sc-ink-muted)]">{picked.length} selected</span>
            <button onClick={confirmMulti} disabled={picked.length === 0} className="sc-btn-primary text-sm py-2" data-testid={`${testIdPrefix}-add-selected`}>
              Add {picked.length || ""} to gallery
            </button>
          </div>
        )}
        <div className="px-4 py-2 bg-[color:var(--sc-accent-light)] text-[10px] text-[color:var(--sc-primary-700)] text-center">
          Free images via Openverse. Please confirm you have the right to use an image before publishing.
        </div>
      </div>
    </div>
  );
}
