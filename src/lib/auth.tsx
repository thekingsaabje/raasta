import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "student" | "admin";
}

const Ctx = createContext<{ user: User | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> }>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setUser((await api.get<{ user: User | null }>("/auth/me")).user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return <Ctx.Provider value={{ user, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
