import { describe, it, expect } from "vitest";
import {
  isValidKey,
  isAutoKey,
  sanitizeKey,
  toCamelKey,
  camelCaseKeys,
  uniqueKey,
  keyOf,
  duplicateKeyIds,
  normalizeKeys,
  validateSchema,
  hasBlockingProblems,
  repairSchema,
  type FormSchema,
} from "./formSchema";

// Tiny builders to keep fixtures readable.
const field = (key: string | undefined, extra: Record<string, unknown> = {}) => ({
  type: "textField",
  attributes: { label: "Field", ...(key !== undefined ? { key } : {}), ...extra },
});
const layout = (children: string[]) => ({ type: "panel", attributes: {}, children });

describe("isValidKey", () => {
  it("accepts identifier-safe names", () => {
    expect(isValidKey("email")).toBe(true);
    expect(isValidKey("emailAddress")).toBe(true);
    expect(isValidKey("_private")).toBe(true);
    expect(isValidKey("field2")).toBe(true);
  });
  it("rejects spaces, leading digits, punctuation, and reserved words", () => {
    expect(isValidKey("first name")).toBe(false);
    expect(isValidKey("2cool")).toBe(false);
    expect(isValidKey("price-total")).toBe(false);
    expect(isValidKey("")).toBe(false);
    expect(isValidKey("true")).toBe(false);
    expect(isValidKey(42)).toBe(false);
  });
});

describe("sanitizeKey", () => {
  it("preserves already-valid keys verbatim", () => {
    expect(sanitizeKey("emailAddress")).toBe("emailAddress");
    expect(sanitizeKey("_x")).toBe("_x");
  });
  it("camelCases human labels", () => {
    expect(sanitizeKey("First Name")).toBe("firstName");
    expect(sanitizeKey("Total $ Amount")).toBe("totalAmount");
  });
  it("prefixes leading-digit results so they're valid", () => {
    expect(isValidKey(sanitizeKey("123 go"))).toBe(true);
  });
  it("falls back to 'field' for empty/garbage input", () => {
    expect(sanitizeKey("")).toBe("field");
    expect(sanitizeKey("!!!")).toBe("field");
    expect(sanitizeKey(null)).toBe("field");
  });
  it("escapes reserved words", () => {
    expect(sanitizeKey("true")).toBe("trueField");
  });
});

describe("toCamelKey", () => {
  it("collapses snake_case to camelCase", () => {
    expect(toCamelKey("first_name")).toBe("firstName");
    expect(toCamelKey("phone_number")).toBe("phoneNumber");
  });
  it("collapses Title Case to camelCase", () => {
    expect(toCamelKey("First Name")).toBe("firstName");
  });
  it("is idempotent on already-camelCase", () => {
    expect(toCamelKey("firstName")).toBe("firstName");
    expect(toCamelKey(toCamelKey("first_name"))).toBe("firstName");
  });
  it("stays a valid identifier for digits/empty", () => {
    expect(isValidKey(toCamelKey("123 go"))).toBe(true);
    expect(toCamelKey("")).toBe("field");
  });
});

describe("camelCaseKeys", () => {
  it("camelCases snake_case keys", () => {
    const schema: FormSchema = {
      entities: { a: field("first_name", { label: "First Name" }), b: field("last_name", { label: "Last Name" }) },
      root: ["a", "b"],
    };
    const out = camelCaseKeys(schema);
    expect(out.entities.a.attributes.key).toBe("firstName");
    expect(out.entities.b.attributes.key).toBe("lastName");
  });
  it("keeps keys unique when labels collide", () => {
    const schema: FormSchema = {
      entities: { a: field("first_name", { label: "First Name" }), b: field("firstname", { label: "First Name" }) },
      root: ["a", "b"],
    };
    const out = camelCaseKeys(schema);
    expect(out.entities.a.attributes.key).toBe("firstName");
    expect(out.entities.b.attributes.key).toBe("firstName1");
    expect(duplicateKeyIds(out).size).toBe(0);
  });
  it("rewrites references in expressions, conditional.when and logic", () => {
    const schema: FormSchema = {
      entities: {
        a: field("first_name", { label: "First Name" }),
        b: field("total_due", {
          label: "Total Due",
          calculateValue: "first_name + 1",
          conditional: { show: true, when: "first_name", eq: "x" },
          logic: [{ when: "first_name == 'a'", action: "show", value: "first_name" }],
        }),
      },
      root: ["a", "b"],
    };
    const out = camelCaseKeys(schema);
    const b = out.entities.b.attributes;
    expect(b.calculateValue).toBe("firstName + 1");
    expect((b.conditional as { when: string }).when).toBe("firstName");
    expect((b.logic as Array<{ when: string; value: string }>)[0].when).toBe("firstName == 'a'");
    expect((b.logic as Array<{ when: string; value: string }>)[0].value).toBe("firstName");
  });
  it("does not mutate the input and is idempotent", () => {
    const schema: FormSchema = { entities: { a: field("first_name", { label: "First Name" }) }, root: ["a"] };
    const out = camelCaseKeys(schema);
    expect(schema.entities.a.attributes.key).toBe("first_name");
    expect(camelCaseKeys(out)).toEqual(out);
  });
});

