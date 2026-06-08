import { useState } from "react";
import { useAuth, useUser } from "../../context/AuthContext";
import PageMeta from "../../components/common/PageMeta";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { getAuthErrorMessage } from "../../components/auth/authError";

type Status = { kind: "idle" | "saving" | "ok" | "error"; msg?: string };

export default function Profile() {
  const { isLoaded, user } = useUser();
  const { updateProfile } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  if (!isLoaded || !user) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  const email = user.email || "—";
  const initials =
    ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() ||
    (email[0] ?? "?").toUpperCase();
  const dirty =
    firstName !== (user.firstName ?? "") || lastName !== (user.lastName ?? "");

  async function handleSave() {
    setStatus({ kind: "saving" });
    try {
      await updateProfile({ firstName, lastName });
      setStatus({ kind: "ok", msg: "Profile updated." });
    } catch (err) {
      setStatus({ kind: "error", msg: getAuthErrorMessage(err) });
    }
  }

  return (
    <>
      <PageMeta title="Edit profile | Lukeflow" description="Manage your Lukeflow profile." />

      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">Edit profile</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update your name.</p>
        </div>

        {/* Avatar — social picture or initials (upload not supported by WorkOS) */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-5">
            <span className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-lg font-semibold text-brand-600 ring-1 ring-gray-200 dark:bg-brand-500/10 dark:text-brand-400 dark:ring-gray-700">
              {user.profilePictureUrl ? (
                <img src={user.profilePictureUrl} alt="Profile" className="size-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <p className="text-xs text-gray-400">
              Your photo comes from your social login.
            </p>
          </div>
        </section>

        {/* Details */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled />
              <p className="mt-1.5 text-xs text-gray-400">
                Manage your password and account in{" "}
                <a href="/account/settings" className="text-brand-500 hover:underline">
                  Account settings
                </a>
                .
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
            <Button size="sm" disabled={!dirty || status.kind === "saving"} onClick={handleSave}>
              {status.kind === "saving" ? "Saving…" : "Save changes"}
            </Button>
            {status.kind === "ok" && (
              <span className="text-sm text-success-600 dark:text-success-400">{status.msg}</span>
            )}
            {status.kind === "error" && (
              <span className="text-sm text-error-500">{status.msg}</span>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
