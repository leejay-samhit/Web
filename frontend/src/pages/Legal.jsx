import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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

  return (
    <Layout title={TITLES[kind] || "Legal"}>
      {loading ? <Spinner /> : (
        <div className="sc-card p-6 lg:p-10 max-w-3xl" data-testid="legal-content">
          <div className="flex items-center gap-2 mb-4 text-[color:var(--sc-primary)]">
            <FileText size={20} />
            <h1 className="text-2xl font-extrabold text-[color:var(--sc-ink)]">{TITLES[kind] || kind}</h1>
          </div>
          {content ? (
            <div className="prose prose-sm max-w-none whitespace-pre-line text-[color:var(--sc-ink)]" dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <div className="text-sm text-[color:var(--sc-ink-muted)]">No content available.</div>
          )}
        </div>
      )}
    </Layout>
  );
}