describe("uniqueKey", () => {
  it("returns the base when free", () => {
    expect(uniqueKey("email", new Set())).toBe("email");
  });
  it("suffixes incrementally on collision, starting at 1", () => {
    expect(uniqueKey("email", new Set(["email"]))).toBe("email1");
    expect(uniqueKey("email", new Set(["email", "email1"]))).toBe("email2");
  });
});

describe("isAutoKey", () => {
  it("treats the label base and base+digits as auto", () => {
    expect(isAutoKey("firstName", "First Name")).toBe(true);
    expect(isAutoKey("firstName1", "First Name")).toBe(true);
    expect(isAutoKey("firstName12", "First Name")).toBe(true);
  });
  it("treats a diverged key as a manual override", () => {
    expect(isAutoKey("applicantName", "First Name")).toBe(false);
    expect(isAutoKey("firstNameX", "First Name")).toBe(false);
    expect(isAutoKey("first_name", "First Name")).toBe(false);
  });
  it("treats an empty key as auto", () => {
    expect(isAutoKey("", "First Name")).toBe(true);
  });
});

describe("duplicateKeyIds", () => {
  it("flags later fields that reuse an earlier key", () => {
    const schema: FormSchema = {
      entities: { a: field("email"), b: field("email"), c: field("name") },
      root: ["a", "b", "c"],
    };
    const dupes = duplicateKeyIds(schema);
    expect(dupes.has("b")).toBe(true);
    expect(dupes.has("a")).toBe(false);
    expect(dupes.has("c")).toBe(false);
  });
  it("detects collisions across nested containers", () => {
    const schema: FormSchema = {
      entities: { p: layout(["x"]), x: field("email"), y: field("email") },
      root: ["p", "y"],
    };
    expect(duplicateKeyIds(schema).size).toBe(1);
  });
});

describe("normalizeKeys", () => {
  it("preserves valid unique keys and dedupes collisions", () => {
    const schema: FormSchema = {
      entities: { a: field("email"), b: field("email"), c: field("first name") },
      root: ["a", "b", "c"],
    };
    const out = normalizeKeys(schema);
    expect(out.entities.a.attributes.key).toBe("email");
    expect(out.entities.b.attributes.key).toBe("email1");
    expect(out.entities.c.attributes.key).toBe("firstName");
    expect(duplicateKeyIds(out).size).toBe(0);
  });
  it("does not mutate the input", () => {
    const schema: FormSchema = { entities: { a: field("first name") }, root: ["a"] };
    normalizeKeys(schema);
    expect(schema.entities.a.attributes.key).toBe("first name");
  });
  it("is idempotent", () => {
    const schema: FormSchema = {
      entities: { a: field("email"), b: field("email"), c: field("email") },
      root: ["a", "b", "c"],
    };
    const once = normalizeKeys(schema);
    const twice = normalizeKeys(once);
    expect(twice).toEqual(once);
  });
  it("leaves layout/static (unkeyed) entities alone", () => {
    const schema: FormSchema = { entities: { p: layout(["a"]), a: field("email") }, root: ["p"] };
    const out = normalizeKeys(schema);
    expect(out.entities.p.attributes.key).toBeUndefined();
  });
  it("derives a key from the label when missing", () => {
    const schema: FormSchema = { entities: { a: field("", { label: "Phone Number" }) }, root: ["a"] };
    // empty-string key present → treated as keyed, sanitized from label
    expect(keyOf("a", normalizeKeys(schema).entities.a)).toBe("phoneNumber");
  });
});

