import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import api from "@/lib/api";
import {
  getCachedUser,
  getToken,
  setTokens as persistTokens,
  clearTokens,
} from "@/lib/tokenStore";
import { log } from "@/lib/log";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCachedUser());
  const [token, setToken] = useState(() => getToken());
  const [loading, setLoading] = useState(() => !!getToken());

  const persist = useCallback((tk, u, refresh) => {
    persistTokens({ token: tk, refresh_token: refresh, user: u });
    setToken(tk || null);
    setUser(u || null);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post("/auth/login", { email, password });
      persist(data.token, data.user, data.refresh_token);
      return data.user;
    },
    [persist]
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await api.post("/auth/register", payload);
      if (data?.token) persist(data.token, data.user, data.refresh_token);
      return data;
    },
    [persist]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      log.error("AuthProvider.logout: backend rejected logout", error);
    }
    clearTokens();
    setToken(null);
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      const u = data?.user || data;
      if (u) {
        persistTokens({ user: u });
        setUser(u);
      }
      return u;
    } catch (error) {
      log.error("AuthProvider.refreshMe: /auth/me failed", error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (token) {
      refreshMe().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    const onUnauth = () => {
      setToken(null);
      setUser(null);
    };
    // Cross-tab logout: if another tab clears storage, this one logs out too.
    const onStorage = (event) => {
      if (event.key === "sc_token" && !event.newValue) {
        setToken(null);
        setUser(null);
      }
    };
    window.addEventListener("sc:unauthorized", onUnauth);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("sc:unauthorized", onUnauth);
      window.removeEventListener("storage", onStorage);
    };
  }, [token, refreshMe]);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, refreshMe, setUser }),
    [user, token, loading, login, register, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
