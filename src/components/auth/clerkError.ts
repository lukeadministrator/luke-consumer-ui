// Clerk throws errors shaped like { errors: [{ longMessage, message }] }.
// Pull out a human-readable message, falling back to a generic one.
export function getClerkErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (err && typeof err === "object" && "errors" in err) {
    const e = err as {
      errors?: Array<{ longMessage?: string; message?: string }>;
    };
    return e.errors?.[0]?.longMessage || e.errors?.[0]?.message || fallback;
  }
  return fallback;
}
