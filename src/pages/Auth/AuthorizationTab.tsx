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

export default function AuthorizationTab() {
  const api = useAdminApi();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityDef[]>([]);
  const [groups, setGroups] = useState<CandidateGroup[]>([]);
  const [caps, setCaps] = useState<Record<string, Record<string, Level>>>({});
  const [groupIds, setGroupIds] = useState<Record<string, string[]>>({});
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
      const capEntries = await Promise.all(us.map(async (u) => [u.id, await api.userCapabilities(u.id)] as const));
      const gidEntries = await Promise.all(us.map(async (u) => [u.id, await api.userGroupIds(u.id)] as const));
      setCaps(Object.fromEntries(capEntries));
      setGroupIds(Object.fromEntries(gidEntries));
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

  /* ── derived cell values ─────────────────────────────── */
  const capValue = (userId: string, code: string): Level => caps[userId]?.[code] ?? "none";
  const roleValue = (userId: string, roleKey: string): Level => {
    const ids = groupIds[userId] ?? [];
    if (ids.includes(roleKey)) return "read-write";
    if (ids.includes(`${roleKey}-readonly`)) return "read";
    return "none";
  };
  const groupValue = (userId: string, groupId: string): boolean => (groupIds[userId] ?? []).includes(groupId);

  /* ── setters (optimistic local update after the API succeeds) ─ */
  const setCap = async (userId: string, code: string, level: Level) => {
    await api.setCapability(userId, code, level);
    setCaps((c) => ({ ...c, [userId]: { ...(c[userId] ?? {}), [code]: level } }));
  };
  const setRole = async (userId: string, roleKey: string, level: Level) => {
    await api.setRole(userId, roleKey, level);
    setGroupIds((g) => {
      const ids = (g[userId] ?? []).filter((id) => id !== roleKey && id !== `${roleKey}-readonly`);
      if (level === "read-write") ids.push(roleKey);
      else if (level === "read") ids.push(`${roleKey}-readonly`);
      return { ...g, [userId]: ids };
    });
  };
  const setGroup = async (userId: string, groupId: string, member: boolean) => {
    await api.setGroupMembership(userId, groupId, member);
    setGroupIds((g) => {
      const ids = (g[userId] ?? []).filter((id) => id !== groupId);
      if (member) ids.push(groupId);
      return { ...g, [userId]: ids };
    });
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50/40 p-5 text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/5">
        Couldn't load access data: {error}
        <p className="mt-1 text-xs text-gray-500">
          These are operator actions — your account needs admin authorizations in the engine.
        </p>
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
        emptyColumns="No capabilities in the catalog."
      />
      <AccessMatrix
        mode="level"
        title="Camunda roles"
        description="Tenant / Process / Task access — read or read-write — enforced natively by the engine."
        users={users}
        columns={CAMUNDA_ROLES}
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
