import { describe, it, expect } from "vitest";
import { analyzeExpression, evaluateExpression, evaluateCondition } from "./expression";

const known = new Set(["price", "quantity", "value", "age"]);

describe("analyzeExpression", () => {
  it("accepts empty/undefined as ok", () => {
    expect(analyzeExpression("", known)).toBeNull();
    expect(analyzeExpression(undefined, known)).toBeNull();
    expect(analyzeExpression("   ", known)).toBeNull();
  });
  it("accepts valid expressions referencing known fields", () => {
    expect(analyzeExpression("price * quantity", known)).toBeNull();
    expect(analyzeExpression("age >= 18", known)).toBeNull();
    expect(analyzeExpression("value > 0", known)).toBeNull();
  });
  it("flags syntax errors", () => {
    expect(analyzeExpression("price *", known)).toMatch(/syntax/i);
    expect(analyzeExpression("(a + ", known)).toMatch(/syntax/i);
  });
  it("flags references to unknown fields", () => {
    const err = analyzeExpression("price * qty", known);
    expect(err).toMatch(/unknown field/i);
    expect(err).toMatch(/qty/);
  });
  it("lists multiple unknown fields", () => {
    const err = analyzeExpression("foo + bar", known);
    expect(err).toMatch(/fields/i);
  });
});

describe("evaluate* sanity (unchanged behavior)", () => {
  it("evaluates arithmetic against scope", () => {
    expect(evaluateExpression("price * quantity", { price: 3, quantity: 4 })).toBe(12);
  });
  it("defaults to showing on a bad condition", () => {
    expect(evaluateCondition("nonsense (", { a: 1 })).toBe(true);
    expect(evaluateCondition("", {})).toBe(true);
  });
});
