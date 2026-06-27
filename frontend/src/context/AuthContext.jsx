import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("sc_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("sc_token"));
  const [loading, setLoading] = useState(!!localStorage.getItem("sc_token"));

  const persist = (tk, u, refresh) => {
    if (tk) localStorage.setItem("sc_token", tk);
    if (refresh) localStorage.setItem("sc_refresh", refresh);
    if (u) localStorage.setItem("sc_user", JSON.stringify(u));
    setToken(tk || null);
    setUser(u || null);
  };

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    persist(data.token, data.user, data.refresh_token);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    if (data?.token) persist(data.token, data.user, data.refresh_token);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (_) {}
    localStorage.removeItem("sc_token");
    localStorage.removeItem("sc_refresh");
    localStorage.removeItem("sc_user");
    setToken(null);
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      const u = data?.user || data;
      if (u) {
        localStorage.setItem("sc_user", JSON.stringify(u));
        setUser(u);
      }
      return u;
    } catch (e) {
      return null;
    }
  }, []);

  useEffect(() => {
    if (token) {
      refreshMe().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshMe, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
