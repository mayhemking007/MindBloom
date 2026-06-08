import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "@mindbloom/shared";

import { getCurrentAuth, loginUser, logoutUser, registerUser } from "../lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  ownerKind: "authenticated" | "demo";
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ownerKind, setOwnerKind] = useState<"authenticated" | "demo">("demo");
  const [isLoading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const response = await getCurrentAuth();
    setUser(response.user);
    setOwnerKind(response.ownerKind);
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => {
        setUser(null);
        setOwnerKind("demo");
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ownerKind,
      isLoading,
      async login(email, password) {
        const response = await loginUser({ email, password });
        setUser(response.user);
        setOwnerKind("authenticated");
      },
      async register(email, password, displayName) {
        const response = await registerUser({ email, password, displayName });
        setUser(response.user);
        setOwnerKind("authenticated");
      },
      async logout() {
        await logoutUser();
        setUser(null);
        setOwnerKind("demo");
      },
      refresh,
    }),
    [isLoading, ownerKind, refresh, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
