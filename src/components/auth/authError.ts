import { ApiError } from "../../lib/authApi";

// Pull a human-readable message from an auth API error, with a fallback.
export function getAuthErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
