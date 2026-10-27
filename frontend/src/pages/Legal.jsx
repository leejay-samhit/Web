import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { FileText } from "lucide-react";
import { log } from "@/lib/log";

const TITLES = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  refund: "Refund Policy",
  shipping: "Shipping Policy",
  about: "About Slangcart",
  contact_us: "Contact Us",
  contact: "Contact Us",
};

// Lightweight, safe Markdown → HTML (the backend stores legal pages as
// Markdown in `content_text`). Everything is HTML-escaped first, then a small
// set of block/inline rules is applied, then DOMPurify sanitizes the result.
function mdToHtml(md) {
  if (!md) return "";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (t) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/(^|[\s(])((?:https?:\/\/|mailto:)[^\s)]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>');
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) { closeList(); html += `<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`; }
    else if (/^##\s+/.test(line)) { closeList(); html += `<h2>${inline(line.replace(/^##\s+/, ""))}</h2>`; }
    else if (/^#\s+/.test(line)) { closeList(); html += `<h2>${inline(line.replace(/^#\s+/, ""))}</h2>`; }
    else if (/^[-*]\s+/.test(line)) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`; }
    else if (line === "") { closeList(); }
    else { closeList(); html += `<p>${inline(line)}</p>`; }
  }
  closeList();
  return html;
}

export default function Legal() {
  const { kind = "terms" } = useParams();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/legal/${kind}`);
        // Backend serves Markdown in `content_text`; keep legacy fallbacks.
        if (alive) setContent(data?.content_text || data?.body || data?.content || "");
      } catch (error) {
        log.error("Legal.load failed", error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [kind]);

  const sanitized = useMemo(
    () =>
      DOMPurify.sanitize(mdToHtml(content), {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form"],
        FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
        ADD_ATTR: ["target", "rel"],
      }),
    [content],
  );

  return (
    <Layout title={TITLES[kind] || "Legal"}>
      {loading ? <Spinner /> : (
        <div className="sc-card p-6 lg:p-10 max-w-3xl" data-testid="legal-content">
          <div className="flex items-center gap-2 mb-4 text-[color:var(--sc-primary)]">
            <FileText size={20} />
            <h1 className="text-2xl font-extrabold text-[color:var(--sc-ink)]">{TITLES[kind] || kind}</h1>
          </div>
          {content ? (
            <div
              className="sc-legal-prose max-w-none text-[color:var(--sc-ink)]"
              dangerouslySetInnerHTML={{ __html: sanitized }}
            />
          ) : (
            <div className="text-sm text-[color:var(--sc-ink-muted)]">No content available.</div>
          )}
        </div>
      )}
    </Layout>
  );
}
