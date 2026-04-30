import { describe, it, expect } from "vitest";
import type { ExplainNode } from "../../src/core/index.js";
import { renderNarrative } from "../../src/site/explain-narrative.js";

const constG = (label: string, value: number): ExplainNode => ({ type: "Constant", id: `c-${label}`, label, value, unit: "g" });
const ratio = (label: string, n: ExplainNode, d: ExplainNode, value: number): ExplainNode =>
  ({ type: "Ratio", id: `r-${label}`, label, numerator: n, denominator: d, value });

describe("renderNarrative", () => {
  it("emits a Ratio node text template with two term placeholders", () => {
    const node = ratio("Hydration", constG("water", 350), constG("flour", 500), 70);
    const out = renderNarrative(node);
    // The Ratio rendering uses {{TERM:0}} ÷ {{TERM:1}} placeholders.
    expect(out.text).toContain("{{TERM:0}}");
    expect(out.text).toContain("{{TERM:1}}");
    expect(out.text).toContain("÷");
    // Two terms in the array, in numerator/denominator order.
    expect(out.terms.length).toBe(2);
    expect(out.terms[0]?.nodeId).toBe("c-water");
    expect(out.terms[1]?.nodeId).toBe("c-flour");
    // Each term's formatted value reflects its node value + Constant unit.
    expect(out.terms[0]?.formattedValue).toBe("350 g");
    expect(out.terms[1]?.formattedValue).toBe("500 g");
  });

  it("appends ' × 100 = N.N %' suffix when the Ratio's label contains a percent sign", () => {
    const pct = ratio("hydration_pct (%)", constG("water", 350), constG("flour", 500), 70);
    const out = renderNarrative(pct);
    expect(out.text).toContain("× 100");
    expect(out.text).toContain("70.0 %");
  });

  it("represents drillable terms by referencing child node ids", () => {
    const node = ratio("Hydration", constG("water", 350), constG("flour", 500), 70);
    const out = renderNarrative(node);
    expect(out.terms[0]?.nodeId).toBe("c-water");
    expect(out.terms[1]?.nodeId).toBe("c-flour");
  });

  it("emits a Sum node text with one placeholder per term and a final = value", () => {
    const node: ExplainNode = {
      type: "Sum",
      id: "s-1",
      label: "total_water",
      terms: [constG("a", 100), constG("b", 200), constG("c", 50)],
      value: 350,
    };
    const out = renderNarrative(node);
    expect(out.terms.length).toBe(3);
    expect(out.text).toContain("{{TERM:0}}");
    expect(out.text).toContain("{{TERM:2}}");
    expect(out.text).toMatch(/=\s*350/);
  });

  it("handles a Constant leaf node without crashing", () => {
    const leaf: ExplainNode = { type: "Constant", id: "c-x", label: "x", value: 42, unit: "g" };
    const out = renderNarrative(leaf);
    expect(out.text).toBeDefined();
    expect(out.terms.length).toBe(1);
    expect(out.terms[0]?.formattedValue).toBe("42 g");
  });
});
