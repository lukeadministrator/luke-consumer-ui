import { useCallback, useEffect, useState } from "react";
import AccessMatrix from "./AccessMatrix";
import {
  useAdminApi,
  CAMUNDA_ROLES,
  type AdminUser,
  type CapabilityDef,
  type CandidateGroup,
  type Level,
} from "../../lib/admin";

const dimToGroup = Object.fromEntries(CAMUNDA_ROLES.map((r) => [r.dim, r.group]));

export default function AuthorizationTab() {
  const api = useAdminApi();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityDef[]>([]);
  const [groups, setGroups] = useState<CandidateGroup[]>([]);
  const [caps, setCaps] = useState<Record<string, Record<string, Level>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [us, cs, gs] = await Promise.all([api.listUsers(), api.listCapabilities(), api.listCandidateGroups()]);
      setUsers(us);
      setCapabilities(cs);
      setGroups(gs);
      const capEntries = await Promise.all(
        us.map(async (u) => {
          const grants = await api.userCapabilities(u.id);
          const m: Record<string, Level> = {};
          grants.forEach((g) => (m[g.capabilityCode] = g.level));
          return [u.id, m] as const;
        })
      );
      setCaps(Object.fromEntries(capEntries));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userById = (id: string) => users.find((u) => u.id === id);

  const capValue = (userId: string, code: string): Level => caps[userId]?.[code] ?? "none";
  const roleValue = (userId: string, dim: string): Level => (userById(userId)?.roles?.[dim] as Level) ?? "none";
  const groupValue = (userId: string, groupId: string): boolean => !!userById(userId)?.candidateGroups?.includes(groupId);

  const patchUser = (userId: string, fn: (u: AdminUser) => AdminUser) =>
    setUsers((list) => list.map((u) => (u.id === userId ? fn(u) : u)));

  const setCap = async (userId: string, code: string, level: Level) => {
    await api.setCapability(userId, code, level);
    setCaps((c) => ({ ...c, [userId]: { ...(c[userId] ?? {}), [code]: level } }));
  };
  const setRole = async (userId: string, dim: string, level: Level) => {
    await api.setRole(userId, dimToGroup[dim], level);
    patchUser(userId, (u) => ({ ...u, roles: { ...(u.roles ?? {}), [dim]: level } }));
  };
  const setGroup = async (userId: string, groupId: string, member: boolean) => {
    await api.setGroupMembership(userId, groupId, member);
    patchUser(userId, (u) => {
      const cg = (u.candidateGroups ?? []).filter((g) => g !== groupId);
      if (member) cg.push(groupId);
      return { ...u, candidateGroups: cg };
    });
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50/40 p-5 text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/5">
        Couldn't load access data: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AccessMatrix
        mode="level"
        title="Capabilities"
        description="What each user can do with platform capabilities (Forms, etc.) in this org."
        users={users}
        columns={capabilities.map((c) => ({ key: c.code, label: c.name || c.code }))}
        value={capValue}
        onSet={setCap}
        loading={loading}
        emptyColumns="This org has no capabilities yet."
      />
      <AccessMatrix
        mode="level"
        title="Camunda roles"
        description="Tenant / Process / Task access — read or read-write — enforced natively by the engine."
        users={users}
        columns={CAMUNDA_ROLES.map((r) => ({ key: r.dim, label: r.label }))}
        value={roleValue}
        onSet={setRole}
        loading={loading}
      />
      <AccessMatrix
        mode="toggle"
        title="Candidate groups"
        description="ABAC routing — which groups a user belongs to (e.g. sales, accounting) for task assignment."
        users={users}
        columns={groups.map((g) => ({ key: g.id, label: g.name || g.id }))}
        value={groupValue}
        onSet={setGroup}
        loading={loading}
        emptyColumns="No candidate groups yet."
      />
    </div>
  );
}
