import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "admin" | "manager" | "worker";
  avatar_url: string | null;
};

type AuthState = {
  user: any | null;
  profile: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
  setProfile: (p: UserProfile) => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [loading, setLoading] = useState(true);

  // On mount, try to restore session
  useEffect(() => {
    if (token) {
      restoreSession(token);
    } else {
      setLoading(false);
    }
  }, []);

  async function restoreSession(savedToken: string) {
    try {
      const res = await fetch("/api/auth/profile", {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setProfile(data.profile);
        setToken(savedToken);
      } else {
        // Token expired or invalid
        localStorage.removeItem("auth_token");
        setToken(null);
        setUser(null);
        setProfile(null);
      }
    } catch {
      localStorage.removeItem("auth_token");
      setToken(null);
    }
    setLoading(false);
  }

  async function login(email: string, password: string): Promise<{ error?: string }> {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Login failed" };
      
      setUser(data.user);
      setProfile(data.profile);
      setToken(data.session.access_token);
      localStorage.setItem("auth_token", data.session.access_token);
      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  }

  async function signup(email: string, password: string, fullName: string): Promise<{ error?: string }> {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Signup failed" };
      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  }

  function logout() {
    setUser(null);
    setProfile(null);
    setToken(null);
    localStorage.removeItem("auth_token");
  }

  function hasRole(...roles: string[]) {
    return profile ? roles.includes(profile.role) : false;
  }

  return (
    <AuthContext.Provider value={{ user, profile, token, loading, login, signup, logout, hasRole, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
