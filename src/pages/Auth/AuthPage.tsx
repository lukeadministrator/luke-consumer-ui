import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useSession } from "../../context/SessionContext";
import AuthenticationTab from "./AuthenticationTab";
import AuthorizationTab from "./AuthorizationTab";

type Tab = "authentication" | "authorization";

export default function AuthPage() {
  const { operator, loading, session } = useSession();
  const [tab, setTab] = useState<Tab>("authentication");

  return (
    <>
      <PageMeta title="Auth | Lukeflow" description="Manage users, roles and access." />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">Auth</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage who can sign in (Authentication) and what they can do (Authorization).
        </p>
      </div>

      {loading && !session ? (
        <div className="flex h-[40vh] items-center justify-center text-sm text-gray-400">Loading…</div>
      ) : !operator ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Operators only</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Managing users and access requires an operator (admin) account.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 flex gap-1 border-b border-gray-200 dark:border-gray-800">
            {([["authentication", "Authentication"], ["authorization", "Authorization"]] as [Tab, string][]).map(
              ([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                    tab === key
                      ? "border-brand-500 text-brand-600 dark:text-brand-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>

          {tab === "authentication" ? <AuthenticationTab /> : <AuthorizationTab />}
        </>
      )}
    </>
  );
}
