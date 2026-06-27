import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { initials } from "@/lib/utils";
import { Camera, Loader2, Save, KeyRound, Bell, MapPin, Banknote, IdCard, Wrench, Store, FileText, ArrowRight } from "lucide-react";
import { log } from "@/lib/log";
import { AVATAR_MAX_BYTES } from "@/constants/config";
import { Link } from "react-router-dom";

function Section({ title, icon: Icon, children, testid }) {
  return (
    <div className="sc-card p-5" data-testid={testid}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={18} className="text-[color:var(--sc-primary)]" />}
        <h2 className="font-extrabold text-[color:var(--sc-ink)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function Profile() {
  const { user, refreshMe, setUser } = useAuth();
  const fileRef = useRef(null);
  const [busyImg, setBusyImg] = useState(false);
  const [addr, setAddr] = useState({ address: "", city: "", state: "", pincode: "" });
  const [bank, setBank] = useState({ upi_id: "", bank_account: "", ifsc: "", account_holder: "" });
  const [pwd, setPwd] = useState({ current: "", next: "" });
  const [notif, setNotif] = useState([]);
  const [savingAddr, setSavingAddr] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (user) {
      setBank({
        upi_id: user.upi_id || "",
        bank_account: user.bank_account || "",
        ifsc: user.ifsc || "",
        account_holder: user.account_holder || "",
      });
      const a = user.address || user.shipping_address || {};
      setAddr({
        address: a.address || "",
        city: a.city || "",
        state: a.state || "",
        pincode: a.pincode || "",
      });
    }
  }, [user]);

  useEffect(() => {
    api
      .get("/notifications/me")
      .then((r) => setNotif(Array.isArray(r.data) ? r.data : r.data?.items || []))
      .catch((error) => log.error("Profile.loadNotifications failed", error));
  }, []);

  const onAvatar = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > AVATAR_MAX_BYTES) return alert("Image must be under 2MB");
    setBusyImg(true);
    const r = new FileReader();
    r.onload = async () => {
      const url = r.result?.toString();
      try {
        await api.post("/users/me/profile-image", { image_data_url: url });
        await refreshMe();
        const updated = JSON.parse(localStorage.getItem("sc_user") || "null");
        if (updated) setUser(updated);
      } catch (e) {
        alert(e?.response?.data?.detail || "Could not update image");
      } finally {
        setBusyImg(false);
      }
    };
    r.readAsDataURL(f);
  };

  const saveAddr = async () => {
    setSavingAddr(true);
    setMsg(null);
    try {
      await api.patch("/users/me/address", addr);
      await refreshMe();
      setMsg({ k: "addr", t: "Address saved" });
    } catch (e) {
      setMsg({ k: "addr", t: e?.response?.data?.detail || "Failed", err: true });
    } finally {
      setSavingAddr(false);
    }
  };

  const saveBank = async () => {
    setSavingBank(true);
    setMsg(null);
    try {
      await api.post("/users/me/bank", bank);
      await refreshMe();
      setMsg({ k: "bank", t: "Payout info saved" });
    } catch (e) {
      setMsg({ k: "bank", t: e?.response?.data?.detail || "Failed", err: true });
    } finally {
      setSavingBank(false);
    }
  };

  const savePwd = async () => {
    setSavingPwd(true);
    setMsg(null);
    try {
      // Try common endpoint names
      await api.post("/auth/change-password", { current_password: pwd.current, new_password: pwd.next }).catch(async (e) => {
        if (e?.response?.status === 404 || e?.response?.status === 405) {
          return api.post("/users/me/change-password", { current_password: pwd.current, new_password: pwd.next });
        }
        throw e;
      });
      setPwd({ current: "", next: "" });
      setMsg({ k: "pwd", t: "Password updated" });
    } catch (e) {
      setMsg({ k: "pwd", t: e?.response?.data?.detail || "Could not change password (endpoint not available)", err: true });
    } finally {
      setSavingPwd(false);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/me/read-all");
      const { data } = await api.get("/notifications/me");
      setNotif(Array.isArray(data) ? data : data?.items || []);
    } catch (error) {
      log.error("Profile.markAllRead failed", error);
    }
  };

  return (
    <Layout title="Profile">
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Sidebar profile card */}
        <Section title="Profile" testid="profile-card">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl sc-avatar text-white font-extrabold grid place-items-center overflow-hidden">
                {user?.profile_image ? (
                  <img alt="" src={user.profile_image} className="w-full h-full object-cover" />
                ) : (
                  <span>{initials(user?.name)}</span>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                data-testid="profile-avatar-btn"
                className="absolute -bottom-1 -right-1 bg-white border border-[color:var(--sc-border)] rounded-full w-7 h-7 grid place-items-center text-[color:var(--sc-primary)]"
              >
                {busyImg ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold truncate" data-testid="profile-name">{user?.name}</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)] truncate">{user?.email}</div>
              <div className="text-xs mt-1"><span className="sc-chip">Code · {user?.referral_code}</span></div>
            </div>
          </div>
          <div className="mt-4 text-xs text-[color:var(--sc-ink-muted)] space-y-1">
            <div>Phone: <span className="font-semibold text-[color:var(--sc-ink)]">{user?.phone || "—"}</span></div>
            <div>KYC: <span className="font-semibold text-[color:var(--sc-ink)]">{user?.kyc_status || "—"}</span></div>
            <div>Status: <span className="font-semibold text-[color:var(--sc-ink)]">{user?.approval_status || "—"}</span></div>
          </div>
        </Section>

        {/* Address */}
        <Section title="Address" icon={MapPin} testid="profile-address">
          <div className="space-y-2">
            <input className="sc-input" data-testid="pf-addr" placeholder="Street, building" value={addr.address} onChange={(e) => setAddr((a) => ({ ...a, address: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <input className="sc-input" data-testid="pf-city" placeholder="City" value={addr.city} onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))} />
              <input className="sc-input" data-testid="pf-state" placeholder="State" value={addr.state} onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value }))} />
            </div>
            <input className="sc-input" data-testid="pf-pin" placeholder="PIN code" value={addr.pincode} onChange={(e) => setAddr((a) => ({ ...a, pincode: e.target.value }))} />
            <button data-testid="pf-save-addr" onClick={saveAddr} disabled={savingAddr} className="sc-btn-primary inline-flex items-center gap-1.5 text-sm">
              {savingAddr && <Loader2 size={14} className="animate-spin" />} <Save size={14} /> Save
            </button>
            {msg?.k === "addr" && <div className={`text-xs font-semibold mt-1 ${msg.err ? "text-[color:var(--sc-error)]" : "text-[color:var(--sc-success)]"}`}>{msg.t}</div>}
          </div>
        </Section>

        {/* Bank / UPI */}
        <Section title="Payout info" icon={Banknote} testid="profile-bank">
          <div className="space-y-2">
            <input className="sc-input" data-testid="pf-upi" placeholder="UPI ID" value={bank.upi_id} onChange={(e) => setBank((b) => ({ ...b, upi_id: e.target.value }))} />
            <input className="sc-input" data-testid="pf-account" placeholder="Bank account" value={bank.bank_account} onChange={(e) => setBank((b) => ({ ...b, bank_account: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <input className="sc-input" data-testid="pf-ifsc" placeholder="IFSC" value={bank.ifsc} onChange={(e) => setBank((b) => ({ ...b, ifsc: e.target.value }))} />
              <input className="sc-input" data-testid="pf-holder" placeholder="Account holder" value={bank.account_holder} onChange={(e) => setBank((b) => ({ ...b, account_holder: e.target.value }))} />
            </div>
            <button data-testid="pf-save-bank" onClick={saveBank} disabled={savingBank} className="sc-btn-primary inline-flex items-center gap-1.5 text-sm">
              {savingBank && <Loader2 size={14} className="animate-spin" />} <Save size={14} /> Save
            </button>
            {msg?.k === "bank" && <div className={`text-xs font-semibold mt-1 ${msg.err ? "text-[color:var(--sc-error)]" : "text-[color:var(--sc-success)]"}`}>{msg.t}</div>}
          </div>
        </Section>

        {/* Change password */}
        <Section title="Change password" icon={KeyRound} testid="profile-pwd">
          <div className="space-y-2">
            <input className="sc-input" data-testid="pf-pwd-current" type="password" placeholder="Current password" value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} />
            <input className="sc-input" data-testid="pf-pwd-new" type="password" placeholder="New password" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} />
            <button data-testid="pf-save-pwd" onClick={savePwd} disabled={savingPwd || !pwd.current || !pwd.next} className="sc-btn-primary inline-flex items-center gap-1.5 text-sm">
              {savingPwd && <Loader2 size={14} className="animate-spin" />} Update
            </button>
            {msg?.k === "pwd" && <div className={`text-xs font-semibold mt-1 ${msg.err ? "text-[color:var(--sc-error)]" : "text-[color:var(--sc-success)]"}`}>{msg.t}</div>}
          </div>
        </Section>

        {/* Quick links to extended flows */}
        <Section title="More" testid="profile-more">
          <div className="grid gap-2">
            {[
              { to: "/kyc", label: "KYC verification", icon: IdCard, testid: "pf-go-kyc" },
              { to: "/become-provider", label: "Apply as service provider", icon: Wrench, testid: "pf-go-provider" },
              { to: "/become-vendor", label: "Sell on Slangcart (Vendor)", icon: Store, testid: "pf-go-vendor" },
              { to: "/support", label: "Support tickets", icon: Bell, testid: "pf-go-support" },
              { to: "/legal/terms", label: "Terms of Service", icon: FileText, testid: "pf-go-terms" },
              { to: "/legal/privacy", label: "Privacy Policy", icon: FileText, testid: "pf-go-privacy" },
            ].map((l) => (
              <Link key={l.to} to={l.to} data-testid={l.testid} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[color:var(--sc-accent-light)] border border-[color:var(--sc-border)]">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <l.icon size={16} className="text-[color:var(--sc-primary)]" /> {l.label}
                </span>
                <ArrowRight size={14} className="text-[color:var(--sc-ink-muted)]" />
              </Link>
            ))}
          </div>
        </Section>

        {/* Notifications */}
        <div className="lg:col-span-2">
          <Section title="Notifications" icon={Bell} testid="profile-notif">
            <div className="flex justify-end mb-2">
              <button data-testid="pf-readall" onClick={markAllRead} className="text-xs font-semibold text-[color:var(--sc-primary)]">
                Mark all read
              </button>
            </div>
            <div className="divide-y divide-[color:var(--sc-border)]" data-testid="notif-list">
              {notif.length === 0 ? (
                <div className="text-sm text-[color:var(--sc-ink-muted)] py-4 text-center">No notifications.</div>
              ) : (
                notif.slice(0, 12).map((n) => (
                  <div key={n.id} className="py-2.5 flex items-start gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full ${n.read ? "bg-[color:var(--sc-border)]" : "bg-[color:var(--sc-primary)]"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{n.title}</div>
                      <div className="text-xs text-[color:var(--sc-ink-muted)]">{n.body}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Section>
        </div>
      </div>
    </Layout>
  );
}
