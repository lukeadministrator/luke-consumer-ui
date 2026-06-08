import { useCallback, useEffect, useState } from "react";
import { useUser } from "../context/AuthContext";

// A form definition, serialized to JSON. Empty string = a new blank form.
export type FormSchema = string;

// An immutable, checked-in version — what Lukeflow workflows consume.
export type FormArtifact = { version: number; schema: FormSchema; checkedInAt: number; by?: string };

export type FormStatus = "draft" | "published" | "archived";
export type AuditEvent = { at: number; by: string; action: string; detail?: string };

export type StoredForm = {
  id: string; // internal uuid (routing/keys)
  code: string; // human-readable id, e.g. FM-XKQW-05JUN26
  name: string;
  description?: string;
  schema: FormSchema; // editable working draft (not used by workflows)
  artifacts: FormArtifact[]; // checked-in versions
  status: FormStatus;
  publishedVersion?: number; // the version workflows resolve to
  lockedBy?: string | null; // check-out lock (user id) or null
  deletedAt?: number | null; // soft delete
  audit: AuditEvent[];
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
};

// No backend yet: forms live in localStorage, scoped per Clerk user. Every
// function below is the seam to later swap for an API call.
const PREFIX = "lukeflow:forms:";
const keyFor = (userId: string) => `${PREFIX}${userId}`;
const emptySchema = (): FormSchema => "";

