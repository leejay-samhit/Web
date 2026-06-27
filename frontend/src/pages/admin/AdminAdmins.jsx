import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Plus, Loader2, ShieldOff } from "lucide-react";
import { initials, formatDateTime } from "@/lib/utils";
import { log } from "@/lib/log";

const ROLES = ["admin", "super_admin", "moderator", "support"];

export default function AdminAdmins() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", admin_role: "admin" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/admins");
      setList(data?.items || (Array.isArray(data) ? data : []));
    } catch (error) { log.error("AdminAdmins.load failed", error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.email || !form.password || !form.name) return;
    setSaving(true);
    try {
      await api.post("/admin/admins", form);
      setForm({ name: "", email: "", password: "", admin_role: "admin" });
      load();
    } catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const demote = async (u) => {
    if (!window.confirm(`Demote ${u.name} from admin?`)) return;
    try { await api.post(`/admin/users/${u.id}/demote`); load(); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <Layout title="Admin · Admin access">
      <div className="sc-card p-4 mb-4" data-testid="aa-add">
        <div className="font-extrabold mb-3">Add new admin</div>
        <div className="grid md:grid-cols-4 gap-2">
          <input className="sc-input" data-testid="aa-name" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="sc-input" data-testid="aa-email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="sc-input" type="password" data-testid="aa-pw" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="sc-input" data-testid="aa-role" value={form.admin_role} onChange={(e) => setForm({ ...form, admin_role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button data-testid="aa-add-btn" disabled={saving || !form.email} onClick={create} className="sc-btn-primary mt-3 inline-flex items-center gap-1.5">
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Create
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="sc-card overflow-x-auto" data-testid="aa-list">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]">
              <tr><th className="text-left px-4 py-2.5">Admin</th><th className="text-left px-4 py-2.5">Email</th><th className="text-left px-4 py-2.5">Role</th><th className="text-left px-4 py-2.5">Joined</th><th className="text-right px-4 py-2.5">Actions</th></tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-t border-[color:var(--sc-border)]" data-testid={`aa-row-${u.id}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full sc-avatar text-white text-[11px] font-bold grid place-items-center">{initials(u.name)}</div>
                      <div className="font-semibold">{u.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{u.email}</td>
                  <td className="px-4 py-2.5"><span className="sc-chip uppercase">{u.admin_role || "admin"}</span></td>
                  <td className="px-4 py-2.5 text-xs text-[color:var(--sc-ink-muted)]">{formatDateTime(u.created_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button data-testid={`aa-demote-${u.id}`} onClick={() => demote(u)} className="text-xs font-semibold px-2 py-1 rounded-lg border border-[color:var(--sc-border)] text-[color:var(--sc-error)] inline-flex items-center gap-1">
                      <ShieldOff size={12} /> Demote
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-[color:var(--sc-ink-muted)]">No admins.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
