import { describe, it, expect, beforeAll } from "vitest";
import type { ComputedRecipe } from "../../src/core/index.js";

// Force NO_COLOR so the formatter strips ANSI escapes deterministically. The
// module reads this env var at load time, so we set it before the dynamic import.
let formatComputed: typeof import("../../src/cli/format.js").formatComputed;
beforeAll(async () => {
  process.env.NO_COLOR = "1";
  ({ formatComputed } = await import("../../src/cli/format.js"));
});

function makeComputed(over: Partial<ComputedRecipe> = {}): ComputedRecipe {
  const base: ComputedRecipe = {
    recipe: { schema_version: "1.0", name: "Test Loaf", items: [] },
    totals: {
      total_mass_g: 1000, total_flour_g: 600, total_inclusions_g: 0,
      total_water_g_nominal: 360, total_water_g_effective: 354,
      total_salt_g_equivalent: 10, total_sugar_g_equivalent: 30,
      total_fat_g_equivalent: 25, total_alcohol_g: 0,
      predicted_loaf_g: 880,
    },
    hydration: { effective_pct: 59.0, nominal_pct: 60.0, total_liquid_pct: 58.5, zone: "sandwich" },
    bakers_pcts: {
      by_ingredient: {},
      salt_equivalent_pct: 1.7, sugar_equivalent_pct: 5.0, fat_equivalent_pct: 4.2, yeast_pct: 0.9,
    },
    ddt_water_absorption_pct: 62,
    warnings: [],
    water_breakdown: [], salt_breakdown: [], sugar_breakdown: [], fat_breakdown: [],
  };
  return { ...base, ...over };
}

describe("formatComputed", () => {
  it("renders headline rows in the expected order", () => {
    const out = formatComputed(makeComputed(), "effective");
    const lines = out.split("\n");
    expect(lines[0]).toBe("Test Loaf");
    expect(lines[1]).toMatch(/^Effective hydration\s+59\.0%$/);
    expect(lines[2]).toMatch(/^Nominal water\s+60\.0%$/);
    expect(lines[3]).toMatch(/^Total liquid\s+58\.5%$/);
    expect(lines[4]).toMatch(/^Zone\s+sandwich$/);
  });

  it("renders an em-dash for null hydration values and a fallback recipe name", () => {
    const c = makeComputed({
      recipe: { schema_version: "1.0", items: [] },
      hydration: { effective_pct: null, nominal_pct: null, total_liquid_pct: null, zone: null },
    });
    const out = formatComputed(c, "effective");
    expect(out).toContain("Recipe");
    expect(out).toContain("Effective hydration —");
    expect(out).toContain("Zone               —");
  });

  it("renders 'No warnings' when warnings is empty", () => {
    const out = formatComputed(makeComputed(), "effective");
    expect(out).toContain("No warnings");
    expect(out).not.toContain("Warnings\n");
  });

  it("renders each warning with severity and code under a Warnings header", () => {
    const c = makeComputed({
      warnings: [
        { severity: "warn", code: "under_developed_gluten", message: "low hydration" },
        { severity: "error", code: "pan_overflow_predicted", message: "too big" },
      ],
    });
    const out = formatComputed(c, "effective");
    expect(out).toContain("Warnings");
    expect(out).toContain("[warn] under_developed_gluten: low hydration");
    expect(out).toContain("[error] pan_overflow_predicted: too big");
    expect(out).not.toContain("No warnings");
  });

  it("includes predicted loaf weight in grams", () => {
    const out = formatComputed(makeComputed(), "effective");
    expect(out).toMatch(/Predicted loaf\s+880 g/);
  });
});
