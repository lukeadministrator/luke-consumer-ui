// Thin fetch client for the luke-auth-engine `/auth/*` API. The browser holds no
// auth SDK and no provider keys — it talks only to our gateway. The short-lived
// access token lives in memory here; the long-lived refresh token is an HttpOnly
// cookie set by the gateway (sent via credentials:"include").

const BASE = (import.meta.env.VITE_AUTH_API_URL || "").replace(/\/$/, "");

export type WorkosUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
  emailVerified: boolean;
};

export type SessionView = {
  userId: string;
  provisioned: boolean;
  operator: boolean;
  tenantAdmin: boolean;
  tenant: string | null;
  tenants: string[];
  roles: Record<string, string>;
  candidateGroups: string[];
  capabilities: Record<string, string>;
  can: string[];
};

export type AuthResult = {
  accessToken: string;
  sid: string | null;
  user: WorkosUser;
  session: SessionView;
};

export type SocialProvider = "google" | "microsoft";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let accessToken: string | null = null;
export function setAccessToken(t: string | null): void {
  accessToken = t;
}
export function getAccessToken(): string | null {
  return accessToken;
}

const url = (path: string) => `${BASE}${path}`;

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

export async function register(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ userId: string; user: WorkosUser; verifyRequired: boolean }> {
  const res = await fetch(url("/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  return parse(res);
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await fetch(url("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await parse<AuthResult>(res);
  accessToken = data.accessToken ?? null;
  return data;
}

/** Restore a session from the refresh cookie. Returns null when signed out. */
export async function refresh(): Promise<AuthResult | null> {
  const res = await fetch(url("/auth/refresh"), {
    method: "POST",
    credentials: "include",
  });
  if (res.status === 401) {
    accessToken = null;
    return null;
  }
  const data = await parse<AuthResult>(res);
  accessToken = data.accessToken ?? null;
  return data;
}

export async function logout(): Promise<void> {
  try {
    await fetch(url("/auth/logout"), {
      method: "POST",
      credentials: "include",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
  } finally {
    accessToken = null;
  }
}

export function socialUrl(provider: SocialProvider): string {
  return url(`/auth/social?provider=${encodeURIComponent(provider)}`);
}

// ── Authed calls (Bearer access token, with one refresh-on-401 retry) ──────

async function authed<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const res = await fetch(url(path), { ...init, headers, credentials: "include" });
  if (res.status === 401 && retry) {
    const r = await refresh();
    if (r) return authed<T>(path, init, false);
  }
  return parse<T>(res);
}

export function getSession(tenantId?: string): Promise<SessionView> {
  return authed("/session", {
    headers: tenantId ? { "X-Tenant-Id": tenantId } : undefined,
  });
}

export function updateProfile(input: {
  firstName?: string;
  lastName?: string;
}): Promise<{ user: WorkosUser }> {
  return authed("/auth/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await authed("/auth/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function deleteAccount(): Promise<void> {
  await authed("/auth/account", { method: "DELETE" });
  accessToken = null;
}
