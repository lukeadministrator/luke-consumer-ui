import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { Columns2, Inbox as InboxIcon, LayoutList } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import DataTable from "../../components/tables/DataTable";
import { Modal } from "../../components/ui/modal";
import { useAuth } from "../../context/AuthContext";
import FormRenderer from "../../components/formBuilder/FormRenderer";
import { completeTask, getInbox, type InboxTask } from "../../lib/formInboxApi";
import { getInstance, type InstanceView } from "../../lib/formInstancesApi";

const fmt = (ms?: number) => (ms ? new Date(ms).toLocaleString() : "—");
const who = (a?: string | null) => (a ? a.replace(/^workos:/, "") : null);

type ViewMode = "table" | "split";
const VIEW_KEY = "lk.inbox.view";
const col = createColumnHelper<InboxTask>();

// The reviewer's inbox: open user tasks (e.g. "Review Submission") for the
// tenant. View as a sortable table (open each in a modal) or as an Outlook-style
// split — a task list on the left, the submission preview on the right.
export default function FormInbox() {
  const { session } = useAuth();
  const tenant = session?.tenant ?? null;

  const [tasks, setTasks] = useState<InboxTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_KEY) as ViewMode) || "table",
  );
  const [selected, setSelected] = useState<InboxTask | null>(null);
  const [view, setView] = useState<InstanceView | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [completing, setCompleting] = useState(false);

  const setViewMode = (m: ViewMode) => {
    setMode(m);
    localStorage.setItem(VIEW_KEY, m);
    // Leaving table mode closes the modal; entering it closes the split preview.
    setSelected(null);
    setView(null);
  };

  const load = () => {
    if (!tenant) return;
    setLoading(true);
    getInbox(tenant)
      .then((t) => { setTasks(t); setLoading(false); })
      .catch((e: unknown) => { setError((e as { message?: string })?.message ?? "Couldn’t load the inbox."); setLoading(false); });
  };

  useEffect(load, [tenant]);

  const openTask = async (task: InboxTask) => {
    setSelected(task);
    setView(null);
    if (!tenant || !task.instanceId) return;
    setViewLoading(true);
    try {
      setView(await getInstance(tenant, task.instanceId));
    } catch {
      /* show task without the submission */
    } finally {
      setViewLoading(false);
    }
  };

  // Outlook behaviour: auto-open the first task when entering split view.
  useEffect(() => {
    if (mode === "split" && !selected && tasks.length > 0) {
      void openTask(tasks[0]);
    }
    // openTask is stable enough here; selecting sets `selected` so this won't loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tasks, selected]);

  const complete = async () => {
    if (!tenant || !selected) return;
    setCompleting(true);
    try {
      await completeTask(tenant, selected.taskId);
      setSelected(null);
      setView(null);
      load();
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Couldn’t complete the task.");
    } finally {
      setCompleting(false);
    }
  };

  const columns = [
    col.accessor((t) => t.name ?? "Task", {
      id: "task",
      header: "Task",
      cell: (c) => <span className="font-medium text-gray-800 dark:text-gray-200">{c.getValue()}</span>,
    }),
    col.accessor((t) => t.created ?? 0, {
      id: "created",
      header: "Created",
      cell: (c) => <span className="text-gray-500 dark:text-gray-400">{fmt(c.getValue())}</span>,
    }),
    col.accessor((t) => who(t.assignee) ?? "Unassigned", {
      id: "assignee",
      header: "Assignee",
      cell: (c) => (
        <span className={c.getValue() === "Unassigned" ? "text-gray-400" : "text-gray-500 dark:text-gray-400"}>{c.getValue()}</span>
      ),
    }),
    col.display({
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { align: "right" },
      cell: (c) => (
        <button type="button" onClick={(e) => { e.stopPropagation(); void openTask(c.row.original); }} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">Review</button>
      ),
    }),
  ];

  if (!tenant) return null;

  return (
    <>
      <PageMeta title="Form Inbox | Lukeflow" description="Tasks waiting on you." />

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Form Inbox</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tasks from form submissions that are waiting to be reviewed.</p>
        </div>
        <ViewToggle mode={mode} onChange={setViewMode} />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-gray-400">Loading inbox…</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-error-500">{error}</p>
      ) : mode === "table" ? (
        <DataTable
          columns={columns}
          data={tasks}
          onRowClick={(t) => void openTask(t)}
          searchPlaceholder="Search tasks…"
          minWidth="min-w-[560px]"
          emptyMessage="Your inbox is empty — no tasks waiting."
        />
      ) : (
        <SplitInbox
          tasks={tasks}
          selected={selected}
          onSelect={(t) => void openTask(t)}
          view={view}
          viewLoading={viewLoading}
          completing={completing}
          onComplete={complete}
        />
      )}

      {/* Table mode opens each task in a modal. */}
      <Modal
        isOpen={mode === "table" && !!selected}
        onClose={() => { setSelected(null); setView(null); }}
        className="mx-4 max-h-[90vh] w-full max-w-[680px] overflow-y-auto"
      >
        {selected ? (
          <div className="p-6 sm:p-8">
            <h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">{selected.name ?? "Task"}</h2>
            <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">Review the submission, then complete the task.</p>
            <ReviewBody view={view} viewLoading={viewLoading} />
            <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
              <Button size="sm" onClick={complete} disabled={completing}>{completing ? "Completing…" : "Complete task"}</Button>
              <Button size="sm" variant="outline" onClick={() => { setSelected(null); setView(null); }}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

// ── Segmented List / Split toggle ──────────────────────────────────────────
function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const btn = (m: ViewMode, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => onChange(m)}
      aria-pressed={mode === m}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        mode === m
          ? "bg-white text-brand-600 shadow-theme-xs dark:bg-white/10 dark:text-brand-400"
          : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-800 dark:bg-white/[0.03]">
      {btn("table", "List", <LayoutList className="size-4" />)}
      {btn("split", "Split", <Columns2 className="size-4" />)}
    </div>
  );
}

// ── Outlook-style master/detail ────────────────────────────────────────────
function SplitInbox({
  tasks, selected, onSelect, view, viewLoading, completing, onComplete,
}: {
  tasks: InboxTask[];
  selected: InboxTask | null;
  onSelect: (t: InboxTask) => void;
  view: InstanceView | null;
  viewLoading: boolean;
  completing: boolean;
  onComplete: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = q
    ? tasks.filter((t) => `${t.name ?? ""} ${who(t.assignee) ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : tasks;

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      {/* List pane */}
      <div className="flex max-h-[72vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 p-3 dark:border-gray-800">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks…"
            className="h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:text-white/90 dark:placeholder:text-white/30"
          />
        </div>
        <div className="divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">{tasks.length === 0 ? "Inbox empty." : "No matches."}</p>
          ) : (
            filtered.map((t) => {
              const active = selected?.taskId === t.taskId;
              return (
                <button
                  key={t.taskId}
                  type="button"
                  onClick={() => onSelect(t)}
                  className={`flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition ${
                    active ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <span className={`text-sm font-medium ${active ? "text-brand-700 dark:text-brand-300" : "text-gray-800 dark:text-gray-200"}`}>{t.name ?? "Task"}</span>
                  <span className="text-xs text-gray-400">{fmt(t.created)}</span>
                  <span className="text-xs text-gray-400">{who(t.assignee) ?? "Unassigned"}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Reading pane */}
      <div className="flex min-h-[60vh] flex-col rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {selected ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-gray-800 dark:text-white/90">{selected.name ?? "Task"}</h2>
                <p className="text-xs text-gray-400">Created {fmt(selected.created)} · {who(selected.assignee) ?? "Unassigned"}</p>
              </div>
              <Button size="sm" onClick={onComplete} disabled={completing}>{completing ? "Completing…" : "Complete task"}</Button>
            </div>
            <div className="overflow-y-auto p-6">
              <ReviewBody view={view} viewLoading={viewLoading} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/10">
              <InboxIcon className="size-6" />
            </span>
            <p className="mt-3 text-sm text-gray-400">Select a task to review its submission.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Shared submission view used by both the modal and the reading pane.
function ReviewBody({ view, viewLoading }: { view: InstanceView | null; viewLoading: boolean }) {
  if (viewLoading) return <p className="py-8 text-center text-sm text-gray-400">Loading submission…</p>;
  if (!view) return <p className="py-6 text-center text-sm text-gray-400">No linked submission to display.</p>;
  const initialValues = { ...(view.instance.prefill ?? {}), ...(view.instance.data ?? {}) };
  return <FormRenderer schema={view.schema} initialValues={initialValues} readOnly />;
}
