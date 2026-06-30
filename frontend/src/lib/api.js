import axios from "axios";
import { getToken, getRefresh, setTokens, clearTokens } from "@/lib/tokenStore";
import { API_TIMEOUT_MS, HTTP_UNAUTHORIZED } from "@/constants/config";

// Backend URL is intentionally hardcoded here. The Emergent Deploy pipeline was
// failing to bake REACT_APP_BACKEND_URL into the slangcart.com production build
// reliably (env-var save was silently no-op'd), so we pin the URL in source.
// Backend lives in a separate Emergent job; mobile app talks to the same host.
const BACKEND_URL = "https://network-pay-1.emergent.host";
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: API_TIMEOUT_MS,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config || {};
    if (error?.response?.status === HTTP_UNAUTHORIZED && !original._retry) {
      const refresh = getRefresh();

      if (refresh) {
        try {
          original._retry = true;
          if (!refreshing) {
            refreshing = axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refresh });
          }
          const { data } = await refreshing;
          refreshing = null;
          setTokens({ token: data.token, refresh_token: data.refresh_token });
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${data.token}`;
          return api(original);
        } catch (_e) {
          refreshing = null;
          // fall through to soft-logout
        }
      }

      const url = original?.url || "";
      const isAdminWrite = url.includes("/admin/") || original?.method !== "get";

      // Detect the backend's specific single-session-revoked reason so /login
      // can explain to the user why they got kicked out. We use localStorage
      // (not sessionStorage) so the flag survives the window.location hard
      // reload below. Login.jsx clears it after the banner has been on screen.
      const detail = error?.response?.data?.detail;
      if (detail === "session_revoked") {
        try { localStorage.setItem("sc_logout_reason", "session_revoked"); } catch { /* ignored */ }
      }

      clearTokens();
      window.dispatchEvent(new CustomEvent("sc:unauthorized", { detail: { url, reason: detail } }));
      if (!isAdminWrite && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
