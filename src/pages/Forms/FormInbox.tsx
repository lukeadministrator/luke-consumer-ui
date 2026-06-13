import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import { useAuth } from "../../context/AuthContext";
import FormRenderer from "../../components/formBuilder/FormRenderer";
import { completeTask, getInbox, type InboxTask } from "../../lib/formInboxApi";
import { getInstance, type InstanceView } from "../../lib/formInstancesApi";

const fmt = (ms?: number) => (ms ? new Date(ms).toLocaleString() : "—");
const who = (a?: string | null) => (a ? a.replace(/^workos:/, "") : null);

// The reviewer's inbox: open user tasks (e.g. "Review Submission") for the
// tenant. Open one to see the submission and complete the task.
export default function FormInbox() {
  const { session } = useAuth();
  const tenant = session?.tenant ?? null;

  const [tasks, setTasks] = useState<InboxTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<InboxTask | null>(null);
  const [view, setView] = useState<InstanceView | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [completing, setCompleting] = useState(false);

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

  if (!tenant) return null;

  const initialValues = view ? { ...(view.instance.prefill ?? {}), ...(view.instance.data ?? {}) } : {};

  return (
    <>
      <PageMeta title="Form Inbox | Lukeflow" description="Tasks waiting on you." />
      <div className="mx-auto max-w-[920px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-4">
            <h1 className="text-lg font-semibold text-gray-800 dark:text-white/90">Form Inbox</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tasks from form submissions that are waiting to be reviewed.</p>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-gray-400">Loading inbox…</p>
          ) : error ? (
            <p className="py-10 text-center text-sm text-error-500">{error}</p>
          ) : tasks.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Your inbox is empty — no tasks waiting.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
                    <th className="py-2 pr-4 font-medium">Task</th>
                    <th className="py-2 pr-4 font-medium">Created</th>
                    <th className="py-2 pr-4 font-medium">Assignee</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.taskId} className="border-b border-gray-50 last:border-0 dark:border-gray-800/60">
                      <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-200">{t.name ?? "Task"}</td>
                      <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{fmt(t.created)}</td>
                      <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{who(t.assignee) ?? <span className="text-gray-400">Unassigned</span>}</td>
                      <td className="py-2.5 text-right">
                        <button type="button" onClick={() => openTask(t)} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={!!selected} onClose={() => { setSelected(null); setView(null); }} className="mx-4 max-h-[90vh] w-full max-w-[680px] overflow-y-auto">
        {selected ? (
          <div className="p-6 sm:p-8">
            <h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">{selected.name ?? "Task"}</h2>
            <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">Review the submission, then complete the task.</p>

            {viewLoading ? (
              <p className="py-8 text-center text-sm text-gray-400">Loading submission…</p>
            ) : view ? (
              <FormRenderer schema={view.schema} initialValues={initialValues} readOnly />
            ) : (
              <p className="py-6 text-center text-sm text-gray-400">No linked submission to display.</p>
            )}

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
