// Admin API for the Auth page. Calls the tenant-scoped org-admin API on
// core-engine (/api/org/*) through the gateway. Every call is authorized
// server-side (caller must be tenant-admin of the active tenant, or operator)
// and scoped to that tenant — so org owners self-serve without global admin.
import { useAuth } from "@clerk/react";
import { useCallback } from "react";
import { authFetch } from "./api";
import { useSession } from "../context/SessionContext";

export type Level = "none" | "read" | "read-write";

export interface AdminUser {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roles?: Record<string, Level>; // tenantUser/processUser/taskUser
  candidateGroups?: string[]; // group ids (namespaced "<tenant>:slug")
}
export interface CapabilityDef {
  code: string;
  name: string;
}
export interface CandidateGroup {
  id: string;
  name: string;
}

/** The 3 platform roles: matrix dimension + the Camunda role group it maps to. */
export const CAMUNDA_ROLES: { dim: string; group: string; label: string }[] = [
  { dim: "tenantUser", group: "tenant-user", label: "Tenant User" },
  { dim: "processUser", group: "process-operator", label: "Process User" },
  { dim: "taskUser", group: "task-worker", label: "Task User" },
];

export interface NewUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string; // a CAMUNDA_ROLES group
  accessLevel: "READ_ONLY" | "READ_WRITE";
}

export function useAdminApi() {
  const { getToken } = useAuth();
  const { tenant } = useSession();

  const call = useCallback(
    (path: string, init?: RequestInit): Promise<Response> =>
      authFetch(path, { getToken, tenant: tenant ?? undefined, ...init }),
    [getToken, tenant]
  );
  const json = async <T,>(res: Response): Promise<T> => {
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
    return (res.status === 204 ? null : await res.json()) as T;
  };
  const jsonBody = (init: RequestInit, body: unknown): RequestInit => ({
    ...init,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    tenant,

    listUsers: useCallback(async (): Promise<AdminUser[]> => json(await call("/api/org/users")), [call]),
    listCapabilities: useCallback(async (): Promise<CapabilityDef[]> => json(await call("/api/org/capabilities")), [call]),
    listCandidateGroups: useCallback(async (): Promise<CandidateGroup[]> => json(await call("/api/org/candidate-groups")), [call]),
    userCapabilities: useCallback(
      async (userId: string): Promise<{ capabilityCode: string; level: Level }[]> =>
        json(await call(`/api/org/users/${encodeURIComponent(userId)}/capabilities`)),
      [call]
    ),

    createUser: useCallback(
      async (u: NewUser): Promise<void> => {
        await json(await call("/api/org/users", jsonBody({ method: "POST" }, u)));
      },
      [call]
    ),

    inviteUser: useCallback(async (email: string, role: string): Promise<void> => {
      const res = await call("/api/admin/invite", jsonBody({ method: "POST" }, { email, role }));
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? "Email invitations aren't wired yet — they need the Clerk invitation backend (POST /api/admin/invite)."
            : `${res.status} ${await res.text().catch(() => "")}`
        );
      }
    }, [call]),

    setCapability: useCallback(async (userId: string, code: string, level: Level): Promise<void> => {
      const base = `/api/org/users/${encodeURIComponent(userId)}/capabilities/${encodeURIComponent(code)}`;
      await json(level === "none" ? await call(base, { method: "DELETE" }) : await call(base, jsonBody({ method: "PUT" }, { level })));
    }, [call]),

    setRole: useCallback(async (userId: string, group: string, level: Level): Promise<void> => {
      await json(await call(`/api/org/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(group)}`, jsonBody({ method: "PUT" }, { level })));
    }, [call]),

    setGroupMembership: useCallback(async (userId: string, groupId: string, member: boolean): Promise<void> => {
      await call(`/api/org/users/${encodeURIComponent(userId)}/candidate-groups/${encodeURIComponent(groupId)}`, { method: member ? "PUT" : "DELETE" });
    }, [call]),

    createCandidateGroup: useCallback(async (name: string): Promise<void> => {
      await json(await call("/api/org/candidate-groups", jsonBody({ method: "POST" }, { name })));
    }, [call]),
  };
}
