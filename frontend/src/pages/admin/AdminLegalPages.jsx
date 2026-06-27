import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Save, Loader2 } from "lucide-react";
import { log } from "@/lib/log";

const KINDS = ["terms", "privacy", "refund", "shipping", "about", "contact_us"];

export default function AdminLegalPages() {
  const [allPages, setAllPages] = useState({});
  const [kind, setKind] = useState("terms");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/legal");
      let map = {};
      const arr = data?.items || (Array.isArray(data) ? data : []);
      if (Array.isArray(arr)) {
        arr.forEach((p) => { if (p.kind) map[p.kind] = p; });
      } else if (data && typeof data === "object") {
        map = data;
      }
      setAllPages(map);
      const current = map[kind] || {};
      setContent(current.content_text || current.content || current.body || "");
      setTitle(current.title || "");
    } catch (error) { log.error("AdminLegalPages.load failed", error); }
    finally { setLoading(false); }
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await api.put(`/admin/legal/${kind}`, { title, content_text: content });
      setMsg("Saved.");
    } catch (e) { setMsg(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  if (loading) return <Layout title="Admin · Legal pages"><Spinner /></Layout>;

  return (
    <Layout title="Admin · Legal pages (editable)">
      <div className="flex flex-wrap gap-2 mb-4">
        {KINDS.map((k) => (
          <button key={k} data-testid={`lp-tab-${k}`} onClick={() => setKind(k)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border capitalize ${kind === k ? "bg-[color:var(--sc-primary)] text-white border-[color:var(--sc-primary)]" : "bg-white border-[color:var(--sc-border)]"}`}>
            {k}
          </button>
        ))}
      </div>

      <div className="sc-card p-5 max-w-4xl" data-testid="lp-editor">
        <div className="font-extrabold mb-3">Edit /legal/{kind}</div>
        <input className="sc-input" data-testid="lp-title" placeholder="Page title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="sc-input mt-2 min-h-[400px] font-mono text-sm" data-testid="lp-content" placeholder="Markdown / HTML content…" value={content} onChange={(e) => setContent(e.target.value)} />
        {msg && <div data-testid="lp-msg" className="mt-2 text-sm font-semibold text-[color:var(--sc-primary)]">{msg}</div>}
        <button data-testid="lp-save" disabled={saving} onClick={save} className="sc-btn-primary mt-3 inline-flex items-center gap-1.5">
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save page
        </button>
      </div>
    </Layout>
  );
}
