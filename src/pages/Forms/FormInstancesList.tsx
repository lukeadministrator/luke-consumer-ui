import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { Modal } from "../../components/ui/modal";
import { useAuth } from "../../context/AuthContext";
import { listForms } from "../../lib/formsApi";
import {
  getProcessTrace,
  listInstances,
  STATE_LABEL,
  type FormInstance,
  type InstanceState,
  type ProcessTrace,
} from "../../lib/formInstancesApi";

const STATE_BADGE: Record<InstanceState, string> = {
  CREATED: "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400",
  SENT: "bg-blue-50 text-blue-600 dark:bg-blue-500/15",
  OPENED: "bg-blue-50 text-blue-600 dark:bg-blue-500/15",
  IN_PROGRESS: "bg-amber-50 text-amber-600 dark:bg-amber-500/15",
  SUBMITTED: "bg-success-50 text-success-600 dark:bg-success-500/15",
  PROCESSED: "bg-success-50 text-success-600 dark:bg-success-500/15",
  EXPIRED: "bg-gray-100 text-gray-400 dark:bg-white/10",
  CANCELLED: "bg-error-50 text-error-500 dark:bg-error-500/15",
};
const fmt = (ms?: number) => (ms ? new Date(ms).toLocaleString() : "—");
const ctxStr = (i: FormInstance, k: string): string | null => {
  const v = i.context?.[k];
  return typeof v === "string" && v ? v : null;
};
const pidOf = (i: FormInstance) => ctxStr(i, "processInstanceId");

function processBadge(i: FormInstance) {
  if (pidOf(i)) return <span className="inline-flex items-center gap-1 text-xs text-success-600"><span className="size-1.5 rounded-full bg-success-500" />started</span>;
  if (ctxStr(i, "processStartStatus") === "FAILED") return <span className="inline-flex items-center gap-1 text-xs text-error-500"><span className="size-1.5 rounded-full bg-error-500" />failed</span>;
  return <span className="text-xs text-gray-400">—</span>;
}

