import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/react";
import { fetchSession, type SessionView } from "../lib/api";

interface SessionState {
  session: SessionView | null;
  loading: boolean;
  error: string | null;
  /** True if the user may perform an action, e.g. can("forms:write"). Operators can do anything. */
  can: (action: string) => boolean;
  tenant: string | null;
  tenants: string[];
  operator: boolean;
  /** Owner/admin of (a) tenant — may use the Auth page (scoped to their org). */
  tenantAdmin: boolean;
  /** Switch the active org and re-derive permissions. */
  switchTenant: (tenant: string) => void;
  refresh: () => void;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

/**
 * Fetches GET /session after Clerk sign-in and exposes the permission view to
 * the app. The active tenant comes from here (the org switcher) and is sent on
 * each call; auth-engine validates it against membership.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [session, setSession] = useState<SessionView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (tenant?: string) => {
      setLoading(true);
      setError(null);
      try {
        const s = await fetchSession(getToken, tenant);
        setSession(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setSession(null);
      } finally {
        setLoading(false);
      }
    },
    [getToken]
  );

  // Load once Clerk is ready and the user is signed in; clear on sign-out.
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      load();
    } else if (isLoaded && !isSignedIn) {
      setSession(null);
    }
  }, [isLoaded, isSignedIn, load]);

  const can = useCallback(
    (action: string) => !!session && (session.operator || session.can.includes(action)),
    [session]
  );

  const value: SessionState = {
    session,
    loading,
    error,
    can,
    tenant: session?.tenant ?? null,
    tenants: session?.tenants ?? [],
    operator: session?.operator ?? false,
    tenantAdmin: session?.tenantAdmin ?? false,
    switchTenant: (tenant: string) => load(tenant),
    refresh: () => load(session?.tenant ?? undefined),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
