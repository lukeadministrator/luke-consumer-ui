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
