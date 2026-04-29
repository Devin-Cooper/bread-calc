import { describe, it, expect } from "vitest";
import { explainNodeTypes } from "../../src/core/registry/explain.js";

const EXPECTED_TYPES = [
  "Constant", "ProjectField", "Sum", "WeightedSum",
  "Product", "Ratio", "Scale", "ProjectFromTree",
] as const;

describe("explainNodeTypes registry", () => {
  it("registers exactly 8 node types matching the v2.0 spec", () => {
    const got = explainNodeTypes.list().map((t) => t.type).sort();
    const want = [...EXPECTED_TYPES].sort();
    expect(got).toEqual(want);
  });

  it("each entry has description, schema, evaluate, render", () => {
    for (const t of explainNodeTypes.list()) {
      expect(typeof t.description).toBe("string");
      expect(t.schema).toBeTypeOf("object");
      expect(typeof t.evaluate).toBe("function");
      expect(typeof t.render).toBe("function");
    }
  });

  it("Constant.evaluate returns its value verbatim", () => {
    const t = explainNodeTypes.get("Constant")!;
    expect(t.evaluate(
      { type: "Constant", id: "n", label: "pi", value: 3.14 } as never,
      { lookup: () => null },
    )).toBe(3.14);
  });

  it("Ratio.evaluate returns null on zero denominator", () => {
    const t = explainNodeTypes.get("Ratio")!;
    const node = {
      type: "Ratio", id: "n", label: "test",
      numerator:   { type: "Constant", id: "n1", label: "x", value: 5 },
      denominator: { type: "Constant", id: "n2", label: "y", value: 0 },
      value: null,
    };
    expect(t.evaluate(node as never, { lookup: () => null })).toBeNull();
  });
});
