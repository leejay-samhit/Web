// Browser geolocation hook — captures position via navigator.geolocation and
// POSTs to /api/users/me/location. Mirrors the mobile-app location capture flow.
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { log } from "@/lib/log";

const KEY = "slangcart_loc_v1";

export function useUserLocation() {
  const [loc, setLoc] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
  });
  const [status, setStatus] = useState("idle"); // idle | requesting | ok | denied | error
  const [err, setErr] = useState("");

  useEffect(() => {
    if (loc) localStorage.setItem(KEY, JSON.stringify(loc));
  }, [loc]);

  const capture = useCallback(async () => {
    if (!navigator.geolocation) { setStatus("error"); setErr("Geolocation not supported by browser."); return null; }
    setStatus("requesting"); setErr("");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const payload = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy,
          };
          try {
            const { data } = await api.post("/users/me/location", payload);
            const next = { ...payload, ...(data || {}), captured_at: Date.now() };
            setLoc(next);
            setStatus("ok");
            resolve(next);
          } catch (e) {
            // Backend write may fail (auth missing etc.) — still keep client copy.
            log.error("location persist failed", e);
            const next = { ...payload, captured_at: Date.now() };
            setLoc(next);
            setStatus("ok");
            resolve(next);
          }
        },
        (geoErr) => {
          setStatus(geoErr.code === 1 ? "denied" : "error");
          setErr(geoErr.message || "Location capture failed");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(KEY);
    setLoc(null);
    setStatus("idle");
  }, []);

  return { location: loc, status, error: err, capture, clear };
}
