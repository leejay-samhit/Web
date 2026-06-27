import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import EmptyState from "@/components/EmptyState";
import { Wrench, Search, MapPin, Phone, X, CheckCircle2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { log } from "@/lib/log";

function ServiceCard({ s, onBook }) {
  const available = s.availability_status === "available";
  return (
    <div key={s.id} className="sc-card p-4 flex flex-col gap-2" data-testid={`service-${s.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-extrabold text-[color:var(--sc-ink)] truncate">{s.service_name || s.name}</div>
          <div className="text-xs text-[color:var(--sc-ink-muted)]">{s.service_category}</div>
        </div>
        <span
          className="sc-chip"
          style={available ? { background: "#E7F6EC", color: "#0F6E4F" } : { background: "#FBEDE2", color: "#A0522D" }}
        >
          ● {available ? "Available" : "Busy"}
        </span>
      </div>
      {s.service_description && (
        <div className="text-xs text-[color:var(--sc-ink-muted)] line-clamp-2">{s.service_description}</div>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="text-sm font-extrabold text-[color:var(--sc-primary)]">{formatINR(s.service_charge)}</div>
        <button
          data-testid={`svc-book-${s.id}`}
          onClick={() => onBook(s)}
          className="sc-btn-primary text-xs py-1.5 px-3"
        >
          Book
        </button>
      </div>
    </div>
  );
}

function renderServices({ loading, services, onBook }) {
  if (loading) return <Spinner />;
  if (services.length === 0) {
    return <EmptyState icon={Wrench} title="No services found" hint="Adjust your search or PIN code." />;
  }
  return (
    <div data-testid="services-grid" className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
      {services.map((s) => <ServiceCard key={s.id} s={s} onBook={onBook} />)}
    </div>
  );
}

export default function Services() {
  const [services, setServices] = useState([]);
  const [q, setQ] = useState("");
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(true);
  const [bookOpen, setBookOpen] = useState(null); // service provider obj
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookSuccess, setBookSuccess] = useState(false);
  const [bookError, setBookError] = useState("");
  const [invoices, setInvoices] = useState([]);

  const qRef = useRef(q);
  const pinRef = useRef(pincode);
  qRef.current = q;
  pinRef.current = pincode;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (qRef.current) params.q = qRef.current;
      if (pinRef.current) params.pincode = pinRef.current;
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const book = async () => {
    if (!bookOpen) return;
    setBooking(true);
    setBookError("");
    try {
      await api.post(`/services/${bookOpen.id}/book`, { notes });
      setBookSuccess(true);
      setTimeout(() => {
        setBookOpen(null);
        setBookSuccess(false);
        setNotes("");
      }, 1200);
    } catch (e) {
      setBookError(e?.response?.data?.detail || "Could not book this service.");
    } finally {
      setBooking(false);
    }
  };

  return (
    <Layout title="Services">
      <div className="space-y-5">
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

        {renderServices({ loading, services, onBook: setBookOpen })}

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

      {/* Booking modal */}
      {bookOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 sc-fade-in" data-testid="book-modal">
            <div className="flex justify-between items-center mb-2">
              <div className="font-extrabold">Book {bookOpen.service_name || bookOpen.name}</div>
              <button onClick={() => setBookOpen(null)} className="text-[color:var(--sc-ink-muted)]"><X size={18} /></button>
            </div>
            {bookSuccess ? (
              <div className="py-6 text-center">
                <CheckCircle2 size={36} className="text-[color:var(--sc-success)] mx-auto" />
                <div className="font-extrabold mt-2">Booking sent!</div>
              </div>
            ) : (
              <>
                <textarea
                  data-testid="book-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tell the provider what you need…"
                  className="sc-input min-h-[100px] resize-none"
                />
                {bookError && <div className="text-sm font-semibold text-[color:var(--sc-error)] mt-2">{bookError}</div>}
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setBookOpen(null)} className="sc-btn-outline text-sm">Cancel</button>
                  <button data-testid="book-confirm" onClick={book} disabled={booking} className="sc-btn-primary text-sm">
                    {booking ? "Booking…" : "Confirm booking"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
