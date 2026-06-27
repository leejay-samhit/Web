import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sc_token");
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
    if (error?.response?.status === 401 && !original._retry) {
      const refresh = localStorage.getItem("sc_refresh");

      // Try refresh-once when we have a refresh token
      if (refresh) {
        try {
          original._retry = true;
          if (!refreshing) {
            refreshing = axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refresh });
          }
          const { data } = await refreshing;
          refreshing = null;
          localStorage.setItem("sc_token", data.token);
          if (data.refresh_token) localStorage.setItem("sc_refresh", data.refresh_token);
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${data.token}`;
          return api(original);
        } catch (e) {
          refreshing = null;
          // fall through to soft-logout
        }
      }

      // Soft logout: clear storage and dispatch an event the AuthProvider listens to.
      // We do NOT force window.location for /admin/* or /auth/me write endpoints; let
      // the calling component surface the error and React Router redirect via ProtectedRoute.
      const url = original?.url || "";
      const isAdminWrite = url.includes("/admin/") || original?.method !== "get";
      localStorage.removeItem("sc_token");
      localStorage.removeItem("sc_refresh");
      localStorage.removeItem("sc_user");
      window.dispatchEvent(new CustomEvent("sc:unauthorized", { detail: { url } }));
      if (!isAdminWrite && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
