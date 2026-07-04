// Thin client for the Product Master backend contract documented in
// /app/memory/PRODUCT_MASTER_BACKEND_SPEC.md. Every function fails softly
// (returns [] / null) when the backend endpoints don't exist yet — so the
// vendor form falls back to manual entry without any user-visible error.

import api from "@/lib/api";
import { log } from "@/lib/log";

const MIN_CHARS = 2;
const CACHE = new Map(); // query → { at: number, hits: array }
const CACHE_TTL_MS = 60_000;

/**
 * Debounced autocomplete search. Returns [] silently when the backend hasn't
 * shipped `/api/products/master/search` yet.
 */
export async function searchMaster(q, { limit = 10, category } = {}) {
  const key = `${q}|${limit}|${category || ""}`;
  const now = Date.now();
  const cached = CACHE.get(key);
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.hits;
  const query = (q || "").trim();
  if (query.length < MIN_CHARS) return [];
  try {
    const { data } = await api.get("/products/master/search", {
      params: { q: query, limit, ...(category ? { category } : {}) },
    });
    const hits = Array.isArray(data) ? data : data?.items || [];
    CACHE.set(key, { at: now, hits });
    return hits;
  } catch (e) {
    // 404 → endpoint not yet implemented. Any other error is silent too so
    // the vendor never gets blocked; they can always type manually.
    if (e?.response?.status !== 404) log.error("searchMaster failed", e);
    return [];
  }
}

/** Load full master record by id. Returns null when unavailable. */
export async function getMaster(id) {
  try {
    const { data } = await api.get(`/products/master/${id}`);
    return data || null;
  } catch (e) {
    if (e?.response?.status !== 404) log.error("getMaster failed", e);
    return null;
  }
}

/** Fire-and-forget: tells the backend a user *selected* this suggestion so
 *  it can prioritise cache/warming. Non-blocking, ignores all errors. */
export function reportMasterHit(id) {
  if (!id) return;
  api.post(`/products/master/${id}/hit`).catch(() => { /* ignore */ });
}

/** Barcode / UPC / EAN / QR lookup. Returns master doc or null. */
export async function scanCode(code, kind = "barcode") {
  if (!code) return null;
  try {
    const { data } = await api.post("/products/master/scan", { code, kind });
    return data || null;
  } catch (e) {
    if (e?.response?.status !== 404) log.error("scanCode failed", e);
    return null;
  }
}

/** Luhn checksum for 15-digit IMEI. Local UX-level validation only —
 *  the backend must still enforce uniqueness.
 *  Empty / null / whitespace returns `true` (IMEI is an optional field). */
export function isValidImei(str) {
  const s = String(str || "").replace(/\D/g, "");
  if (s.length === 0) return true;
  if (s.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    let d = Number(s[i]);
    if ((s.length - 1 - i) % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
