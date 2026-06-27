import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { initials, formatINR } from "@/lib/utils";
import { Ban, CheckCircle2, Search } from "lucide-react";
import { log } from "@/lib/log";

export default function AdminVendors() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/vendors", { params: { q, limit: 100 } });
      setList(data?.items || (Array.isArray(data) ? data : []));
    } catch (error) { log.error("AdminVendors.load failed", error); }
    finally { setLoading(false); }
  }, [q]);
  useEffect(() => { load(); }, [load]);

  const suspend = async (v) => {
    if (!window.confirm(`Suspend ${v.name}?`)) return;
    setActing(v.id);
    try { await api.post(`/admin/vendors/${v.id}/suspend`); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setActing(null); }
  };

  const reactivate = async (v) => {
    setActing(v.id);
    try { await api.post(`/admin/vendors/${v.id}/reactivate`); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setActing(null); }
  };

  return (
    <Layout title="Admin · All vendors">
      <div className="sc-card p-3 flex items-center gap-2 mb-4">
        <Search size={16} className="text-[color:var(--sc-ink-muted)] ml-1" />
        <input data-testid="av-q" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Search vendors" className="flex-1 bg-transparent outline-none text-sm" />
        <button data-testid="av-search" onClick={load} className="sc-btn-primary text-sm py-1.5">Search</button>
      </div>

      {loading ? <Spinner /> : (
        <div className="sc-card overflow-x-auto" data-testid="av-table">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr><th className="text-left px-4 py-2.5">Vendor</th><th className="text-left px-4 py-2.5">Email</th><th className="text-left px-4 py-2.5">Phone</th><th className="text-left px-4 py-2.5">Wallet</th><th className="text-left px-4 py-2.5">Status</th><th className="text-right px-4 py-2.5">Actions</th></tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id} className="border-t border-[color:var(--sc-border)]" data-testid={`av-${v.id}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full sc-avatar text-white text-[11px] font-bold grid place-items-center">{initials(v.name)}</div>
                      <div className="font-semibold">{v.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{v.email}</td>
                  <td className="px-4 py-2.5 text-xs">{v.phone || "—"}</td>
                  <td className="px-4 py-2.5">{formatINR(v.wallet_balance ?? v.total_sales ?? 0)}</td>
                  <td className="px-4 py-2.5">
                    {(v.is_suspended || v.is_blocked) ? <span className="sc-chip" style={{ background: "#FBEAEA", color: "#9c2b2b" }}>Suspended</span>
                      : <span className="sc-chip">Active</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {(v.is_suspended || v.is_blocked) ? (
                      <button data-testid={`av-reactivate-${v.id}`} disabled={acting === v.id} onClick={() => reactivate(v)} className="text-xs font-semibold px-2 py-1 rounded-lg bg-[color:var(--sc-primary)] text-white inline-flex items-center gap-1">
                        <CheckCircle2 size={12} /> Reactivate
                      </button>
                    ) : (
                      <button data-testid={`av-suspend-${v.id}`} disabled={acting === v.id} onClick={() => suspend(v)} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center gap-1">
                        <Ban size={12} /> Suspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No vendors.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
