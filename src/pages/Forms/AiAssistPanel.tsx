import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal } from "../../components/ui/modal";
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
 * Chat panel that drives luke-form-agent. It lives in the parent (above the
 * keyed Designer) so its history survives the builder remount that each applied
 * change triggers. On success it saveDrafts the new schema and calls onApplied()
 * to reload the builder with it.
 */
export default function AiAssistPanel({
  open,
  onClose,
  tenant,
  formId,
  formName,
  schema,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  tenant: string;
  formId: string;
  formName: string;
  schema: BuilderSchemaLike | null;
  onApplied: () => void;
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
      onApplied(); // reload + remount the builder with the new schema
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", error: true, text: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      className="mx-4 flex h-[80vh] max-h-[640px] w-full max-w-[460px] flex-col"
    >
      <div className="flex h-full flex-col p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/15">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">AI form assistant</h2>
            <p className="text-[11px] text-gray-400">
              Describe the form — changes apply to the canvas{brain ? ` · ${brain}` : ""}
            </p>
          </div>
        </div>

        <div
          ref={logRef}
          className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/[0.02]"
        >
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
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === "you"
                    ? "ml-auto bg-brand-500 text-white"
                    : m.error
                      ? "bg-error-50 text-error-600 ring-1 ring-error-200 dark:bg-error-500/10"
                      : "bg-white text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700"
                }`}
              >
                {m.error ? `⚠ ${m.text}` : m.text}
              </div>
            ))
          )}
          {busy && (
            <div className="w-fit rounded-lg bg-white px-3 py-2 text-sm text-gray-400 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
              Thinking…
            </div>
          )}
        </div>

        <div className="mt-3 flex items-end gap-2">
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
    </Modal>
  );
}
