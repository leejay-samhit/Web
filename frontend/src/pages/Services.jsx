import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import {
  Wrench, Search, MapPin, Phone, X, ShieldCheck, User,
  Star, Languages, Wallet, ChevronRight, Copy, Lock,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { log } from "@/lib/log";
import LocationBanner from "@/components/LocationBanner";
import { useUserLocation } from "@/hooks/useUserLocation";

/* -------------------------------------------------------------------------- */
/*  ServiceCard — list tile (Book CTA removed per 29-Jun-2026 directive)      */
/* -------------------------------------------------------------------------- */
function ServiceCard({ s, onProfile }) {
  const available = s.availability_status === "available";
  return (
    <button
      type="button"
      onClick={() => onProfile(s)}
      data-testid={`svc-card-${s.id}`}
      className="sc-card p-4 flex flex-col gap-2 text-left hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start gap-3 w-full">
        {s.profile_image ? (
          <img alt="" src={s.profile_image} className="w-12 h-12 rounded-full object-cover border border-[color:var(--sc-border)]" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary)] grid place-items-center"><User size={20} /></div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-extrabold text-[color:var(--sc-ink)] truncate">{s.service_name || s.name}</div>
              <div className="text-xs text-[color:var(--sc-ink-muted)] truncate">{s.service_category} · {s.name}</div>
            </div>
            <span
              className="sc-chip shrink-0"
              style={available ? { background: "#E7F6EC", color: "#0F6E4F" } : { background: "#FBEDE2", color: "#A0522D" }}
            >
              ● {available ? "Available" : "Busy"}
            </span>
          </div>
        </div>
      </div>
      {s.service_description && (
        <div className="text-xs text-[color:var(--sc-ink-muted)] line-clamp-2">{s.service_description}</div>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="text-sm font-extrabold text-[color:var(--sc-primary)]">{formatINR(s.service_charge)}</div>
        <span className="text-xs font-semibold text-[color:var(--sc-primary)] inline-flex items-center gap-1">
          View profile <ChevronRight size={12} />
        </span>
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Provider profile modal — phone reveal only (Book CTA removed)             */
/* -------------------------------------------------------------------------- */
function ProviderProfileModal({ provider, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revealConfig, setRevealConfig] = useState(null);
  const [revealing, setRevealing] = useState(false);
  const [revealedPhone, setRevealedPhone] = useState(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, cfg] = await Promise.allSettled([
          api.get(`/services/${provider.id}/profile`),
          api.get("/services/reveal-config"),
        ]);
        if (cancelled) return;
        if (p.status === "fulfilled") setProfile(p.value.data);
        else log.error("ProviderProfileModal: profile fetch failed", p.reason);
        if (cfg.status === "fulfilled") {
          setRevealConfig(cfg.value.data);
          if (cfg.value.data?.revealed_provider_ids?.includes(provider.id) && p.status === "fulfilled") {
            setRevealedPhone(p.value.data?.phone || null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [provider.id]);

  const pay = async () => {
    if (!acceptTerms) {
      setError("Please accept the terms to continue.");
      return;
    }
    setRevealing(true);
    setError("");
    try {
      const { data } = await api.post(`/services/${provider.id}/reveal-phone`, { accept_terms: true });
      const phone = data?.phone || data?.provider_phone || profile?.phone;
      setRevealedPhone(phone);
      try {
        const { data: cfg } = await api.get("/services/reveal-config");
        setRevealConfig(cfg);
      } catch (_e) { /* non-fatal */ }
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not reveal contact. Please top-up wallet and retry.");
    } finally {
      setRevealing(false);
    }
  };

  const copyPhone = async () => {
    if (!revealedPhone) return;
    try { await navigator.clipboard.writeText(revealedPhone); } catch { /* ignored */ }
  };

  const available = (profile?.availability_status || provider.availability_status) === "available";
  const langs = profile?.service_languages || provider.service_languages || [];
  const rating = profile?.rating_avg ?? profile?.rating;
  const reviewCount = profile?.rating_count ?? profile?.reviews_count;
  const insufficient = revealConfig && revealConfig.wallet_balance < revealConfig.total;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" data-testid="svc-profile-modal">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto sc-fade-in">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-3 border-b border-[color:var(--sc-border)] z-10">
          <div className="font-extrabold">Provider profile</div>
          <button onClick={onClose} data-testid="svc-profile-close" className="text-[color:var(--sc-ink-muted)]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {loading ? <Spinner /> : (
            <>
              <div className="flex items-start gap-3">
                {profile?.profile_image ? (
                  <img alt="" src={profile.profile_image} className="w-20 h-20 rounded-xl object-cover border border-[color:var(--sc-border)]" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary)] grid place-items-center"><User size={28} /></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-lg text-[color:var(--sc-ink)] truncate">{profile?.service_name || provider.service_name}</div>
                  <div className="text-sm text-[color:var(--sc-ink-muted)]">{profile?.name || provider.name}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="sc-chip" style={available ? { background: "#E7F6EC", color: "#0F6E4F" } : { background: "#FBEDE2", color: "#A0522D" }}>● {available ? "Available" : "Busy"}</span>
                    <span className="sc-chip" style={{ background: "#F1F5F9", color: "#334155" }}>{profile?.service_category || provider.service_category}</span>
                    {profile?.kyc_status === "verified" && (
                      <span className="sc-chip" style={{ background: "#ECFDF5", color: "#047857" }}><ShieldCheck size={12} className="inline mr-1" />KYC verified</span>
                    )}
                  </div>
                  {rating !== undefined && rating !== null && (
                    <div className="flex items-center gap-1 mt-1 text-xs">
                      <Star size={12} className="text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold">{Number(rating).toFixed(1)}</span>
                      <span className="text-[color:var(--sc-ink-muted)]">({reviewCount ?? 0} reviews)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="sc-card p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[color:var(--sc-ink-muted)]">Service charge</div>
                  <div className="text-2xl font-extrabold text-[color:var(--sc-primary)]">{formatINR(profile?.service_charge ?? provider.service_charge)}</div>
                </div>
              </div>

              {(profile?.service_description || provider.service_description) && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[color:var(--sc-ink-muted)] mb-1">About</div>
                  <div className="text-sm text-[color:var(--sc-ink)]">{profile?.service_description || provider.service_description}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                {(profile?.service_pincode || provider.service_pincode) && (
                  <div className="flex items-center gap-1.5 text-[color:var(--sc-ink-muted)]"><MapPin size={12} />PIN {profile?.service_pincode || provider.service_pincode}</div>
                )}
                {langs.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[color:var(--sc-ink-muted)]"><Languages size={12} />{langs.join(", ")}</div>
                )}
              </div>

              {/* Phone reveal */}
              <div className="sc-card p-4 bg-[color:var(--sc-accent-light)]/40">
                <div className="flex items-center gap-2 mb-2">
                  <Phone size={14} className="text-[color:var(--sc-primary)]" />
                  <div className="font-extrabold text-sm">Contact number</div>
                </div>
                {revealedPhone ? (
                  <div className="flex items-center justify-between gap-2">
                    <a href={`tel:${revealedPhone}`} data-testid="svc-revealed-phone" className="text-xl font-extrabold text-[color:var(--sc-primary)]">{revealedPhone}</a>
                    <div className="flex gap-2">
                      <button onClick={copyPhone} className="sc-btn-outline text-xs py-1.5 px-2 inline-flex items-center gap-1" data-testid="svc-phone-copy"><Copy size={12} /> Copy</button>
                      <a href={`tel:${revealedPhone}`} className="sc-btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1"><Phone size={12} /> Call</a>
                    </div>
                  </div>
                ) : revealConfig ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-[color:var(--sc-ink-muted)]">
                      <Lock size={12} /> Pay a small fee to view the provider&apos;s contact number.
                    </div>
                    <div className="border border-[color:var(--sc-border)] rounded-xl p-3 bg-white">
                      <div className="flex justify-between text-xs"><span>Reveal fee</span><span className="font-semibold">{formatINR(revealConfig.fee)}</span></div>
                      <div className="flex justify-between text-xs"><span>GST ({revealConfig.gst_pct}%)</span><span className="font-semibold">{formatINR(revealConfig.gst_amount)}</span></div>
                      <div className="border-t border-[color:var(--sc-border)] mt-1 pt-1 flex justify-between text-sm font-extrabold"><span>Total</span><span data-testid="svc-reveal-total">{formatINR(revealConfig.total)}</span></div>
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-[color:var(--sc-ink-muted)]"><Wallet size={12} /> Wallet balance: <span className="font-semibold text-[color:var(--sc-ink)]" data-testid="svc-wallet-balance">{formatINR(revealConfig.wallet_balance)}</span></div>
                    </div>
                    {insufficient && (
                      <div className="text-xs font-semibold text-[color:var(--sc-error)] bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">
                        Wallet balance is insufficient. Add money to your wallet, then try again.
                      </div>
                    )}
                    <label className="flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        data-testid="svc-reveal-terms"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span className="text-[color:var(--sc-ink-muted)]">I agree that the reveal fee + GST will be debited from my wallet and that this transaction is non-refundable.</span>
                    </label>
                    {error && <div className="text-xs font-semibold text-[color:var(--sc-error)]">{error}</div>}
                    <button
                      data-testid="svc-reveal-pay"
                      onClick={pay}
                      disabled={revealing || !acceptTerms || insufficient}
                      className="sc-btn-primary w-full text-sm inline-flex items-center justify-center gap-1.5"
                    >
                      {revealing ? "Processing…" : `Pay ${formatINR(revealConfig.total)} & reveal contact`}
                      <ChevronRight size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-[color:var(--sc-ink-muted)]">Loading reveal options…</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Category & sub-category chip strips                                       */
/* -------------------------------------------------------------------------- */
function CategoryChips({ categories, active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto py-1 -mx-1 px-1" data-testid="svc-categories">
      <button
        type="button"
        onClick={() => onChange(null)}
        data-testid="svc-cat-all"
        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${active === null ? "bg-[color:var(--sc-primary)] text-white border-transparent" : "bg-white text-[color:var(--sc-ink)] border-[color:var(--sc-border)]"}`}
      >
        All categories
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          data-testid={`svc-cat-${c.slug || c.id}`}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5 transition ${active === c.id ? "text-white border-transparent" : "bg-white text-[color:var(--sc-ink)] border-[color:var(--sc-border)]"}`}
          style={active === c.id ? { background: c.color || "var(--sc-primary)" } : undefined}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

function SubCategoryChips({ subcategories, active, onChange, loading }) {
  if (!loading && subcategories.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto py-1 -mx-1 px-1" data-testid="svc-subcategories">
      <button
        type="button"
        onClick={() => onChange(null)}
        data-testid="svc-sub-all"
        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${active === null ? "bg-[color:var(--sc-ink)] text-white border-transparent" : "bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary)] border-transparent"}`}
      >
        All sub-categories
      </button>
      {loading ? (
        <div className="text-xs text-[color:var(--sc-ink-muted)] px-2 py-1.5">Loading sub-categories…</div>
      ) : subcategories.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          data-testid={`svc-sub-${s.slug || s.id}`}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${active === s.id ? "bg-[color:var(--sc-ink)] text-white border-transparent" : "bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary)] border-transparent"}`}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main page                                                                 */
/* -------------------------------------------------------------------------- */
function renderServices({ loading, services, onProfile }) {
  if (loading) return <Spinner />;
  if (services.length === 0) {
    return <EmptyState icon={Wrench} title="No services found" hint="Adjust your search, PIN code, or category." />;
  }
  return (
    <div data-testid="services-grid" className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
      {services.map((s) => <ServiceCard key={s.id} s={s} onProfile={onProfile} />)}
    </div>
  );
}

export default function Services() {
  const { location } = useUserLocation();
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [activeCat, setActiveCat] = useState(null);
  const [activeSub, setActiveSub] = useState(null);
  const [profileOf, setProfileOf] = useState(null);
  const [q, setQ] = useState("");
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);

  const qRef = useRef(q);
  const pinRef = useRef(pincode);
  const catRef = useRef(activeCat);
  const subRef = useRef(activeSub);
  qRef.current = q;
  pinRef.current = pincode;
  catRef.current = activeCat;
  subRef.current = activeSub;

  useEffect(() => {
    if (location?.pincode && !pincode) setPincode(String(location.pincode));
  }, [location?.pincode, pincode]);

  // Categories load once
  useEffect(() => {
    api.get("/services/categories")
      .then((r) => setCategories(r.data?.categories || r.data?.items || r.data || []))
      .catch((e) => log.error("Services.categories failed", e));
  }, []);

  // Sub-categories: refetch whenever the active category changes
  useEffect(() => {
    if (!activeCat) {
      setSubcategories([]);
      setActiveSub(null);
      return;
    }
    setSubLoading(true);
    setActiveSub(null);
    api.get("/service-subcategories", { params: { parent_id: activeCat } })
      .then((r) => setSubcategories(r.data?.items || r.data || []))
      .catch((e) => log.error("Services.subcategories failed", e))
      .finally(() => setSubLoading(false));
  }, [activeCat]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (qRef.current) params.q = qRef.current;
      if (pinRef.current) params.pincode = pinRef.current;
      if (catRef.current) params.category_id = catRef.current;
      if (subRef.current) params.subcategory_id = subRef.current;
      if (location?.latitude && location?.longitude) {
        params.lat = location.latitude;
        params.lng = location.longitude;
      }
      const [s, inv] = await Promise.allSettled([
        api.get("/services", { params }),
        api.get("/services/reveals/me"),
      ]);
      if (s.status === "fulfilled") setServices(s.value.data?.items || []);
      else log.error("Services.load /services failed", s.reason);
      if (inv.status === "fulfilled") setInvoices(inv.value.data?.items || inv.value.data || []);
      else log.error("Services.load /reveals failed", inv.reason);
    } finally {
      setLoading(false);
    }
  }, [location?.latitude, location?.longitude]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { load(); }, [activeCat, activeSub, load]);

  return (
    <Layout title="Services">
      <div className="space-y-3">
        <LocationBanner />

        {categories.length > 0 && (
          <CategoryChips categories={categories} active={activeCat} onChange={setActiveCat} />
        )}

        {activeCat && (
          <SubCategoryChips subcategories={subcategories} active={activeSub} onChange={setActiveSub} loading={subLoading} />
        )}

        <div className="sc-card p-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={18} className="text-[color:var(--sc-ink-muted)] ml-1" />
            <input
              data-testid="svc-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search services…"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-[color:var(--sc-ink-muted)]" />
            <input
              data-testid="svc-pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="PIN"
              className="w-24 bg-transparent outline-none text-sm"
            />
          </div>
          <button data-testid="svc-search-btn" onClick={load} className="sc-btn-primary text-sm py-2">
            Search
          </button>
        </div>

        {renderServices({ loading, services, onProfile: setProfileOf })}

        {invoices?.length > 0 && (
          <div className="sc-card p-5" data-testid="svc-invoices">
            <div className="font-extrabold text-[color:var(--sc-ink)] mb-3">My invoices / reveals</div>
            <div className="divide-y divide-[color:var(--sc-border)]">
              {invoices.slice(0, 8).map((inv, idx) => (
                <div key={inv.id || idx} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold">{inv.provider_name || inv.service_name || "Reveal"}</div>
                    <div className="text-xs text-[color:var(--sc-ink-muted)]">{inv.status || inv.payment_status || "—"}</div>
                  </div>
                  <div className="font-extrabold">{formatINR(inv.amount || inv.charge)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {profileOf && (
        <ProviderProfileModal
          provider={profileOf}
          onClose={() => setProfileOf(null)}
        />
      )}
    </Layout>
  );
}
