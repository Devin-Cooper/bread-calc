import { describe, it, expect } from "vitest";
import { fixKinds, FixApplyError } from "../../src/core/registry/fixes.js";
import type { Recipe } from "../../src/core/types.js";

const baseRecipe: Recipe = {
  schema_version: "2.0",
  items: [{ uid: "u_test0001", ingredient_id: "bread_flour", grams: 100 }],
};

const EXPECTED_KINDS = [
  "set_grams", "increase_grams", "decrease_grams", "set_bakers_pct",
  "add_ingredient", "remove_ingredient", "set_field", "set_role",
] as const;

describe("fixKinds registry", () => {
  it("registers exactly 8 kinds", () => {
    const got = fixKinds.list().map((k) => k.kind).sort();
    const want = [...EXPECTED_KINDS].sort();
    expect(got).toEqual(want);
  });

  it("each entry has description, payload_schema, apply", () => {
    for (const k of fixKinds.list()) {
      expect(typeof k.description).toBe("string");
      expect(k.payload_schema).toBeTypeOf("object");
      expect(typeof k.apply).toBe("function");
    }
  });
});

describe("FixKind error ABI", () => {
  it("every kind throws FixApplyError on invalid payload", () => {
    for (const k of fixKinds.list()) {
      // construct a payload that's syntactically wrong for this kind
      const badPayload: Record<string, unknown> =
        k.kind === "set_field"        ? { field: "machine", value: 42, rationale: "x" } :   // wrong type
        k.kind === "add_ingredient"   ? { uid: "u_test0001", ingredient_id: "x", rationale: "x" } :  // duplicate uid
        k.kind === "set_role"         ? { uid: "u_missing0", role: "flour", rationale: "x" } :       // unknown uid
                                        { uid: "u_missing0", grams: 1, delta_g: 1, bakers_pct: 1, rationale: "x" };  // unknown uid
      expect(() => k.apply(baseRecipe, badPayload)).toThrow(FixApplyError);
    }
  });
});