export default function FormInstancesList() {
  const { session } = useAuth();
  const tenant = session?.tenant ?? null;

  const [rows, setRows] = useState<FormInstance[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [traceFor, setTraceFor] = useState<FormInstance | null>(null);

  useEffect(() => {
    if (!tenant) return;
    let active = true;
    setLoading(true);
    Promise.all([listInstances(tenant), listForms(tenant)])
      .then(([insts, forms]) => {
        if (!active) return;
        setRows(insts);
        setNames(Object.fromEntries(forms.map((f) => [f.code, f.name])));
        setLoading(false);
      })
      .catch((e: unknown) => { if (active) { setError((e as { message?: string })?.message ?? "Couldn’t load instances."); setLoading(false); } });
    return () => { active = false; };
  }, [tenant]);

  if (!tenant) return null;

  return (
    <>
      <PageMeta title="Form Instances | Lukeflow" description="Form submissions and their processes." />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-white/90">Form Instances</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Every submission across your forms, and what happened to it.</p>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">Loading instances…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-error-500">{error}</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
                  <th className="py-2 pr-4 font-medium">Form</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Submitted</th>
                  <th className="py-2 pr-4 font-medium">Process</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0 dark:border-gray-800/60">
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{names[r.definitionCode] ?? r.definitionCode}</span>
                      <span className="ml-2 font-mono text-xs text-gray-400">{r.definitionCode}·v{r.version}</span>
                    </td>
                    <td className="py-2.5 pr-4"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATE_BADGE[r.state]}`}>{STATE_LABEL[r.state]}</span></td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{fmt(r.submittedAt ?? r.createdAt)}</td>
                    <td className="py-2.5 pr-4">{processBadge(r)}</td>
                    <td className="py-2.5 text-right">
                      <button type="button" onClick={() => setTraceFor(r)} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">Trace</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={!!traceFor} onClose={() => setTraceFor(null)} className="mx-4 max-h-[85vh] w-full max-w-[560px] overflow-y-auto">
        {traceFor ? <TracePanel tenant={tenant} instance={traceFor} formName={names[traceFor.definitionCode]} /> : null}
      </Modal>
    </>
  );
}

// The end-to-end story for one submission.
function TracePanel({ tenant, instance, formName }: { tenant: string; instance: FormInstance; formName?: string }) {
  const pid = pidOf(instance);
  const [trace, setTrace] = useState<ProcessTrace | null>(null);
  const [loading, setLoading] = useState(!!pid);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pid) return;
    let active = true;
    setLoading(true);
    getProcessTrace(tenant, pid)
      .then((t) => { if (active) { setTrace(t); setLoading(false); } })
      .catch((e: unknown) => { if (active) { setError((e as { message?: string })?.message ?? "Couldn’t load the trace."); setLoading(false); } });
    return () => { active = false; };
  }, [tenant, pid]);

  const steps = useMemo(() => buildSteps(instance, pid, trace, loading, error), [instance, pid, trace, loading, error]);

  return (
    <div className="p-6 sm:p-8">
      <h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">Submission trace</h2>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        {formName ?? instance.definitionCode} · <span className="font-mono text-xs">{instance.id}</span>
      </p>
      <ol className="relative space-y-5 border-l border-gray-200 pl-6 dark:border-gray-700">
        {steps.map((s, i) => (
          <li key={i} className="relative">
            <span className={`absolute -left-[27px] flex size-4 items-center justify-center rounded-full ring-4 ring-white dark:ring-gray-900 ${s.dot}`} />
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{s.title}</p>
            {s.detail ? <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{s.detail}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

type Step = { title: string; detail?: string; dot: string };
const DOT_DONE = "bg-success-500";
const DOT_ACTIVE = "bg-brand-500";
const DOT_IDLE = "bg-gray-300 dark:bg-gray-600";
const DOT_WARN = "bg-amber-400";
const DOT_ERROR = "bg-error-500";

function buildSteps(instance: FormInstance, pid: string | null, trace: ProcessTrace | null, loading: boolean, error: string | null): Step[] {
  const steps: Step[] = [];
  const submitted = instance.state === "SUBMITTED" || instance.state === "PROCESSED";

  // 1. Submission
  steps.push({
    title: submitted ? "Submitted" : `Status: ${STATE_LABEL[instance.state]}`,
    detail: submitted ? new Date(instance.submittedAt ?? instance.createdAt).toLocaleString() : "Not submitted yet — no process is started until submission.",
    dot: submitted ? DOT_DONE : DOT_IDLE,
  });

  // 2. Process-start outcome (recorded by capability-engine on the instance).
  const startStatus = ctxStr(instance, "processStartStatus");
  const startError = ctxStr(instance, "processStartError");

  if (pid) {
    steps.push({ title: "Process started", detail: `Instance ${pid}`, dot: DOT_DONE });
  } else if (startStatus === "FAILED") {
    steps.push({ title: "Process start failed", detail: startError ?? "The start call to the engine failed.", dot: DOT_ERROR });
    return steps; // nothing to trace — it never started
  } else {
    steps.push({
      title: "No process started",
      detail: submitted
        ? "Best-effort — the start may have been skipped (engine not configured for process start). Retryable."
        : "A process starts only once the form is submitted.",
      dot: submitted ? DOT_WARN : DOT_IDLE,
    });
    return steps;
  }

  // 3. Live process trace
  if (loading) { steps.push({ title: "Checking the process…", dot: DOT_ACTIVE }); return steps; }
  if (error) { steps.push({ title: "Couldn’t read the process", detail: error, dot: DOT_WARN }); return steps; }
  if (!trace || !trace.found) { steps.push({ title: "Process not found", detail: "It may have completed and been cleaned up.", dot: DOT_IDLE }); return steps; }

  // Incidents — the process hit an error inside the engine.
  if (trace.hasIncident && trace.incidents?.length) {
    for (const inc of trace.incidents) {
      steps.push({ title: `Incident: ${inc.type ?? "error"}`, detail: inc.message ?? undefined, dot: DOT_ERROR });
    }
  }

  if (trace.landedInUserTask && trace.activeTasks?.length) {
    for (const t of trace.activeTasks) {
      const who = t.assignee
        ? `assigned to ${t.assignee.replace(/^workos:/, "")}`
        : t.candidateGroups.length
          ? `candidate group: ${t.candidateGroups.join(", ")}`
          : "unassigned — anyone with access can pick it up";
      steps.push({ title: `Waiting in user task: ${t.name ?? "task"}`, detail: who, dot: DOT_ACTIVE });
    }
    return steps;
  }

  if (trace.ended || trace.state === "COMPLETED") {
    steps.push({ title: "Process completed", detail: trace.endTime ? new Date(trace.endTime).toLocaleString() : undefined, dot: DOT_DONE });
  } else {
    steps.push({ title: "Process running", detail: "No open user task right now.", dot: DOT_ACTIVE });
  }
  return steps;
}
