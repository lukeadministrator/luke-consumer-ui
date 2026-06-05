import { useRef, useState } from "react";
import { useUser } from "@clerk/react";
import PageMeta from "../../components/common/PageMeta";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";

type Status = { kind: "idle" | "saving" | "ok" | "error"; msg?: string };

export default function Profile() {
  const { isLoaded, user } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [uploading, setUploading] = useState(false);

  if (!isLoaded || !user) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  const email = user.primaryEmailAddress?.emailAddress ?? "—";
  const avatarUrl = user.imageUrl || "/images/user/owner.jpg";
  const dirty =
    firstName !== (user.firstName ?? "") ||
    lastName !== (user.lastName ?? "") ||
    username !== (user.username ?? "");

  async function handleSave() {
    if (!user) return;
    setStatus({ kind: "saving" });
    try {
      await user.update({ firstName, lastName, username: username || undefined });
      setStatus({ kind: "ok", msg: "Profile updated." });
    } catch (err) {
      setStatus({ kind: "error", msg: errMsg(err) });
    }
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setStatus({ kind: "idle" });
    try {
      await user.setProfileImage({ file });
      setStatus({ kind: "ok", msg: "Photo updated." });
    } catch (err) {
      setStatus({ kind: "error", msg: errMsg(err) });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemoveImage() {
    if (!user) return;
    setUploading(true);
    try {
      await user.setProfileImage({ file: null });
      setStatus({ kind: "ok", msg: "Photo removed." });
    } catch (err) {
      setStatus({ kind: "error", msg: errMsg(err) });
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <PageMeta
        title="Edit profile | Lukeflow"
        description="Manage your Lukeflow profile."
      />

      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
            Edit profile
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Update your name, username, and profile photo.
          </p>
        </div>

        {/* Photo */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-5">
            <span className="size-20 overflow-hidden rounded-full ring-1 ring-gray-200 dark:ring-gray-700">
              <img src={avatarUrl} alt="Profile" className="size-full object-cover" />
            </span>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? "Uploading…" : "Change photo"}
                </Button>
                {user.hasImage && (
                  <Button size="sm" variant="outline" disabled={uploading} onClick={handleRemoveImage}>
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-400">JPG, PNG or GIF. Max 10MB.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImage}
            />
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
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
              />
            </div>
            <div>
              <Label htmlFor="email">Primary email</Label>
              <Input id="email" value={email} disabled />
              <p className="mt-1.5 text-xs text-gray-400">
                Manage email addresses in{" "}
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

function errMsg(err: unknown): string {
  const e = err as { errors?: { message?: string; longMessage?: string }[]; message?: string };
  return e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || e?.message || "Something went wrong.";
}
