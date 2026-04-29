import { describe, it, expect } from "vitest";
import { computeWeightedDdtWa } from "../../src/core/flour.js";
import type { Flour } from "../../src/core/types.js";

const breadFlour: Flour = { id: "bread_flour", name: "Bread Flour", category: "flour", protein_pct: 12, ddt_water_absorption_pct: 62, density_g_per_cup: 130 };
const wholeWheat: Flour = { id: "whole_wheat", name: "Whole Wheat", category: "flour", protein_pct: 14, ddt_water_absorption_pct: 68, density_g_per_cup: 120 };

describe("computeWeightedDdtWa", () => {
  it("returns null when total flour grams is zero", () => {
    expect(computeWeightedDdtWa([])).toBeNull();
  });
  it("returns the only flour's value for a single-flour blend", () => {
    expect(computeWeightedDdtWa([{ flour: breadFlour, grams: 500 }])).toBeCloseTo(62, 5);
  });
  it("computes the mass-weighted average for a blend", () => {
    expect(computeWeightedDdtWa([
      { flour: breadFlour, grams: 300 },
      { flour: wholeWheat, grams: 200 },
    ])).toBeCloseTo((300 * 62 + 200 * 68) / 500, 5);
  });
  it("handles zero-gram entries by ignoring them", () => {
    expect(computeWeightedDdtWa([
      { flour: breadFlour, grams: 500 },
      { flour: wholeWheat, grams: 0 },
    ])).toBeCloseTo(62, 5);
  });
});
