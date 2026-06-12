import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import Button from "../../components/ui/button/Button";
import { saveDraft } from "../../lib/formsApi";
import { generateSchema, type BuilderSchemaLike } from "../../lib/formAgentApi";

type Msg = { role: "you" | "ai"; text: string; error?: boolean };

const EMPTY: BuilderSchemaLike = { entities: {}, root: [] };

const SUGGESTIONS = [
  "Create a contact form with name, email and a message",
  "Add a required phone number field",
  "Add a country dropdown with USA, India and UK",
  "Make every field required",
];

/**
 * Docked chat panel (a right rail beside the builder canvas) that drives
 * luke-form-agent. It lives in the parent, above the keyed Designer, so its
 * history survives the builder remount each applied change triggers. On success
 * it saveDrafts the new schema and hands it up via onApplied(schema, title),
 * which the parent applies locally (no page reload).
 */
export default function AiAssistPanel({
  onClose,
  tenant,
  formId,
  formName,
  schema,
  onApplied,
}: {
  onClose: () => void;
  tenant: string;
  formId: string;
  formName: string;
  schema: BuilderSchemaLike | null;
  onApplied: (schema: BuilderSchemaLike, title: string) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [brain, setBrain] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, busy]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setMessages((m) => [...m, { role: "you", text: msg }]);
    setInput("");
    setBusy(true);
    try {
      const result = await generateSchema(msg, schema ?? EMPTY, formName);
      await saveDraft(tenant, formId, JSON.stringify(result.schema));
      setBrain(result.brain);
      const n = result.schema.root?.length ?? 0;
      setMessages((m) => [...m, { role: "ai", text: `Done — the form now has ${n} field${n === 1 ? "" : "s"}.` }]);
      onApplied(result.schema, result.title); // parent applies locally + remounts builder
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", error: true, text: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[520px] w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/15">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">AI assistant</h2>
          <p className="truncate text-[11px] text-gray-400">
            Describe the form — changes apply to the canvas{brain ? ` · ${brain}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI assistant"
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Log */}
      <div ref={logRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="px-1 pt-1 text-xs text-gray-400">Try one of these:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={busy}
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "you"
                  ? "ml-auto bg-brand-500 text-white"
                  : m.error
                    ? "bg-error-50 text-error-600 ring-1 ring-error-200 dark:bg-error-500/10"
                    : "bg-gray-50 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700"
              }`}
            >
              {m.error ? `⚠ ${m.text}` : m.text}
            </div>
          ))
        )}
        {busy && (
          <div className="w-fit rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-400 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
            Thinking…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-100 p-3 dark:border-gray-800">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={2}
            placeholder="e.g. add a required date of birth field"
            disabled={busy}
            className="h-[58px] flex-1 resize-none rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 disabled:opacity-60 dark:border-gray-700 dark:text-white/90"
          />
          <Button size="sm" onClick={() => void send(input)} disabled={busy || !input.trim()}>
            Send
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-tight text-gray-400">
          Best for adding & editing fields. Existing tabs/tables are preserved but may move below new fields.
        </p>
      </div>
    </div>
  );
}
