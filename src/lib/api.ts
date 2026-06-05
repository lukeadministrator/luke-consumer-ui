// Thin client for luke-auth-engine. Attaches the Clerk token (fresh per call),
// the active tenant, and retries once on 401 with a force-refreshed token.

const AUTH_BASE = import.meta.env.VITE_AUTH_ENGINE_URL || "http://localhost:8083";
// Local testing only: when set, sends X-Dev-User instead of a Clerk Bearer
// (matches luke-auth-engine dev-mode). Leave empty in real environments.
const DEV_USER: string = import.meta.env.VITE_DEV_USER || "";

export type GetToken = (opts?: { skipCache?: boolean }) => Promise<string | null>;

/** The permission view returned by GET /session. */
export interface SessionView {
  userId: string;
  operator: boolean;
  tenant: string | null;
  tenants: string[];
  roles: Record<string, string>; // tenantUser/processUser/taskUser → none|read|read-write
  candidateGroups: string[];
  capabilities: Record<string, string>; // e.g. { FORMS: "read-write" }
  can: string[]; // flattened actions, e.g. ["forms:read","forms:write","task:read"]
}

interface AuthFetchOpts extends RequestInit {
  getToken: GetToken;
  tenant?: string;
}

/** fetch against the auth-engine with auth headers + a single 401 retry. */
export async function authFetch(path: string, opts: AuthFetchOpts): Promise<Response> {
  const { getToken, tenant, ...init } = opts;

  const run = async (skipCache: boolean): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (DEV_USER) {
      headers.set("X-Dev-User", DEV_USER);
    } else {
      const token = await getToken({ skipCache });
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    if (tenant) headers.set("X-Tenant-Id", tenant);
    return fetch(`${AUTH_BASE}${path}`, { ...init, headers });
  };

  const res = await run(false);
  // A 401 usually means the short-lived Clerk token expired — refresh once.
  if (res.status === 401 && !DEV_USER) {
    return run(true);
  }
  return res;
}

/** Fetch the caller's session (identity + roles + capabilities + can[]). */
export async function fetchSession(getToken: GetToken, tenant?: string): Promise<SessionView> {
  const res = await authFetch("/session", { getToken, tenant });
  if (!res.ok) {
    throw new Error(`/session failed (${res.status})`);
  }
  return (await res.json()) as SessionView;
}
