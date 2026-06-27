import axios from "axios";
import { getToken, getRefresh, setTokens, clearTokens } from "@/lib/tokenStore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
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
    if (error?.response?.status === 401 && !original._retry) {
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
      clearTokens();
      window.dispatchEvent(new CustomEvent("sc:unauthorized", { detail: { url } }));
      if (!isAdminWrite && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
