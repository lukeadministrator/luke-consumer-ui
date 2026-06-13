import { Parser } from "expr-eval";

// A safe expression engine (no raw JS eval). Expressions reference form field
// values by their property key, e.g. `price * quantity` or `age >= 18`.
const parser = new Parser();

export type Scope = Record<string, unknown>;

/** Evaluate an expression against the form's values-by-key. Returns undefined on error. */
export function evaluateExpression(expr: string, scope: Scope): unknown {
  const code = expr?.trim();
  if (!code) return undefined;
  try {
    return parser.evaluate(code, scope as Record<string, number>);
  } catch {
    return undefined;
  }
}

/** Visibility / advanced-conditional: truthy shows the field. Empty = show.
 *  On error we default to SHOWING (so a typo never hides the whole form). */
export function evaluateCondition(expr: string | undefined, scope: Scope): boolean {
  if (!expr?.trim()) return true;
  const result = evaluateExpression(expr, scope);
  return result === undefined ? true : Boolean(result);
}

/** Custom validation: truthy = valid. Empty = valid. Error = valid (don't block). */
export function evaluateValidation(expr: string | undefined, scope: Scope): boolean {
  if (!expr?.trim()) return true;
  const result = evaluateExpression(expr, scope);
  return result === undefined ? true : Boolean(result);
}

/**
 * Static analysis for builder-time authoring feedback: returns an error message
 * if the expression doesn't parse, or references identifiers not in `knownKeys`
 * (so a typo'd field name surfaces instead of silently no-op'ing). Empty = ok.
 */
export function analyzeExpression(
  expr: string | undefined,
  knownKeys: ReadonlySet<string>,
): string | null {
  const code = expr?.trim();
  if (!code) return null;
  let parsed: ReturnType<Parser["parse"]>;
  try {
    parsed = parser.parse(code);
  } catch (e) {
    return `Syntax error: ${(e as Error).message}`;
  }
  let vars: string[];
  try {
    vars = parsed.variables();
  } catch {
    vars = [];
  }
  const unknown = vars.filter((v) => !knownKeys.has(v));
  if (unknown.length) {
    return `Unknown field${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`;
  }
  return null;
}