/* ---- Human-readable form code: FM-<4 caps>-<DDMMMYY>, e.g. FM-XKQW-05JUN26 ---- */
const MONTHS3 = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function dateCode(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}${MONTHS3[d.getMonth()]}${String(d.getFullYear()).slice(-2)}`;
}
function randomLetters(n: number): string {
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < n; i++) s += LETTERS[buf[i] % 26];
  return s;
}
// Deterministic letters from a seed (stable code for forms created before codes existed).
function seedLetters(seed: string, n = 4): string {
  let s = "";
  for (let i = 0; i < n; i++) s += LETTERS[(seed.charCodeAt((i * 5) % seed.length) || 65) % 26];
  return s;
}
export function generateFormCode(date = new Date()): string {
  return `FM-${randomLetters(4)}-${dateCode(date)}`;
}
function uniqueFormCode(userId: string): string {
  const taken = new Set(readForms(userId).map((f) => f.code));
  let code = generateFormCode();
  while (taken.has(code)) code = generateFormCode();
  return code;
}

/** Fill in defaults for forms saved before these fields existed. */
function normalize(f: StoredForm): StoredForm {
  const artifacts = f.artifacts ?? [];
  return {
    ...f,
    artifacts,
    code: f.code ?? `FM-${seedLetters(f.id)}-${dateCode(new Date(f.createdAt))}`,
    status: f.status ?? (artifacts.length ? "published" : "draft"),
    publishedVersion: f.publishedVersion ?? (artifacts.length ? artifacts[artifacts.length - 1].version : undefined),
    lockedBy: f.lockedBy ?? null,
    deletedAt: f.deletedAt ?? null,
    audit: f.audit ?? [],
    createdBy: f.createdBy ?? (f.audit ?? []).find((e) => e.action === "created")?.by ?? "",
    updatedBy: f.updatedBy ?? ((f.audit ?? []).length ? (f.audit ?? [])[(f.audit ?? []).length - 1].by : ""),
  };
}

export function readForms(userId: string): StoredForm[] {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    return (JSON.parse(raw) as StoredForm[]).map(normalize);
  } catch {
    return [];
  }
}

export function latestVersion(form: StoredForm): number {
  return form.artifacts.length ? form.artifacts[form.artifacts.length - 1].version : 0;
}

function writeForms(userId: string, forms: StoredForm[]): void {
  localStorage.setItem(keyFor(userId), JSON.stringify(forms));
}

export function readForm(userId: string, id: string): StoredForm | undefined {
  return readForms(userId).find((f) => f.id === id);
}

/** Mutate a single form in place (stamps updatedAt). */
function mutate(userId: string, id: string, fn: (f: StoredForm) => StoredForm): StoredForm | undefined {
  const forms = readForms(userId);
  const idx = forms.findIndex((f) => f.id === id);
  if (idx === -1) return undefined;
  forms[idx] = { ...fn(forms[idx]), updatedAt: Date.now(), updatedBy: userId };
  writeForms(userId, forms);
  return forms[idx];
}

const log = (f: StoredForm, by: string, action: string, detail?: string): AuditEvent[] =>
  [...f.audit, { at: Date.now(), by, action, detail }].slice(-100);

/* ---------------------------------------------------------------- */
/* Lifecycle operations                                             */
/* ---------------------------------------------------------------- */

/** Save the working draft (continuation of work; not used by workflows). */
export function saveDraft(userId: string, id: string, schema: FormSchema): void {
  mutate(userId, id, (f) => ({ ...f, schema }));
}

export function updateFormMeta(userId: string, id: string, patch: { name?: string; description?: string }): void {
  mutate(userId, id, (f) => ({ ...f, ...patch }));
}

/** Check in the draft as a new immutable version. The first check-in is
 *  auto-published; later ones require an explicit Publish. Releases the lock. */
export function checkIn(userId: string, id: string, schema: FormSchema): FormArtifact | undefined {
  let artifact: FormArtifact | undefined;
  mutate(userId, id, (f) => {
    const version = latestVersion(f) + 1;
    artifact = { version, schema, checkedInAt: Date.now(), by: userId };
    const firstPublish = f.publishedVersion === undefined;
    return {
      ...f,
      schema,
      artifacts: [...f.artifacts, artifact],
      status: f.status === "archived" ? "archived" : "published",
      publishedVersion: firstPublish ? version : f.publishedVersion,
      lockedBy: null,
      audit: log(f, userId, "checked_in", `v${version}`),
    };
  });
  return artifact;
}

/** Make a specific version the active one workflows resolve to. */
export function publishVersion(userId: string, id: string, version: number): StoredForm | undefined {
  return mutate(userId, id, (f) => ({ ...f, publishedVersion: version, status: "published", audit: log(f, userId, "published", `v${version}`) }));
}

/** Acquire the edit lock and load a version's schema into the draft. */
export function checkOut(userId: string, id: string, version?: number): StoredForm | undefined {
  return mutate(userId, id, (f) => {
    const v = version ?? f.publishedVersion ?? latestVersion(f);
    const art = f.artifacts.find((a) => a.version === v);
    return { ...f, schema: art ? art.schema : f.schema, lockedBy: userId, audit: log(f, userId, "checked_out", v ? `v${v}` : undefined) };
  });
}

/** Throw away draft edits, returning to the published (or latest) version. */
export function discardDraft(userId: string, id: string): StoredForm | undefined {
  return mutate(userId, id, (f) => {
    const v = f.publishedVersion ?? latestVersion(f);
    const art = f.artifacts.find((a) => a.version === v);
    return { ...f, schema: art ? art.schema : "", lockedBy: null, audit: log(f, userId, "discarded") };
  });
}

/** Roll an older version back into the editable draft. */
export function restoreVersion(userId: string, id: string, version: number): StoredForm | undefined {
  return mutate(userId, id, (f) => {
    const art = f.artifacts.find((a) => a.version === version);
    return art ? { ...f, schema: art.schema, audit: log(f, userId, "restored_to_draft", `v${version}`) } : f;
  });
}

export function archiveForm(userId: string, id: string, archived: boolean): StoredForm | undefined {
  return mutate(userId, id, (f) => ({
    ...f,
    status: archived ? "archived" : f.publishedVersion !== undefined ? "published" : "draft",
    audit: log(f, userId, archived ? "archived" : "unarchived"),
  }));
}

export function softDeleteForm(userId: string, id: string): void {
  mutate(userId, id, (f) => ({ ...f, deletedAt: Date.now(), audit: log(f, userId, "deleted") }));
}
export function restoreForm(userId: string, id: string): void {
  mutate(userId, id, (f) => ({ ...f, deletedAt: null, audit: log(f, userId, "restored") }));
}
export function purgeForm(userId: string, id: string): void {
  writeForms(userId, readForms(userId).filter((f) => f.id !== id));
}

export function cloneForm(userId: string, id: string): StoredForm | undefined {
  const src = readForm(userId, id);
  if (!src) return undefined;
  const now = Date.now();
  const copy: StoredForm = {
    id: crypto.randomUUID(),
    code: uniqueFormCode(userId),
    name: `Copy of ${src.name}`,
    description: src.description,
    schema: src.schema,
    artifacts: [],
    status: "draft",
    publishedVersion: undefined,
    lockedBy: null,
    deletedAt: null,
    audit: [{ at: now, by: userId, action: "created", detail: `cloned from "${src.name}"` }],
    createdBy: userId,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
  };
  writeForms(userId, [copy, ...readForms(userId)]);
  return copy;
}

/* ---------------------------------------------------------------- */
/* Hooks                                                            */
/* ---------------------------------------------------------------- */

export function useUserId(): string | null {
  const { user } = useUser();
  return user?.id ?? null;
}

/** Reactive list + lifecycle operations (auto-refresh after each mutation). */
export function useForms() {
  const { isLoaded, user } = useUser();
  const userId = user?.id ?? null;
  const [all, setAll] = useState<StoredForm[]>([]);

  const refresh = useCallback(() => {
    if (userId) setAll(readForms(userId));
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createForm = useCallback(
    (name: string): StoredForm => {
      if (!userId) throw new Error("Cannot create a form without a signed-in user.");
      const now = Date.now();
      const form: StoredForm = {
        id: crypto.randomUUID(),
        code: uniqueFormCode(userId),
        name,
        schema: emptySchema(),
        artifacts: [],
        status: "draft",
        publishedVersion: undefined,
        lockedBy: null,
        deletedAt: null,
        audit: [{ at: now, by: userId, action: "created" }],
        createdBy: userId,
        updatedBy: userId,
        createdAt: now,
        updatedAt: now,
      };
      writeForms(userId, [form, ...readForms(userId)]);
      refresh();
      return form;
    },
    [userId, refresh]
  );

  const op = useCallback(
    (fn: (uid: string) => void) => {
      if (!userId) return;
      fn(userId);
      refresh();
    },
    [userId, refresh]
  );

  return {
    ready: isLoaded && !!userId,
    userId,
    forms: all.filter((f) => !f.deletedAt),
    trashed: all.filter((f) => f.deletedAt),
    refresh,
    createForm,
    clone: (id: string) => op((uid) => cloneForm(uid, id)),
    archive: (id: string, archived: boolean) => op((uid) => archiveForm(uid, id, archived)),
    softDelete: (id: string) => op((uid) => softDeleteForm(uid, id)),
    restore: (id: string) => op((uid) => restoreForm(uid, id)),
    purge: (id: string) => op((uid) => purgeForm(uid, id)),
  };
}
