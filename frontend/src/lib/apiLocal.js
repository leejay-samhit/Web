// Axios client for the LOCAL Slangcart Emergent backend
// (REACT_APP_BACKEND_URL, currently the same domain that serves the app).
// This is separate from `@/lib/api` because most of the app talks to the
// production Slangcart backend on network-pay-1.emergent.host, while a
// small number of endpoints (cross-vendor substore transfers) run in this
// container.  The local backend delegates identity to network-pay-1 by
// forwarding the same JWT, so both clients share the caller's token.

import axios from "axios";
import { getToken } from "@/lib/tokenStore";
import { API_TIMEOUT_MS } from "@/constants/config";

const BASE = process.env.REACT_APP_BACKEND_URL;
export const LOCAL_API_BASE = `${BASE}/api`;

const apiLocal = axios.create({
  baseURL: LOCAL_API_BASE,
  timeout: API_TIMEOUT_MS,
});

apiLocal.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiLocal;
