"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  User,
  getAccessToken,
  getUser,
  fetchCurrentUser,
  login as apiLogin,
  signup as apiSignup,
  logoutUser as apiLogout,
} from "./auth";

type AuthContextValue = {
  user: User | null;
  loading: boolean; // true while the initial session check is in flight
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount: if there's a cached user + token, show it immediately
    // (avoids a flash of "logged out"), then verify against the backend
    // in the background and correct if the token turned out to be invalid.
    const cached = getUser();
    const token = getAccessToken();
    if (cached && token) {
      setUser(cached);
    }

    fetchCurrentUser()
      .then((fresh) => setUser(fresh))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    return u;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const u = await apiSignup(name, email, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const fresh = await fetchCurrentUser();
    setUser(fresh);
    return fresh;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, isAuthenticated: !!user, login, signup, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
