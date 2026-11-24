import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Parent, SignupInput, LoginInput } from "@hearth/shared";
import { api, getToken, setToken } from "./api";
import { Spinner } from "./components/Spinner";

interface AuthState {
  parent: Parent | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [parent, setParent] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, if we have a stored token, resolve the current parent.
  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.auth
      .me()
      .then((p) => {
        if (!cancelled) setParent(p);
      })
      .catch(() => {
        // Token invalid/expired — clear it.
        setToken(null);
        if (!cancelled) setParent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      parent,
      loading,
      async login(input) {
        const res = await api.auth.login(input);
        setToken(res.token);
        setParent(res.parent);
      },
      async signup(input) {
        const res = await api.auth.signup(input);
        setToken(res.token);
        setParent(res.parent);
      },
      logout() {
        setToken(null);
        setParent(null);
      },
    }),
    [parent, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/** Route guard — redirects to /login (preserving intended destination) when signed out. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { parent, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="centered-page">
        <Spinner label="Loading your account…" />
      </div>
    );
  }
  if (!parent) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
