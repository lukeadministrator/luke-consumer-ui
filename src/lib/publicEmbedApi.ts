// Client for the PUBLIC embed surface (the only unauthenticated API in the app).
// No bearer token, no tenant header — the opaque signed token in the path is the
// auth. Routed through the gateway, which forwards /api/public/** without auth.
const BASE = (import.meta.env.VITE_AUTH_API_URL || "").replace(/\/$/, "");
const seg = (s: string) => encodeURIComponent(s);

export type EmbedForm = { code: string; title: string; version: number; schema: string };

export async function getEmbedForm(token: string): Promise<EmbedForm> {
  const res = await fetch(`${BASE}/api/public/embed/${seg(token)}`);
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "This form link is invalid or no longer available."
        : `Couldn’t load the form (HTTP ${res.status}).`,
    );
  }
  return res.json();
}

export async function submitEmbed(
  token: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; instanceId: string }> {
  const res = await fetch(`${BASE}/api/public/embed/${seg(token)}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Too many submissions — please try again shortly.");
    if (res.status === 404) throw new Error("This form link is invalid or no longer available.");
    throw new Error(`Submission failed (HTTP ${res.status}).`);
  }
  return res.json();
}
