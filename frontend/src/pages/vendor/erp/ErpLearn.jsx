import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import { LEARNING_TOPICS } from "@/lib/learningContent";
import { listLearn, getLearn } from "@/lib/erp";
import { GraduationCap, ArrowLeft } from "lucide-react";

export default function ErpLearn() {
  const [topics, setTopics] = useState(LEARNING_TOPICS);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      const remote = await listLearn();
      if (Array.isArray(remote) && remote.length > 0) setTopics(remote);
    })();
  }, []);

  const openTopic = async (slug) => {
    // Try remote first; fall back to bundled content
    const remote = await getLearn(slug);
    const bundled = LEARNING_TOPICS.find((t) => t.slug === slug);
    setSelected(remote?.body ? remote : bundled);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6" data-testid="erp-learn">
        <VendorNav />
        <ErpNav />

        <div className="sc-card p-5 mb-4 bg-gradient-to-r from-emerald-50 to-white ring-1 ring-emerald-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center"><GraduationCap size={18} /></div>
            <div>
              <div className="font-extrabold">Smart Retail Learning Center</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)]">Everything a shopkeeper needs to know about GST, profit, ITC and more — in plain English.</div>
            </div>
          </div>
        </div>

        {selected ? (
          <div className="sc-card p-5">
            <button onClick={() => setSelected(null)} className="text-xs font-semibold text-[color:var(--sc-primary)] inline-flex items-center gap-1 mb-3" data-testid="learn-back">
              <ArrowLeft size={12} /> All topics
            </button>
            <div className="text-lg font-extrabold mb-2">{selected.title}</div>
            <div className="prose prose-sm max-w-none whitespace-pre-line text-sm leading-relaxed" data-testid="learn-body">
              {selected.body}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topics.map((t) => (
              <button
                key={t.slug}
                onClick={() => openTopic(t.slug)}
                className="sc-card p-4 text-left hover:shadow-lg transition"
                data-testid={`learn-tile-${t.slug}`}
              >
                <div className="font-extrabold text-sm">{t.title}</div>
                <div className="text-xs text-[color:var(--sc-ink-muted)] mt-1">{t.excerpt}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
