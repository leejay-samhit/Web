// Slim banner shown on /shop and /services to capture user location for
// "deliver to" / "nearby provider" context — matches mobile app behavior.
import { useUserLocation } from "@/hooks/useUserLocation";
import { MapPin, Loader2, X } from "lucide-react";

export default function LocationBanner() {
  const { location, status, error, capture, clear } = useUserLocation();

  if (location) {
    return (
      <div className="sc-card p-2.5 mb-3 flex items-center gap-2 text-xs" data-testid="loc-banner">
        <MapPin size={14} className="text-[color:var(--sc-primary)]" />
        <span className="text-[color:var(--sc-ink-muted)]">Deliver to:</span>
        <span className="font-semibold truncate" data-testid="loc-text">
          {location.address || location.city || `${location.latitude?.toFixed(3)}, ${location.longitude?.toFixed(3)}`}
          {location.pincode ? ` · ${location.pincode}` : ""}
        </span>
        <button data-testid="loc-update" onClick={capture} className="ml-auto text-[color:var(--sc-primary)] font-bold">Update</button>
        <button data-testid="loc-clear" onClick={clear} className="text-[color:var(--sc-ink-muted)] p-0.5"><X size={12} /></button>
      </div>
    );
  }

  return (
    <div className="sc-card p-2.5 mb-3 flex items-center gap-2 text-xs" data-testid="loc-banner">
      <MapPin size={14} className="text-[color:var(--sc-primary)]" />
      <span className="text-[color:var(--sc-ink-muted)]">Share your location for nearby items & services.</span>
      <button
        data-testid="loc-capture"
        onClick={capture}
        disabled={status === "requesting"}
        className="ml-auto sc-btn-primary inline-flex items-center gap-1 text-xs px-3 py-1"
      >
        {status === "requesting" ? <Loader2 className="animate-spin" size={12} /> : <MapPin size={12} />} Use my location
      </button>
      {(status === "denied" || status === "error") && (
        <span data-testid="loc-err" className="text-[color:var(--sc-error)] ml-1">{error}</span>
      )}
    </div>
  );
}
