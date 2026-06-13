import { useEffect, useState } from "react";
import { useParams } from "react-router";
import FormRenderer from "../../components/formBuilder/FormRenderer";
import { getEmbedForm, submitEmbed, type EmbedForm } from "../../lib/publicEmbedApi";

// Public, standalone page rendered inside the host's <iframe src=".../embed/:token">.
// No app chrome, no auth — the signed token is the auth. Submitting posts to the
// public webhook, which records a response (and starts a process).
export default function FormEmbed() {
  const { token } = useParams();
  const [form, setForm] = useState<EmbedForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    getEmbedForm(token)
      .then((f) => { if (active) { setForm(f); setLoading(false); } })
      .catch((e: unknown) => { if (active) { setError((e as Error).message); setLoading(false); } });
    return () => { active = false; };
  }, [token]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitEmbed(token, data);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-950">
      <div className="mx-auto max-w-[640px] rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 dark:border-gray-800 dark:bg-white/[0.03]">
        {loading ? (
          <p className="py-12 text-center text-sm text-gray-400">Loading…</p>
        ) : done ? (
          <div className="py-12 text-center">
            <p className="mb-1 text-lg font-semibold text-success-600">Submitted ✓</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Thanks — your response has been recorded.</p>
          </div>
        ) : error && !form ? (
          <p className="py-12 text-center text-sm text-error-500">{error}</p>
        ) : form ? (
          <>
            <h1 className="mb-5 text-xl font-semibold text-gray-800 dark:text-white/90">{form.title}</h1>
            {error ? <p className="mb-4 rounded-lg bg-error-50 px-4 py-2 text-sm text-error-500 dark:bg-error-500/10">{error}</p> : null}
            <FormRenderer schema={form.schema} onSubmit={handleSubmit} submitting={submitting} />
          </>
        ) : null}
      </div>
    </div>
  );
}
