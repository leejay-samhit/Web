import { useRef, useState } from "react";
import { X, UploadCloud, FileDown, CheckCircle2, AlertTriangle, Play } from "lucide-react";
import { parseCsv, normaliseParsed, validateRow, PRODUCT_HEADERS, CSV_TEMPLATE } from "@/lib/csvImport";
import { saveProduct, paiseToRupees } from "@/lib/erp";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Drag-and-drop CSV importer with dry-run preview.
 *
 * Flow:
 *  1. User drops or picks a CSV, or pastes it directly.
 *  2. We parse + map headers to canonical Product Master fields.
 *  3. Dry-run table shows OK / errors per row — user picks which rows to commit.
 *  4. On Commit, we call saveProduct() for each valid row (falls back to
 *     localStorage if the backend endpoint is still 404).
 */
export default function ProductCsvImport({ vendorId, onClose, onImported }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null); // { headers, mapping, rows: [{row, canonical, ok, errors}], stats }
  const [committing, setCommitting] = useState(false);
  const [selected, setSelected] = useState({}); // row index → true
  const inputRef = useRef(null);

  const readFile = (file) => {
    const r = new FileReader();
    r.onload = () => { setText(String(r.result || "")); analyse(String(r.result || "")); };
    r.readAsText(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const onPick = (e) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const analyse = (csv) => {
    const parsed = parseCsv(csv);
    if (!parsed.headers.length) { setPreview(null); return; }
    const { mapping, rows } = normaliseParsed(parsed.headers, parsed.rows);
    const validated = rows.map((r) => {
      const { ok, value, errors } = validateRow(r);
      return { canonical: value, ok, errors };
    });
    const stats = {
      total: validated.length,
      ok: validated.filter((r) => r.ok).length,
      err: validated.filter((r) => !r.ok).length,
    };
    setPreview({ headers: parsed.headers, mapping, rows: validated, stats });
    const sel = {};
    validated.forEach((r, i) => { if (r.ok) sel[i] = true; });
    setSelected(sel);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "slangcart-products-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const commit = async () => {
    if (!preview) return;
    setCommitting(true);
    const toImport = preview.rows.filter((_, i) => selected[i] && preview.rows[i].ok);
    let done = 0;
    for (const row of toImport) {
      try { await saveProduct(vendorId, row.canonical); done++; } catch { /* skip */ }
    }
    toast.success(`Imported ${done} of ${toImport.length} products`);
    setCommitting(false);
    onImported?.();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4 overflow-y-auto" data-testid="erp-csv-import">
      <div className="sc-card w-full max-w-4xl p-5 my-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-lg font-extrabold">Bulk import products from CSV</div>
            <div className="text-xs text-[color:var(--sc-ink-muted)]">Drop your file, review the dry-run, tick which rows to commit.</div>
          </div>
          <button onClick={onClose} data-testid="csv-import-close"><X size={18} /></button>
        </div>

        {!preview && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="md:col-span-2 border-2 border-dashed border-[color:var(--sc-border)] rounded-2xl p-8 text-center cursor-pointer hover:border-[color:var(--sc-primary)] transition"
              data-testid="csv-import-dropzone"
            >
              <UploadCloud size={28} className="mx-auto text-[color:var(--sc-primary)]" />
              <div className="font-extrabold mt-2">Drop CSV here or click to pick</div>
              <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-1">
                Headers can be any casing — we auto-map to name, hsnCode, mrp, sellingPrice, gstPct, currentStock…
              </div>
              <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onPick} className="hidden" data-testid="csv-file-input" />
            </div>

            <div className="sc-card p-4 bg-[color:var(--sc-accent-light)]/40">
              <div className="text-sm font-extrabold mb-2">First time?</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)] mb-3">
                Download our template CSV, fill your products in Excel or Google Sheets, then upload.
              </div>
              <button
                onClick={downloadTemplate}
                className="w-full rounded-full px-3 py-2 text-xs font-semibold bg-white border border-[color:var(--sc-border)] inline-flex items-center justify-center gap-1.5"
                data-testid="csv-download-template"
              >
                <FileDown size={12} /> Download template
              </button>
              <div className="text-[10px] text-[color:var(--sc-ink-muted)] mt-3">
                Supported columns: {PRODUCT_HEADERS.slice(0, 8).join(", ")}, …
              </div>
            </div>
          </div>
        )}

        {!preview && (
          <div className="mt-4">
            <div className="text-xs font-semibold mb-1">…or paste CSV text directly</div>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => text && analyse(text)}
              placeholder="name,hsnCode,mrp,sellingPrice,gstPct,currentStock…"
              className="w-full rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm font-mono"
              data-testid="csv-paste"
            />
            <div className="text-right mt-2">
              <button onClick={() => analyse(text)} disabled={!text.trim()} className="rounded-full px-4 py-2 text-sm bg-[color:var(--sc-primary)] text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-50" data-testid="csv-run-dry">
                <Play size={12} /> Run dry-run
              </button>
            </div>
          </div>
        )}

        {preview && (
          <>
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <div className="text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full px-3 py-1" data-testid="csv-stats-ok">
                {preview.stats.ok} ready
              </div>
              {preview.stats.err > 0 && (
                <div className="text-xs font-semibold bg-red-50 border border-red-200 text-red-800 rounded-full px-3 py-1" data-testid="csv-stats-err">
                  {preview.stats.err} with errors
                </div>
              )}
              <div className="text-xs text-[color:var(--sc-ink-muted)]">{preview.stats.total} total rows</div>
              <button onClick={() => { setPreview(null); setText(""); }} className="ml-auto text-xs font-semibold text-[color:var(--sc-primary)]">Start over</button>
            </div>

            {/* Header mapping */}
            <div className="sc-card p-3 mb-3 text-xs">
              <div className="font-semibold mb-1">Column mapping</div>
              <div className="flex flex-wrap gap-1.5">
                {preview.mapping.map((m, i) => (
                  <span key={i} className={`px-2 py-0.5 rounded-full border ${m.to ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                    {m.from} → {m.to || "ignored"}
                  </span>
                ))}
              </div>
            </div>

            <div className="max-h-[45vh] overflow-y-auto sc-card mb-3">
              <table className="min-w-full text-xs">
                <thead className="bg-[color:var(--sc-accent-light)]/40 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left">✔</th>
                    <th className="px-2 py-1.5 text-left">#</th>
                    <th className="px-2 py-1.5 text-left">Name</th>
                    <th className="px-2 py-1.5 text-left">HSN</th>
                    <th className="px-2 py-1.5 text-right">MRP</th>
                    <th className="px-2 py-1.5 text-right">Sell</th>
                    <th className="px-2 py-1.5 text-right">GST%</th>
                    <th className="px-2 py-1.5 text-right">Stock</th>
                    <th className="px-2 py-1.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => {
                    const c = r.canonical;
                    return (
                      <tr key={i} className={`border-t border-[color:var(--sc-border)] ${!r.ok ? "bg-red-50/50" : ""}`} data-testid={`csv-row-${i}`}>
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            disabled={!r.ok}
                            checked={!!selected[i]}
                            onChange={(e) => setSelected({ ...selected, [i]: e.target.checked })}
                            data-testid={`csv-select-${i}`}
                          />
                        </td>
                        <td className="px-2 py-1 text-[color:var(--sc-ink-muted)]">{i + 1}</td>
                        <td className="px-2 py-1 font-semibold">{c.name || <span className="text-red-600">—</span>}</td>
                        <td className="px-2 py-1 font-mono">{c.hsnCode || "—"}</td>
                        <td className="px-2 py-1 text-right">{formatINR(paiseToRupees(c.mrp_paise))}</td>
                        <td className="px-2 py-1 text-right text-emerald-700">{formatINR(paiseToRupees(c.sellingPrice_paise))}</td>
                        <td className="px-2 py-1 text-right text-amber-700">{c.gstPct}%</td>
                        <td className="px-2 py-1 text-right">{c.currentStock}</td>
                        <td className="px-2 py-1">
                          {r.ok
                            ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={12} /> Ready</span>
                            : <span className="inline-flex items-center gap-1 text-red-700"><AlertTriangle size={12} /> {r.errors.join(", ")}</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="rounded-full px-4 py-2 text-sm border border-[color:var(--sc-border)]">Cancel</button>
              <button
                onClick={commit}
                disabled={committing || Object.values(selected).every((v) => !v)}
                className="rounded-full px-5 py-2 text-sm bg-[color:var(--sc-primary)] text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                data-testid="csv-commit-btn"
              >
                {committing ? "Importing…" : `Import ${Object.values(selected).filter(Boolean).length} products`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
