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
};

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
        if (alive) setContent(data?.body || data?.content || "");
      } catch (error) {
        log.error("Legal.load failed", error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [kind]);

  // Sanitize legal HTML to prevent XSS attacks. Only allow a safe subset of
  // formatting tags / attributes. SVG and inline-event handlers are stripped.
  const sanitized = useMemo(
    () =>
      DOMPurify.sanitize(content || "", {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form"],
        FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
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
              className="prose prose-sm max-w-none whitespace-pre-line text-[color:var(--sc-ink)]"
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
