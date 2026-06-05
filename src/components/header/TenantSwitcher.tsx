import { useSession } from "../../context/SessionContext";

/**
 * Org switcher. The user picks the active tenant; SessionContext sends it to
 * auth-engine, which validates membership and re-derives permissions. Hidden
 * when the user belongs to a single org (nothing to switch).
 */
export default function TenantSwitcher() {
  const { tenants, tenant, switchTenant, loading } = useSession();

  if (tenants.length <= 1) return null;

  return (
    <select
      value={tenant ?? ""}
      disabled={loading}
      onChange={(e) => switchTenant(e.target.value)}
      aria-label="Active organization"
      className="h-9 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 disabled:opacity-50 dark:border-gray-800 dark:text-gray-300"
    >
      {tenants.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
