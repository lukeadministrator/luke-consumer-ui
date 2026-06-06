// Admin API for the Auth page. Everything goes through the auth-engine gateway
// (Clerk token + active tenant), which proxies to core-engine (users/groups via
// engine-rest) and capability-engine (capability grants). These are operator
// actions — the signed-in user must have the Camunda authorizations for them.
import { useAuth } from "@clerk/react";
import { useCallback } from "react";
import { authFetch } from "./api";
import { useSession } from "../context/SessionContext";

export interface AdminUser {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}
export interface CapabilityDef {
  code: string;
  name: string;
}
export interface CandidateGroup {
  id: string;
  name: string;
}

/** The 3 platform roles (Tenant / Process / Task) → their base Camunda role group. */
export const CAMUNDA_ROLES: { key: string; label: string }[] = [
  { key: "tenant-user", label: "Tenant User" },
  { key: "process-operator", label: "Process User" },
  { key: "task-worker", label: "Task User" },
];

export type Level = "none" | "read" | "read-write";
export const LEVELS: Level[] = ["none", "read", "read-write"];

export interface NewUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string; // a CAMUNDA_ROLES key
  accessLevel: "READ_ONLY" | "READ_WRITE";
}

/** Bound admin methods (auth + tenant already wired in). */
export function useAdminApi() {
  const { getToken } = useAuth();
  const { tenant } = useSession();

  const call = useCallback(
    async (path: string, init?: RequestInit): Promise<Response> =>
      authFetch(path, { getToken, tenant: tenant ?? undefined, ...init }),
    [getToken, tenant]
  );

  const json = async <T,>(res: Response): Promise<T> => {
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
    return (res.status === 204 ? null : await res.json()) as T;
  };

  return {
    tenant,

    /* ── reads ─────────────────────────────────────────── */
    listUsers: useCallback(async (): Promise<AdminUser[]> => json(await call("/engine-rest/user")), [call]),

    listCapabilities: useCallback(async (): Promise<CapabilityDef[]> => {
      const caps = await json<CapabilityDef[]>(await call("/api/capabilities"));
      return caps.filter((c) => c.code); // active catalog entries
    }, [call]),

    listCandidateGroups: useCallback(async (): Promise<CandidateGroup[]> => {
      // type=ORGANIZATIONAL = candidate groups (no authorizations), per core-engine.
      return json(await call("/engine-rest/group?type=ORGANIZATIONAL"));
    }, [call]),

    /** group ids the user belongs to (role + organizational). */
    userGroupIds: useCallback(async (userId: string): Promise<string[]> => {
      const groups = await json<{ id: string }[]>(await call(`/engine-rest/group?member=${encodeURIComponent(userId)}`));
      return groups.map((g) => g.id);
    }, [call]),

    /** capabilityCode → level for a user in the active tenant. */
    userCapabilities: useCallback(async (userId: string): Promise<Record<string, Level>> => {
      const grants = await json<{ capabilityCode: string; level: Level }[]>(
        await call(`/api/tenants/${encodeURIComponent(tenant ?? "")}/users/${encodeURIComponent(userId)}/capabilities`)
      );
      const out: Record<string, Level> = {};
      grants.forEach((g) => (out[g.capabilityCode] = g.level));
      return out;
    }, [call, tenant]),

    /* ── writes ────────────────────────────────────────── */

    /** Create a user via engine-rest (profile + password), join the tenant, assign the role. */
    createUser: useCallback(async (u: NewUser): Promise<void> => {
      await json(await call("/engine-rest/user/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email },
          credentials: { password: u.password },
        }),
      }));
      if (tenant) {
        await call(`/engine-rest/tenant/${encodeURIComponent(tenant)}/users/${encodeURIComponent(u.id)}`, { method: "PUT" });
      }
      const group = u.accessLevel === "READ_ONLY" ? `${u.role}-readonly` : u.role;
      await call(`/engine-rest/group/${encodeURIComponent(group)}/members/${encodeURIComponent(u.id)}`, { method: "PUT" });
    }, [call, tenant]),

    /** Invite by email — needs the Clerk-invitation backend (POST /api/admin/invite). */
    inviteUser: useCallback(async (email: string, role: string): Promise<void> => {
      const res = await call("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? "Email invitations aren't wired yet — they need the Clerk invitation backend (POST /api/admin/invite)."
            : `${res.status} ${await res.text().catch(() => "")}`
        );
      }
    }, [call]),

    /** Set a capability level (none = revoke). */
    setCapability: useCallback(async (userId: string, code: string, level: Level): Promise<void> => {
      const base = `/api/tenants/${encodeURIComponent(tenant ?? "")}/users/${encodeURIComponent(userId)}/capabilities/${encodeURIComponent(code)}`;
      if (level === "none") {
        await call(base, { method: "DELETE" });
      } else {
        await json(await call(base, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level }),
        }));
      }
    }, [call, tenant]),

    /** Set a Camunda role level by reconciling base / -readonly group membership. */
    setRole: useCallback(async (userId: string, roleKey: string, level: Level): Promise<void> => {
      const base = `/engine-rest/group/${encodeURIComponent(roleKey)}/members/${encodeURIComponent(userId)}`;
      const ro = `/engine-rest/group/${encodeURIComponent(roleKey + "-readonly")}/members/${encodeURIComponent(userId)}`;
      await call(base, { method: "DELETE" }).catch(() => {});
      await call(ro, { method: "DELETE" }).catch(() => {});
      if (level === "read-write") await call(base, { method: "PUT" });
      else if (level === "read") await call(ro, { method: "PUT" });
    }, [call]),

    /** Toggle candidate-group membership. */
    setGroupMembership: useCallback(async (userId: string, groupId: string, member: boolean): Promise<void> => {
      const path = `/engine-rest/group/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`;
      await call(path, { method: member ? "PUT" : "DELETE" });
    }, [call]),
  };
}
