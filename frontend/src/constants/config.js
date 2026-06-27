// Centralised configuration constants.
// Keep this file small and pure — no imports from app code, no environment lookups
// beyond `process.env.REACT_APP_*` so it can be safely tree-shaken.

// Networking
export const API_TIMEOUT_MS = 30000;
export const HTTP_UNAUTHORIZED = 401;
export const HTTP_FORBIDDEN = 403;

// Chat
export const CHAT_POLL_INTERVAL_MS = 8000;
export const CHAT_MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB

// Profile / uploads
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// Notifications
export const NOTIF_POLL_INTERVAL_MS = 30000;

// Auth storage keys (mirrored in src/lib/tokenStore.js)
export const TOKEN_STORAGE_KEY = "sc_token";
export const REFRESH_STORAGE_KEY = "sc_refresh";
export const USER_STORAGE_KEY = "sc_user";

// Razorpay
export const RZP_THEME_COLOR = "#0F6E4F";
