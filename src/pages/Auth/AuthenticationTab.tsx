import { useState } from "react";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { useAdminApi, CAMUNDA_ROLES, type NewUser } from "../../lib/admin";

type Status = { kind: "idle" | "saving" | "ok" | "error"; msg?: string };
const blank: NewUser = { id: "", firstName: "", lastName: "", email: "", password: "", role: "tenant-user", accessLevel: "READ_WRITE" };

export default function AuthenticationTab() {
  const api = useAdminApi();
  const [mode, setMode] = useState<"add" | "invite">("add");

  const [form, setForm] = useState<NewUser>(blank);
  const [addStatus, setAddStatus] = useState<Status>({ kind: "idle" });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("tenant-user");
  const [inviteStatus, setInviteStatus] = useState<Status>({ kind: "idle" });

  const set = (k: keyof NewUser, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function addUser() {
    if (!form.id.trim() || !form.password) {
      setAddStatus({ kind: "error", msg: "User id and password are required." });
      return;
    }
    setAddStatus({ kind: "saving" });
    try {
      await api.createUser(form);
      setAddStatus({ kind: "ok", msg: `Created ${form.id}.` });
      setForm(blank);
    } catch (e) {
      setAddStatus({ kind: "error", msg: e instanceof Error ? e.message : String(e) });
    }
  }

  async function invite() {
    if (!inviteEmail.trim()) {
      setInviteStatus({ kind: "error", msg: "Email is required." });
      return;
    }
    setInviteStatus({ kind: "saving" });
    try {
      await api.inviteUser(inviteEmail.trim(), inviteRole);
      setInviteStatus({ kind: "ok", msg: `Invitation sent to ${inviteEmail}.` });
      setInviteEmail("");
    } catch (e) {
      setInviteStatus({ kind: "error", msg: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* mode switch */}
      <div className="mb-6 inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-800">
        {(["add", "invite"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              mode === m ? "bg-brand-500 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
            }`}
          >
            {m === "add" ? "Add user" : "Invite via email"}
          </button>
        ))}
      </div>

      {mode === "add" ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            Create a user directly in this org with a username and password, and assign their role.
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="id">User id <span className="text-error-500">*</span></Label>
              <Input id="id" value={form.id} onChange={(e) => set("id", e.target.value)} placeholder="jdoe" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jane@example.com" />
            </div>
            <div>
              <Label htmlFor="fn">First name</Label>
              <Input id="fn" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ln">Last name</Label>
              <Input id="ln" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pw">Password <span className="text-error-500">*</span></Label>
              <Input id="pw" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••••" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="role">Role</Label>
                <select id="role" value={form.role} onChange={(e) => set("role", e.target.value)} className={selectCls}>
                  {CAMUNDA_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="lvl">Access</Label>
                <select id="lvl" value={form.accessLevel} onChange={(e) => set("accessLevel", e.target.value)} className={selectCls}>
                  <option value="READ_WRITE">Read-write</option>
                  <option value="READ_ONLY">Read-only</option>
                </select>
              </div>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
            <Button size="sm" disabled={addStatus.kind === "saving"} onClick={addUser}>
              {addStatus.kind === "saving" ? "Creating…" : "Create user"}
            </Button>
            {addStatus.kind === "ok" && <span className="text-sm text-success-600 dark:text-success-400">{addStatus.msg}</span>}
            {addStatus.kind === "error" && <span className="text-sm text-error-500">{addStatus.msg}</span>}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            Email an invitation. The recipient signs up via Clerk and is auto-provisioned into this org with the chosen role.
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="iemail">Email <span className="text-error-500">*</span></Label>
              <Input id="iemail" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="newteammate@example.com" />
            </div>
            <div>
              <Label htmlFor="irole">Role</Label>
              <select id="irole" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={selectCls}>
                {CAMUNDA_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
            <Button size="sm" disabled={inviteStatus.kind === "saving"} onClick={invite}>
              {inviteStatus.kind === "saving" ? "Sending…" : "Send invitation"}
            </Button>
            {inviteStatus.kind === "ok" && <span className="text-sm text-success-600 dark:text-success-400">{inviteStatus.msg}</span>}
            {inviteStatus.kind === "error" && <span className="text-sm text-error-500">{inviteStatus.msg}</span>}
          </div>
        </section>
      )}
    </div>
  );
}

const selectCls =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90";