describe("validateSchema", () => {
  it("returns no problems for a clean schema", () => {
    const schema: FormSchema = { entities: { a: field("email"), b: field("name") }, root: ["a", "b"] };
    expect(validateSchema(schema)).toEqual([]);
    expect(hasBlockingProblems(schema)).toBe(false);
  });
  it("flags malformed input", () => {
    expect(validateSchema(null)[0].code).toBe("malformed-schema");
    expect(validateSchema({} as FormSchema)[0].code).toBe("malformed-schema");
  });
  it("flags dangling root and child references", () => {
    const schema: FormSchema = { entities: { p: layout(["ghost"]) }, root: ["p", "missing"] };
    const codes = validateSchema(schema).map((p) => p.code);
    expect(codes).toContain("dangling-root");
    expect(codes).toContain("dangling-child");
  });
  it("flags duplicate and invalid keys as errors", () => {
    const schema: FormSchema = {
      entities: { a: field("email"), b: field("email"), c: field("bad key") },
      root: ["a", "b", "c"],
    };
    const problems = validateSchema(schema);
    expect(problems.some((p) => p.code === "duplicate-key" && p.entityId === "b")).toBe(true);
    expect(problems.some((p) => p.code === "invalid-key" && p.entityId === "c")).toBe(true);
    expect(hasBlockingProblems(schema)).toBe(true);
  });
  it("detects container cycles without infinite-looping", () => {
    const schema: FormSchema = {
      entities: { a: { type: "panel", attributes: {}, children: ["b"] }, b: { type: "panel", attributes: {}, children: ["a"] } },
      root: ["a"],
    };
    expect(validateSchema(schema).some((p) => p.code === "cycle")).toBe(true);
  });
  it("warns about orphaned entities", () => {
    const schema: FormSchema = { entities: { a: field("email"), b: field("name") }, root: ["a"] };
    expect(validateSchema(schema).some((p) => p.code === "orphan" && p.entityId === "b")).toBe(true);
  });
});

describe("repairSchema", () => {
  it("leaves a sound schema unchanged and produces no problems", () => {
    const schema: FormSchema = { entities: { p: layout(["a"]), a: field("email") }, root: ["p"] };
    const { schema: out, removed } = repairSchema(schema);
    expect(removed).toEqual([]);
    expect(validateSchema(out)).toEqual([]);
    expect(out.entities.a.parentId).toBe("p");
    expect(out.entities.p.parentId).toBeUndefined();
  });
  it("drops dangling root and child references", () => {
    const schema: FormSchema = { entities: { p: layout(["a", "ghost"]), a: field("email") }, root: ["p", "missing"] };
    const { schema: out } = repairSchema(schema);
    expect(out.root).toEqual(["p"]);
    expect(out.entities.p.children).toEqual(["a"]);
  });
  it("breaks container cycles and yields a valid schema", () => {
    const schema: FormSchema = {
      entities: { a: { type: "panel", attributes: {}, children: ["b"] }, b: { type: "panel", attributes: {}, children: ["a"] } },
      root: ["a"],
    };
    const { schema: out } = repairSchema(schema);
    expect(validateSchema(out).some((p) => p.code === "cycle")).toBe(false);
  });
  it("removes unreachable entities and reports them", () => {
    const schema: FormSchema = { entities: { a: field("email"), b: field("orphan") }, root: ["a"] };
    const { schema: out, removed } = repairSchema(schema);
    expect(removed).toEqual(["b"]);
    expect(out.entities.b).toBeUndefined();
  });
  it("severs a child claimed by two parents (single-parent invariant)", () => {
    const schema: FormSchema = {
      entities: { p1: layout(["x"]), p2: layout(["x"]), x: field("email") },
      root: ["p1", "p2"],
    };
    const { schema: out } = repairSchema(schema);
    const owners = [out.entities.p1.children ?? [], out.entities.p2.children ?? []].filter((c) => c.includes("x"));
    expect(owners.length).toBe(1);
    expect(validateSchema(out)).toEqual([]);
  });
  it("does not mutate the input", () => {
    const schema: FormSchema = { entities: { p: layout(["a", "ghost"]), a: field("email") }, root: ["p"] };
    repairSchema(schema);
    expect(schema.entities.p.children).toEqual(["a", "ghost"]);
  });
});
