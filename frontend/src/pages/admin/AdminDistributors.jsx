import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { Plus, Trash2, Loader2, MapPin } from "lucide-react";
import { initials } from "@/lib/utils";
import { log } from "@/lib/log";

export default function AdminDistributors() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [areas, setAreas] = useState([]);
  const [newPin, setNewPin] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/distributors");
      setList(data?.items || (Array.isArray(data) ? data : []));
    } catch (error) { log.error("AdminDistributors.load failed", error); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openUser = async (u) => {
    setSelected(u);
    try {
      const { data } = await api.get(`/admin/distributors/${u.id}/areas`);
      setAreas(data?.items || (Array.isArray(data) ? data : []));
    } catch (e) { setAreas([]); }
  };

  const addArea = async () => {
    if (!newPin || !selected) return;
    setAdding(true);
    try {
      await api.post(`/admin/distributors/${selected.id}/areas`, { pincode: newPin });
      setNewPin("");
      openUser(selected);
    } catch (e) { alert(e?.response?.data?.detail || "Failed"); }
    finally { setAdding(false); }
  };

  const removeArea = async (pin) => {
    if (!selected) return;
    try { await api.delete(`/admin/distributors/${selected.id}/areas/${pin}`); openUser(selected); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const bulkUnassign = async () => {
    if (!selected || !window.confirm("Unassign ALL areas?")) return;
    try { await api.post(`/admin/distributors/${selected.id}/areas/bulk-unassign`); openUser(selected); }
    catch (e) { alert(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <Layout title="Admin · Distributor areas">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="sc-card p-4">
          <div className="font-extrabold mb-3">Distributors</div>
          {loading ? <Spinner /> : (
            <div className="space-y-1 max-h-[70vh] overflow-y-auto" data-testid="ad-list">
              {list.map((u) => (
                <button key={u.id} data-testid={`ad-${u.id}`} onClick={() => openUser(u)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left ${selected?.id === u.id ? "bg-[color:var(--sc-accent-light)]" : "hover:bg-[color:var(--sc-accent-light)]/60"}`}>
                  <div className="w-8 h-8 rounded-full sc-avatar text-white text-[11px] font-bold grid place-items-center">{initials(u.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{u.name}</div>
                    <div className="text-[11px] text-[color:var(--sc-ink-muted)] truncate">{u.email}</div>
                  </div>
                  <span className="sc-chip text-[10px]">{u.pincode_count ?? u.area_count ?? "—"}</span>
                </button>
              ))}
              {list.length === 0 && <div className="text-sm text-[color:var(--sc-ink-muted)] py-4 text-center">No distributors.</div>}
            </div>
          )}
        </div>

        <div className="sc-card p-4 lg:col-span-2" data-testid="ad-detail">
          {!selected ? (
            <div className="text-sm text-[color:var(--sc-ink-muted)] py-10 text-center">Pick a distributor to manage their assigned pincodes.</div>
          ) : (
            <>
              <div className="font-extrabold mb-1">{selected.name}</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)] mb-3">{selected.email}</div>

              <div className="flex gap-2 mb-3">
                <input className="sc-input flex-1" data-testid="ad-pin" placeholder="Pincode" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
                <button data-testid="ad-add" disabled={adding || !newPin} onClick={addArea} className="sc-btn-primary inline-flex items-center gap-1.5">
                  {adding ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Add
                </button>
                <button data-testid="ad-bulk-unassign" onClick={bulkUnassign} className="sc-btn-outline text-[color:var(--sc-error)]">Unassign all</button>
              </div>

              <div className="flex flex-wrap gap-2" data-testid="ad-areas">
                {areas.map((a) => (
                  <div key={a.pincode || a} className="sc-chip inline-flex items-center gap-1" data-testid={`ad-area-${a.pincode || a}`}>
                    <MapPin size={11} /> {a.pincode || a}
                    <button onClick={() => removeArea(a.pincode || a)} className="ml-1 text-[color:var(--sc-error)]"><Trash2 size={11} /></button>
                  </div>
                ))}
                {areas.length === 0 && <div className="text-sm text-[color:var(--sc-ink-muted)]">No areas assigned.</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
