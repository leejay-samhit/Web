import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import VendorNav from "@/components/vendor/VendorNav";
import ErpNav from "@/components/erp/ErpNav";
import BackendPendingBanner from "@/components/erp/BackendPendingBanner";
import OwnerLockGate from "@/components/erp/OwnerLockGate";
import { listRoles, listStaff, saveRole } from "@/lib/erp";
import { UserCog, Plus, Save } from "lucide-react";
import { toast } from "sonner";

const PERM_CATALOG = [
  { group: "Products",   perms: ["product.create", "product.read", "product.update", "product.delete", "product.priceEdit"] },
  { group: "Purchase",   perms: ["purchase.create", "purchase.read", "purchase.book.view", "purchase.cost.view"] },
  { group: "Inventory",  perms: ["inventory.read", "inventory.adjust"] },
  { group: "Billing",    perms: ["billing.create", "billing.void", "billing.discount"] },
  { group: "Customer",   perms: ["customer.read", "customer.write"] },
  { group: "Supplier",   perms: ["supplier.read", "supplier.write"] },
  { group: "GST",        perms: ["gst.read", "gst.file", "gst.edit"] },
  { group: "Reports",    perms: ["report.read", "report.export"] },
  { group: "Accounts",   perms: ["accounts.view", "profit.view"] },
  { group: "Admin",      perms: ["audit.view", "role.manage", "settings.read", "settings.write"] },
];

const SYSTEM_TEMPLATES = [
  { code: "OWNER",   name: "Owner",   isSystem: true, permissions: ["*"] },
  { code: "MANAGER", name: "Manager", isSystem: true, permissions: PERM_CATALOG.flatMap((g) => g.perms).filter((p) => !["role.manage", "settings.write"].includes(p)) },
  { code: "CASHIER", name: "Cashier", isSystem: true, permissions: ["billing.create", "product.read", "customer.read", "customer.write"] },
  { code: "STAFF",   name: "Staff",   isSystem: true, permissions: ["product.read"] },
];

export default function ErpRoles() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6" data-testid="erp-roles">
        <VendorNav />
        <ErpNav />
        <OwnerLockGate title="Roles & Staff — Owner verification required">
          {(pwd) => <Inner ownerPassword={pwd} />}
        </OwnerLockGate>
      </div>
    </Layout>
  );
}

function Inner({ ownerPassword }) {
  const [roles, setRoles] = useState([]);
  const [staff, setStaff] = useState([]);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [r, s] = await Promise.all([listRoles(ownerPassword), listStaff(ownerPassword)]);
        if (!r || r.length === 0) {
          setPending(true);
          setRoles(SYSTEM_TEMPLATES);
        } else setRoles(r);
        setStaff(s || []);
      } catch { setPending(true); setRoles(SYSTEM_TEMPLATES); }
      setLoading(false);
    })();
  }, [ownerPassword]);

  const startCustom = () => setEditing({ code: "CUSTOM", name: "New role", isSystem: false, permissions: [] });

  const toggle = (perm) => {
    setEditing((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const submit = async () => {
    try {
      await saveRole(editing, ownerPassword);
      toast.success(`Saved role "${editing.name}"`);
      setEditing(null);
    } catch {
      toast.info("Saved locally (backend endpoint pending).");
      setRoles([...roles.filter((r) => r.code !== editing.code), editing]);
      setEditing(null);
    }
  };

  return (
    <>
      {pending && <BackendPendingBanner endpoint="/api/erp/roles" note="Showing system role templates." />}

      <div className="flex items-center justify-between mb-3">
        <div className="font-extrabold inline-flex items-center gap-1.5"><UserCog size={16} /> Roles</div>
        <button onClick={startCustom} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 bg-[color:var(--sc-primary)] text-white text-xs font-semibold" data-testid="role-add-btn">
          <Plus size={12} /> New role
        </button>
      </div>

      {loading ? (
        <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {roles.map((r) => (
            <div key={r.code} className="sc-card p-4">
              <div className="flex items-center justify-between">
                <div className="font-extrabold">{r.name}</div>
                {r.isSystem && <span className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">system</span>}
              </div>
              <div className="text-[11px] text-[color:var(--sc-ink-muted)] mt-0.5">{r.code}</div>
              <div className="mt-2 text-xs">
                {r.permissions?.includes("*")
                  ? "Full access to every module"
                  : `${r.permissions?.length || 0} permissions`}
              </div>
              <button
                onClick={() => setEditing(r)}
                className="mt-3 text-xs font-semibold text-[color:var(--sc-primary)]"
                data-testid={`role-edit-${r.code}`}
              >
                {r.isSystem ? "View" : "Edit"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Staff */}
      <div className="font-extrabold inline-flex items-center gap-1.5 mb-2"><UserCog size={16} /> Staff</div>
      {staff.length === 0 ? (
        <div className="sc-card p-6 text-center text-sm text-[color:var(--sc-ink-muted)]" data-testid="staff-empty">No staff added yet.</div>
      ) : (
        <div className="sc-card">
          {staff.map((s) => (
            <div key={s._id} className="p-3 border-b border-[color:var(--sc-border)] flex items-center justify-between text-sm">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-[11px] text-[color:var(--sc-ink-muted)]">{s.mobile} · {s.roleCode}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-40 grid place-items-center p-4 overflow-y-auto">
          <div className="sc-card w-full max-w-2xl p-5 my-6" data-testid="role-editor">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-extrabold">Edit role</div>
              <button onClick={() => setEditing(null)} className="text-sm text-[color:var(--sc-ink-muted)]">Close</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <label className="block">
                <span className="text-xs font-semibold">Code</span>
                <input type="text" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} disabled={editing.isSystem} className="w-full rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm disabled:bg-slate-50" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold">Name</span>
                <input type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} disabled={editing.isSystem} className="w-full rounded-lg border border-[color:var(--sc-border)] px-2.5 py-1.5 text-sm disabled:bg-slate-50" />
              </label>
            </div>

            {editing.permissions?.includes("*") ? (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">This role has full access.</div>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {PERM_CATALOG.map((g) => (
                  <div key={g.group}>
                    <div className="text-[11px] uppercase font-semibold text-[color:var(--sc-ink-muted)] mb-1">{g.group}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {g.perms.map((p) => (
                        <label key={p} className="inline-flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editing.permissions.includes(p)}
                            disabled={editing.isSystem}
                            onChange={() => toggle(p)}
                          />
                          {p}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setEditing(null)} className="rounded-full px-4 py-2 text-sm border border-[color:var(--sc-border)]">Cancel</button>
              {!editing.isSystem && (
                <button onClick={submit} className="rounded-full px-4 py-2 text-sm bg-[color:var(--sc-primary)] text-white font-semibold inline-flex items-center gap-1.5" data-testid="role-save">
                  <Save size={14} /> Save role
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
