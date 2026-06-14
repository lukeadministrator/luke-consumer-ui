import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { createColumnHelper } from "@tanstack/react-table";
import DataTable from "../../components/tables/DataTable";
import { useAuth, useUser } from "../../context/AuthContext";
import { canWrite, FORMS } from "../../lib/capabilities";
import PageMeta from "../../components/common/PageMeta";
import { Modal } from "../../components/ui/modal";
import Button from "../../components/ui/button/Button";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import { PlusIcon, ListIcon, TrashBinIcon, TimeIcon, CopyIcon, BoxIcon, PaperPlaneIcon, EyeIcon } from "../../icons";
import { useForms, type StoredForm, type FormStatus } from "../../lib/formsStore";
import { listVersions, publishVersion, restoreVersion, type FormArtifact } from "../../lib/formsApi";
const FormRenderer = lazy(() => import("../../components/formBuilder/FormRenderer"));

const STATUS_BADGE: Record<FormStatus, string> = {
  draft: "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400",
  published: "bg-success-50 text-success-600 dark:bg-success-500/15",
  archived: "bg-amber-50 text-amber-600 dark:bg-amber-500/15",
};

const col = createColumnHelper<StoredForm>();

function formatUpdated(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function FormsList() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { session } = useAuth();
  // read → view-only (no create/edit/delete); read-write → full control.
  const canEdit = canWrite(session, FORMS);
  const { userId, tenant, forms, trashed, loading, error, createForm, clone, archive, softDelete, restore, purge, refresh } = useForms();
  const me = user?.fullName || user?.firstName || user?.email || "You";
  const who = (id?: string) => (id && id === userId ? me : id ? `${id.slice(0, 10)}…` : "—");

  const [isModalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [historyForm, setHistoryForm] = useState<StoredForm | null>(null);
  const [historyVersions, setHistoryVersions] = useState<FormArtifact[]>([]);
  const [previewSchema, setPreviewSchema] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<StoredForm | null>(null);
  const [purging, setPurging] = useState(false);

  const confirmPurge = async () => {
    if (!purgeTarget || purging) return;
    setPurging(true);
    try {
      await purge(purgeTarget.id);
      setPurgeTarget(null);
    } finally {
      setPurging(false);
    }
  };

  // Load checked-in versions whenever the history modal opens for a form.
  useEffect(() => {
    if (!historyForm || !tenant) { setHistoryVersions([]); return; }
    let active = true;
    listVersions(tenant, historyForm.id)
      .then((vs) => active && setHistoryVersions(vs))
      .catch(() => active && setHistoryVersions([]));
    return () => { active = false; };
  }, [historyForm, tenant]);

  const openModal = () => {
    setName("");
    setModalOpen(true);
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const form = await createForm(trimmed);
      setModalOpen(false);
      setName("");
      if (form) navigate(`/forms/${form.id}`);
    } finally {
      setCreating(false);
    }
  };

  const hasForms = forms.length > 0;

  const columns = [
    col.accessor("name", {
      header: "Form Name",
      cell: (c) => (
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/10">
            <ListIcon className="size-4" />
          </span>
          <span className="font-medium text-gray-800 dark:text-white/90">{c.getValue()}</span>
        </div>
      ),
    }),
    col.accessor("code", {
      header: "Form ID",
      cell: (c) => (
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{c.getValue()}</span>
      ),
    }),
    col.accessor("status", {
      header: "Status",
      cell: (c) => (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_BADGE[c.getValue()]}`}>
          {c.getValue()}
        </span>
      ),
    }),
    col.accessor((f) => f.publishedVersion ?? 0, {
      id: "version",
      header: "Version",
      cell: (c) => (
        <span className="text-gray-600 dark:text-gray-300">{c.getValue() ? `v${c.getValue()}` : "—"}</span>
      ),
    }),
    col.accessor("createdAt", {
      header: "Created",
      cell: (c) => <span className="text-gray-500 dark:text-gray-400">{formatUpdated(c.getValue())}</span>,
    }),
    col.accessor((f) => who(f.createdBy), {
      id: "createdBy",
      header: "Created By",
      cell: (c) => <span className="text-gray-500 dark:text-gray-400">{c.getValue()}</span>,
    }),
    col.accessor("updatedAt", {
      header: "Last Modified",
      cell: (c) => <span className="text-gray-500 dark:text-gray-400">{formatUpdated(c.getValue())}</span>,
    }),
    col.accessor((f) => who(f.updatedBy), {
      id: "updatedBy",
      header: "Modified By",
      cell: (c) => <span className="text-gray-500 dark:text-gray-400">{c.getValue()}</span>,
    }),
    col.display({
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { align: "right" },
      cell: (c) => {
        const form = c.row.original;
        return (
          <div className="flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
            {form.publishedVersion ? (
              <button type="button" aria-label="Fill" title="Fill out this form" onClick={(e) => { e.stopPropagation(); navigate(`/forms/${form.code}/fill`); }} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-gray-800"><PaperPlaneIcon className="size-4" /></button>
            ) : null}
            <button type="button" aria-label="Responses" title="View responses" onClick={(e) => { e.stopPropagation(); navigate(`/forms/${form.code}/responses`); }} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-gray-800"><EyeIcon className="size-4" /></button>
            {canEdit && (
              <>
                {form.latestVersion > 0 && (
                  <button type="button" aria-label="Version history" onClick={(e) => { e.stopPropagation(); setHistoryForm(form); }} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-gray-800"><TimeIcon className="size-4" /></button>
                )}
                <button type="button" aria-label="Duplicate" onClick={(e) => { e.stopPropagation(); clone(form.id); }} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"><CopyIcon className="size-4" /></button>
                <button type="button" aria-label={form.status === "archived" ? "Unarchive" : "Archive"} onClick={(e) => { e.stopPropagation(); archive(form.id, form.status !== "archived"); }} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-amber-500 dark:hover:bg-gray-800"><BoxIcon className="size-4" /></button>
                <button type="button" aria-label="Delete" onClick={(e) => { e.stopPropagation(); softDelete(form.id); }} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-error-500 dark:hover:bg-gray-800"><TrashBinIcon className="size-4" /></button>
              </>
            )}
          </div>
        );
      },
    }),
  ];

  return (
    <>
      <PageMeta
        title="Forms | Lukeflow"
        description="Build and manage your forms with the Lukeflow form builder."
      />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-white/90">
            Forms
            {!canEdit && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-gray-400">
                View only
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {canEdit
              ? "Design forms with the drag-and-drop builder."
              : "You have read-only access to forms. Ask an org owner for edit access."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && trashed.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowTrash((v) => !v)} startIcon={showTrash ? undefined : <TrashBinIcon className="size-4" />}>
              {showTrash ? "Back to forms" : `Trash (${trashed.length})`}
            </Button>
          )}
          {canEdit && hasForms && !showTrash && (
            <Button startIcon={<PlusIcon className="size-4" />} onClick={openModal}>
              Create form
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-error-500 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </div>
      )}

      {loading && forms.length === 0 && !showTrash ? (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-400">Loading forms…</div>
      ) : showTrash ? (
        <div className="space-y-2">
          {trashed.map((form) => (
            <div key={form.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-800">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{form.name}</p>
                <p className="text-xs text-gray-400">Deleted {form.deletedAt ? formatUpdated(form.deletedAt) : ""}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => restore(form.id)}>Restore</Button>
                <Button size="sm" variant="outline" onClick={() => setPurgeTarget(form)}>Delete forever</Button>
              </div>
            </div>
          ))}
        </div>
      ) : hasForms ? (
        <DataTable
          columns={columns}
          data={forms}
          onRowClick={(form) => navigate(`/forms/${form.id}`)}
          searchPlaceholder="Search forms…"
          minWidth="min-w-[980px]"
          emptyMessage="No forms match your search."
        />
      ) : (
        // Empty state shown if the user dismisses the auto-opened modal.
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/10">
            <ListIcon className="size-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            No forms yet
          </h2>
          <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            {canEdit
              ? "Create your first form and start building it with the drag-and-drop designer."
              : "There are no forms to view yet, and you have read-only access."}
          </p>
          {canEdit && (
            <div className="mt-6">
              <Button startIcon={<PlusIcon className="size-4" />} onClick={openModal}>
                Create form
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        className="mx-4 w-full max-w-[480px]"
      >
        <div className="p-6 sm:p-8">
          <h2 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white/90">
            Name your form
          </h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Give your form a name to get started. You can change it later.
          </p>

          <div>
            <Label>
              Form name <span className="text-error-500">*</span>
            </Label>
            <Input
              name="formName"
              placeholder="Contact request"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || creating}>
              {creating ? "Creating…" : "Create & design"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Version history */}
      <Modal isOpen={!!historyForm} onClose={() => setHistoryForm(null)} className="mx-4 w-full max-w-[480px]">
        <div className="p-6">
          <h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">Version history</h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{historyForm?.name}</p>
          <ul className="space-y-2">
            {historyVersions.length === 0 && (
              <li className="py-2 text-sm text-gray-400">No checked-in versions yet.</li>
            )}
            {historyVersions.slice().reverse().map((art) => {
              const isLive = historyForm?.publishedVersion === art.version;
              return (
                <li key={art.version} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-4 py-2.5 dark:border-gray-800">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-800 dark:text-white/90">v{art.version}</span>
                    {isLive && <span className="ml-2 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-medium uppercase text-success-600 dark:bg-success-500/15">Live</span>}
                    <span className="ml-2 text-xs text-gray-400">{new Date(art.checkedInAt).toLocaleString()}</span>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setPreviewSchema(art.schema)}>Preview</Button>
                    {canEdit && !isLive && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        if (!tenant || !historyForm) return;
                        await publishVersion(tenant, historyForm.id, art.version);
                        await refresh();
                        setHistoryForm({ ...historyForm, publishedVersion: art.version, status: "published" });
                      }}>Publish</Button>
                    )}
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        if (!tenant || !historyForm) return;
                        if (!window.confirm(`Restore v${art.version} into the editable draft? Current draft edits will be replaced.`)) return;
                        await restoreVersion(tenant, historyForm.id, art.version);
                        await refresh();
                        setHistoryForm(null);
                      }}>Restore</Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Modal>

      {/* Delete-forever confirmation */}
      <Modal isOpen={!!purgeTarget} onClose={() => (purging ? undefined : setPurgeTarget(null))} className="mx-4 w-full max-w-[440px]">
        <div className="p-6 sm:p-8">
          <h2 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">Delete forever?</h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-200">{purgeTarget?.name}</span> and all its versions
            will be permanently deleted. This can't be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPurgeTarget(null)} disabled={purging}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmPurge} disabled={purging}>
              {purging ? "Deleting…" : "Delete forever"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Artifact preview */}
      <Modal isOpen={!!previewSchema} onClose={() => setPreviewSchema(null)} className="mx-4 max-h-[90vh] w-full max-w-[640px] overflow-y-auto">
        <div className="p-6 sm:p-8">
          <h2 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">Preview</h2>
          {previewSchema ? (
            <Suspense fallback={<p className="py-6 text-center text-sm text-gray-400">Loading…</p>}>
              <FormRenderer schema={previewSchema} />
            </Suspense>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
