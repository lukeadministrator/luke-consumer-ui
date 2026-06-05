import { useState } from "react";
import { useUser, useClerk } from "@clerk/react";
import PageMeta from "../../components/common/PageMeta";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";

type Status = { kind: "idle" | "saving" | "ok" | "error"; msg?: string };

export default function Settings() {
  const { isLoaded, user } = useUser();
  const { signOut } = useClerk();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [pwStatus, setPwStatus] = useState<Status>({ kind: "idle" });

  const [confirmDelete, setConfirmDelete] = useState("");
  const [delStatus, setDelStatus] = useState<Status>({ kind: "idle" });

  if (!isLoaded || !user) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  const hasPassword = user.passwordEnabled;

  async function handlePassword() {
    if (!user) return;
    if (next.length < 8) {
      setPwStatus({ kind: "error", msg: "Password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setPwStatus({ kind: "error", msg: "New passwords don't match." });
      return;
    }
    setPwStatus({ kind: "saving" });
    try {
      await user.updatePassword({
        newPassword: next,
        currentPassword: hasPassword ? current : undefined,
        signOutOfOtherSessions: signOutOthers,
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      setPwStatus({ kind: "ok", msg: hasPassword ? "Password updated." : "Password set." });
    } catch (err) {
      setPwStatus({ kind: "error", msg: errMsg(err) });
    }
  }

  async function handleDelete() {
    if (!user) return;
    setDelStatus({ kind: "saving" });
    try {
      await user.delete();
      await signOut({ redirectUrl: "/signin" });
    } catch (err) {
      setDelStatus({ kind: "error", msg: errMsg(err) });
    }
  }

  return (
    <>
      <PageMeta
        title="Account settings | Lukeflow"
        description="Manage your Lukeflow account security and email addresses."
      />

      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
            Account settings
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your email addresses, password, and account.
          </p>
        </div>

        {/* Email addresses */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">
            Email addresses
          </h2>
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {user.emailAddresses.map((e) => {
              const isPrimary = e.id === user.primaryEmailAddressId;
              const verified = e.verification?.status === "verified";
              return (
                <li key={e.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{e.emailAddress}</span>
                  <span className="flex items-center gap-2">
                    {isPrimary && (
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                        Primary
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        verified
                          ? "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400"
                          : "bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400"
                      }`}
                    >
                      {verified ? "Verified" : "Unverified"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Password */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-1 text-base font-semibold text-gray-800 dark:text-white/90">
            {hasPassword ? "Change password" : "Set a password"}
          </h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {hasPassword
              ? "Use at least 8 characters."
              : "You signed in with a social account. Set a password to also sign in with email."}
          </p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {hasPassword && (
              <div className="sm:col-span-2">
                <Label htmlFor="current">Current password</Label>
                <Input
                  id="current"
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            )}
            <div>
              <Label htmlFor="next">New password</Label>
              <Input
                id="next"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={signOutOthers}
              onChange={(e) => setSignOutOthers(e.target.checked)}
              className="size-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900"
            />
            Sign out of all other devices
          </label>

          <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
            <Button
              size="sm"
              disabled={!next || pwStatus.kind === "saving"}
              onClick={handlePassword}
            >
              {pwStatus.kind === "saving" ? "Saving…" : hasPassword ? "Update password" : "Set password"}
            </Button>
            {pwStatus.kind === "ok" && (
              <span className="text-sm text-success-600 dark:text-success-400">{pwStatus.msg}</span>
            )}
            {pwStatus.kind === "error" && (
              <span className="text-sm text-error-500">{pwStatus.msg}</span>
            )}
          </div>
        </section>

        {/* Danger zone */}
        <section className="rounded-2xl border border-error-200 bg-error-50/40 p-5 dark:border-error-500/30 dark:bg-error-500/5">
          <h2 className="mb-1 text-base font-semibold text-error-600 dark:text-error-400">
            Delete account
          </h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Permanently delete your account and all associated data. This cannot be undone.
            Type <span className="font-mono font-medium text-gray-800 dark:text-gray-200">DELETE</span> to confirm.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="sm:w-64">
              <Input
                value={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.value)}
                placeholder="DELETE"
              />
            </div>
            <button
              disabled={confirmDelete !== "DELETE" || delStatus.kind === "saving"}
              onClick={handleDelete}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-error-500 px-5 py-3.5 text-sm text-white transition hover:bg-error-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {delStatus.kind === "saving" ? "Deleting…" : "Delete my account"}
            </button>
          </div>
          {delStatus.kind === "error" && (
            <p className="mt-3 text-sm text-error-500">{delStatus.msg}</p>
          )}
        </section>
      </div>
    </>
  );
}

function errMsg(err: unknown): string {
  const e = err as { errors?: { message?: string; longMessage?: string }[]; message?: string };
  return e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || e?.message || "Something went wrong.";
}
