import { useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { initials, formatINR } from "@/lib/utils";
import { Search, ShieldOff, ShieldCheck, KeyRound } from "lucide-react";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users", { params: { q, limit: 50 } });
      setUsers(data?.items || data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  const toggleBlock = async (u) => {
    setActing(u.id);
    try {
      const url = u.is_blocked ? `/admin/users/${u.id}/unblock` : `/admin/users/${u.id}/block`;
      await api.post(url, { reason: "via admin panel" });
      await load();
    } catch (e) {
      alert(e?.response?.data?.detail || "Action failed");
    } finally {
      setActing(null);
    }
  };

  const resetPwd = async (u) => {
    if (!window.confirm(`Reset password for ${u.name}?`)) return;
    setActing(u.id);
    try {
      const { data } = await api.post(`/admin/users/${u.id}/reset-password`);
      alert(`Temp password: ${data?.temp_password || "sent"}`);
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <Layout title="Admin · Users">
      <div className="sc-card p-3 flex items-center gap-2 mb-4">
        <Search size={16} className="text-[color:var(--sc-ink-muted)] ml-1" />
        <input
          data-testid="admin-users-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search by name, email, code"
          className="flex-1 bg-transparent outline-none text-sm"
        />
        <button onClick={load} className="sc-btn-primary text-sm py-1.5">Search</button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="sc-card overflow-x-auto" data-testid="admin-users-table">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr>
                <th className="text-left px-4 py-2.5">User</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-2.5 hidden lg:table-cell">Code</th>
                <th className="text-left px-4 py-2.5">Wallet</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-[color:var(--sc-border)]" data-testid={`au-${u.id}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full sc-avatar text-white text-[11px] font-bold grid place-items-center">
                        {initials(u.name)}
                      </div>
                      <div>
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{u.role}{u.admin_role ? ` · ${u.admin_role}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">{u.email}</td>
                  <td className="px-4 py-2.5 hidden lg:table-cell"><span className="sc-chip">{u.referral_code || "—"}</span></td>
                  <td className="px-4 py-2.5">{formatINR(u.wallet_balance)}</td>
                  <td className="px-4 py-2.5">
                    {u.is_blocked ? <span className="sc-chip" style={{ background: "#FBEAEA", color: "#9c2b2b" }}>Blocked</span>
                      : <span className="sc-chip">{u.approval_status || "active"}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-1 whitespace-nowrap">
                    <button
                      data-testid={`au-block-${u.id}`}
                      onClick={() => toggleBlock(u)}
                      disabled={acting === u.id}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] hover:bg-[color:var(--sc-accent-light)]"
                    >
                      {u.is_blocked ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                      {u.is_blocked ? "Unblock" : "Block"}
                    </button>
                    <button
                      data-testid={`au-pwd-${u.id}`}
                      onClick={() => resetPwd(u)}
                      disabled={acting === u.id}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] hover:bg-[color:var(--sc-accent-light)]"
                    >
                      <KeyRound size={14} /> Reset
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
