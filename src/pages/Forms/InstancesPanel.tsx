import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import Button from "../../components/ui/button/Button";
import DataTable from "../../components/tables/DataTable";
import { Modal } from "../../components/ui/modal";
import { listForms } from "../../lib/formsApi";
import {
  getProcessTrace,
  listInstances,
  retryProcess,
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
// A "submission" = the recipient actually submitted. CREATED/SENT/OPENED are
// pre-submission (previews, or prefilled-and-sent recipient invites awaiting a
// fill) and don't belong in the submissions list.
const SUBMISSION_STATES = new Set<InstanceState>(["SUBMITTED", "PROCESSED"]);
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

const col = createColumnHelper<FormInstance>();

// The submissions table for forms, optionally scoped to a single definition.
// When `definitionCode` is set, the Form column is dropped (it's redundant) and
// only that definition's submissions are shown.
export default function InstancesPanel({
  tenant,
  definitionCode,
}: {
  tenant: string;
  definitionCode?: string;
}) {
  const [rows, setRows] = useState<FormInstance[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [traceFor, setTraceFor] = useState<FormInstance | null>(null);
  const [showAll, setShowAll] = useState(false);

  const scoped = useMemo(
    () => (definitionCode ? rows.filter((r) => r.definitionCode === definitionCode) : rows),
    [rows, definitionCode],
  );
  const visible = useMemo(
    () => (showAll ? scoped : scoped.filter((r) => SUBMISSION_STATES.has(r.state))),
    [scoped, showAll],
  );
  const hiddenCount = scoped.length - visible.length;

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

  const columns = [
    ...(definitionCode
      ? []
      : [
          col.accessor((r) => names[r.definitionCode] ?? r.definitionCode, {
            id: "form",
            header: "Form",
            cell: (c) => (
              <span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{c.getValue()}</span>
                <span className="ml-2 font-mono text-xs text-gray-400">{c.row.original.definitionCode}·v{c.row.original.version}</span>
              </span>
            ),
          }),
        ]),
    col.accessor((r) => STATE_LABEL[r.state], {
      id: "status",
      header: "Status",
      cell: (c) => <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATE_BADGE[c.row.original.state]}`}>{c.getValue()}</span>,
    }),
    col.accessor((r) => r.submittedAt ?? r.createdAt, {
      id: "submitted",
      header: "Submitted",
      cell: (c) => <span className="text-gray-600 dark:text-gray-300">{fmt(c.getValue())}</span>,
    }),
    col.accessor((r) => (pidOf(r) ? "started" : ctxStr(r, "processStartStatus") === "FAILED" ? "failed" : ""), {
      id: "process",
      header: "Process",
      cell: (c) => processBadge(c.row.original),
    }),
    col.display({
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { align: "right" },
      cell: (c) => (
        <button type="button" onClick={() => setTraceFor(c.row.original)} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">Trace</button>
      ),
    }),
  ];

  const showAllToggle = (
    <label className="flex shrink-0 items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="size-3.5 rounded text-brand-500" />
      Show all states{!showAll && hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ""}
    </label>
  );

  if (loading) return <p className="py-10 text-center text-sm text-gray-400">Loading instances…</p>;
  if (error) return <p className="py-10 text-center text-sm text-error-500">{error}</p>;

  return (
    <>
      <DataTable
        columns={columns}
        data={visible}
        searchPlaceholder="Search submissions…"
        minWidth={definitionCode ? "min-w-[520px]" : "min-w-[720px]"}
        toolbar={showAllToggle}
        emptyMessage={showAll ? "No instances yet." : "No submissions yet."}
      />

      <Modal isOpen={!!traceFor} onClose={() => setTraceFor(null)} className="mx-4 max-h-[85vh] w-full max-w-[560px] overflow-y-auto">
        {traceFor ? <TracePanel tenant={tenant} instance={traceFor} formName={names[traceFor.definitionCode]} /> : null}
      </Modal>
    </>
  );
}

// The end-to-end story for one submission.
function TracePanel({ tenant, instance, formName }: { tenant: string; instance: FormInstance; formName?: string }) {
  const [inst, setInst] = useState<FormInstance>(instance);
  const pid = pidOf(inst);
  const [trace, setTrace] = useState<ProcessTrace | null>(null);
  const [loading, setLoading] = useState(!!pid);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryErr, setRetryErr] = useState<string | null>(null);

  useEffect(() => {
    if (!pid) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    getProcessTrace(tenant, pid)
      .then((t) => { if (active) { setTrace(t); setLoading(false); } })
      .catch((e: unknown) => { if (active) { setError((e as { message?: string })?.message ?? "Couldn’t load the trace."); setLoading(false); } });
    return () => { active = false; };
  }, [tenant, pid]);

  const submitted = inst.state === "SUBMITTED" || inst.state === "PROCESSED";
  const canRetry = !pid && submitted;

  const onRetry = async () => {
    setRetrying(true);
    setRetryErr(null);
    try {
      const r = await retryProcess(tenant, inst.id);
      const ctx: Record<string, unknown> = { ...(inst.context ?? {}) };
      ctx.processStartStatus = r.status;
      if (r.processInstanceId) ctx.processInstanceId = r.processInstanceId;
      if (r.error) ctx.processStartError = r.error; else delete ctx.processStartError;
      setTrace(null);
      setError(null);
      setInst({ ...inst, context: ctx });
    } catch (e) {
      setRetryErr((e as { message?: string })?.message ?? "Retry failed.");
    } finally {
      setRetrying(false);
    }
  };

  const steps = useMemo(() => buildSteps(inst, pid, trace, loading, error), [inst, pid, trace, loading, error]);

  return (
    <div className="p-6 sm:p-8">
      <h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">Submission trace</h2>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        {formName ?? inst.definitionCode} · <span className="font-mono text-xs">{inst.id}</span>
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
      {canRetry ? (
        <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button size="sm" onClick={onRetry} disabled={retrying}>{retrying ? "Retrying…" : "Retry process start"}</Button>
          <span className="text-xs text-gray-400">Re-fires the process and shows the exact result (or error).</span>
          {retryErr ? <span className="text-sm text-error-500">{retryErr}</span> : null}
        </div>
      ) : null}
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
