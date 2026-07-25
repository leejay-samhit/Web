import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import BackendPendingBanner from "@/components/erp/BackendPendingBanner";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import { listAudit } from "@/lib/erp";
import { formatDateTime } from "@/lib/utils";
import { ScrollText } from "lucide-react";

export default function ErpAudit() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6" data-testid="erp-audit">
        <VendorNav />
        <ErpNav />
        <OwnerLockGate title="Audit Log — Owner verification required">
          {(pwd) => <Inner ownerPassword={pwd} />}
        </OwnerLockGate>
      </div>
    </Layout>
  );
}

function Inner({ ownerPassword }) {
  const [rows, setRows] = useState([]);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await listAudit({ limit: 200 }, ownerPassword);
        if (!Array.isArray(d) || d.length === 0) setPending(true);
        else setRows(d);
      } catch { setPending(true); }
      setLoading(false);
    })();
  }, [ownerPassword]);

  return (
    <>
      <div className="sc-card p-4 mb-3 flex items-center gap-2">
        <ScrollText size={16} className="text-[color:var(--sc-primary)]" />
        <div className="font-extrabold">Audit log</div>
      </div>
      {pending && <BackendPendingBanner endpoint="/api/erp/audit" note="Audit rows appear as the backend ships." />}
      {loading ? (
        <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="sc-card p-8 text-center text-sm text-[color:var(--sc-ink-muted)]" data-testid="audit-empty">No audit rows yet.</div>
      ) : (
        <div className="sc-card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)]/40 text-[11px] uppercase text-[color:var(--sc-ink-muted)]">
              <tr>
                <th className="text-left px-3 py-2">When</th>
                <th className="text-left px-3 py-2">Actor</th>
                <th className="text-left px-3 py-2">Action</th>
                <th className="text-left px-3 py-2">Entity</th>
                <th className="text-left px-3 py-2">Old → New</th>
                <th className="text-left px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-t border-[color:var(--sc-border)]" data-testid={`audit-row-${r._id}`}>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDateTime(r.at)}</td>
                  <td className="px-3 py-2 text-xs">{r.actorUserId} <span className="text-[color:var(--sc-ink-muted)]">({r.actorRole})</span></td>
                  <td className="px-3 py-2 text-xs font-mono">{r.action}</td>
                  <td className="px-3 py-2 text-xs">{r.entityType}#{r.entityId}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.oldValue != null && <span className="text-red-600 line-through mr-1">{JSON.stringify(r.oldValue)}</span>}
                    {r.newValue != null && <span className="text-emerald-700">{JSON.stringify(r.newValue)}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
