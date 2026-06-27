import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { initials, formatINR } from "@/lib/utils";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { log } from "@/lib/log";

function flatten(node, depth, parentKey, rows) {
  if (!node) return;
  const key = `${parentKey}/${node.id || node.email || node.referral_code || "n"}-${depth}`;
  const children = node.children || node.downlines || node.referrals || [];
  rows.push({ key, node, depth, hasChildren: children.length > 0, childCount: children.length });
  for (let i = 0; i < children.length; i++) {
    flatten(children[i], depth + 1, key, rows);
  }
}

function Row({ row, expanded, toggle }) {
  const { node, depth, hasChildren, childCount } = row;
  const open = expanded[row.key];
  return (
    <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: depth * 18 }}>
      {hasChildren ? (
        <button
          onClick={() => toggle(row.key)}
          className="w-6 h-6 rounded-md hover:bg-[color:var(--sc-accent-light)] grid place-items-center"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <span className="w-6 h-6" />
      )}
      <div className="w-8 h-8 rounded-full sc-avatar text-white text-[11px] font-bold grid place-items-center overflow-hidden">
        {node.profile_image ? (
          <img alt="" src={node.profile_image} className="w-full h-full object-cover" />
        ) : (
          initials(node.name)
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{node.name || "User"}</div>
        <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{node.referral_code || node.email}</div>
      </div>
      {hasChildren && <span className="ml-auto sc-chip">{childCount} ref</span>}
    </div>
  );
}

export default function Network() {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/users/me/network");
        if (alive) setTree(data);
      } catch (error) {
        log.error("Network.fetch failed", error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const root = tree?.root || tree;
  const counts = tree?.counts || {};

  const allRows = useMemo(() => {
    if (!root) return [];
    const out = [];
    flatten(root, 0, "root", out);
    return out;
  }, [root]);

  // Initialize: expand first level (depends on the row identity, not just count)
  useEffect(() => {
    if (allRows.length > 0) {
      const init = {};
      const firstKey = allRows[0]?.key;
      if (firstKey) init[firstKey] = true;
      setExpanded(init);
    }
  }, [allRows]);

  const toggle = useCallback((key) => setExpanded((e) => ({ ...e, [key]: !e[key] })), []);

  // Filter visible rows: a row is visible if all its ancestor keys are expanded
  const visibleRows = useMemo(() => {
    const out = [];
    for (const r of allRows) {
      if (r.depth === 0) {
        out.push(r);
        continue;
      }
      // ancestors are encoded in the key path "root/.../.../"
      const parts = r.key.split("/");
      parts.pop(); // self
      let ok = true;
      let cur = "";
      for (let i = 0; i < parts.length; i++) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i];
        if (i === 0) continue; // "root" itself isn't a row key
        if (!expanded[cur]) {
          ok = false;
          break;
        }
      }
      if (ok) out.push(r);
    }
    return out;
  }, [allRows, expanded]);

  return (
    <Layout title="Network">
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-5 sc-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Direct referrals", val: root?.direct_referrals_count ?? counts.direct ?? 0 },
              { label: "Total network", val: counts.total ?? counts.network ?? allRows.length - 1 },
              { label: "Wallet balance", val: formatINR(root?.wallet_balance) },
              { label: "Total earned", val: formatINR(root?.total_earned) },
            ].map((s) => (
              <div key={s.label} className="sc-card p-4">
                <div className="text-xs font-semibold text-[color:var(--sc-ink-muted)]">{s.label}</div>
                <div className="text-xl font-extrabold mt-1">{s.val}</div>
              </div>
            ))}
          </div>
          <div className="sc-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} className="text-[color:var(--sc-primary)]" />
              <div className="font-extrabold">Matrix tree</div>
            </div>
            {!root ? (
              <div className="text-sm text-[color:var(--sc-ink-muted)]">No data.</div>
            ) : (
              <div data-testid="network-tree">
                {visibleRows.map((r) => (
                  <Row key={r.key} row={r} expanded={expanded} toggle={toggle} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
