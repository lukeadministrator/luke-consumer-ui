import { useState } from "react";
import type { AdminUser, Level } from "../../lib/admin";

interface Column {
  key: string;
  label: string;
}

interface BaseProps {
  title: string;
  description?: string;
  users: AdminUser[];
  columns: Column[];
  loading?: boolean;
  emptyColumns?: string;
}

interface LevelProps extends BaseProps {
  mode: "level";
  value: (userId: string, colKey: string) => Level;
  onSet: (userId: string, colKey: string, value: Level) => Promise<void>;
}

interface ToggleProps extends BaseProps {
  mode: "toggle";
  value: (userId: string, colKey: string) => boolean;
  onSet: (userId: string, colKey: string, value: boolean) => Promise<void>;
}

type Props = LevelProps | ToggleProps;

const userLabel = (u: AdminUser) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id;

/**
 * A user × column access grid. `level` mode renders a none/read/read-write
 * dropdown per cell; `toggle` mode renders a membership checkbox. Each change
 * saves immediately via onSet, with a per-cell saving state.
 */
export default function AccessMatrix(props: Props) {
  const { title, description, users, columns, loading, emptyColumns } = props;
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const cellKey = (u: string, c: string) => `${u}|${c}`;

  async function handle(userId: string, colKey: string, next: Level | boolean) {
    const k = cellKey(userId, colKey);
    setSaving((s) => ({ ...s, [k]: true }));
    try {
      if (props.mode === "level") await props.onSet(userId, colKey, next as Level);
      else await props.onSet(userId, colKey, next as boolean);
    } catch (e) {
      alert(`Couldn't save: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSaving((s) => ({ ...s, [k]: false }));
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      </div>

      {loading ? (
        <p className="px-5 py-10 text-center text-sm text-gray-400">Loading…</p>
      ) : columns.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-400">{emptyColumns ?? "Nothing to show."}</p>
      ) : users.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-400">No users yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
                <th className="px-5 py-3 font-medium">User</th>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0 dark:border-gray-800/60">
                  <td className="px-5 py-2.5">
                    <div className="font-medium text-gray-800 dark:text-white/90">{userLabel(u)}</div>
                    <div className="font-mono text-[11px] text-gray-400">{u.id}</div>
                  </td>
                  {columns.map((c) => {
                    const busy = saving[cellKey(u.id, c.key)];
                    return (
                      <td key={c.key} className="px-4 py-2.5">
                        {props.mode === "level" ? (
                          <select
                            disabled={busy}
                            value={props.value(u.id, c.key)}
                            onChange={(e) => handle(u.id, c.key, e.target.value as Level)}
                            className="h-8 rounded-lg border border-gray-200 bg-transparent px-2 text-xs text-gray-700 focus:border-brand-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
                          >
                            <option value="none">none</option>
                            <option value="read">read</option>
                            <option value="read-write">read-write</option>
                          </select>
                        ) : (
                          <input
                            type="checkbox"
                            disabled={busy}
                            checked={props.value(u.id, c.key)}
                            onChange={(e) => handle(u.id, c.key, e.target.checked)}
                            className="size-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/20 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
