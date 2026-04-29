import { describe, it, expect } from "vitest";
import { fixKinds } from "../../src/core/registry/fixes.js";

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
