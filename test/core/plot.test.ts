import { describe, it, expect } from "vitest";
import { renderHydrationChart } from "../../src/core/plot.js";
import type { ComputedRecipe, BBPDC20Recipe } from "../../src/core/types.js";
import { readFileSync } from "node:fs";

const refs: BBPDC20Recipe[] = JSON.parse(readFileSync("src/data/bb_pdc20_recipes.json", "utf8")).entries;

const baseComputed: ComputedRecipe = {
  recipe: { schema_version: "2.0", name: "Test", items: [] },
  totals: { total_mass_g: 800, total_flour_g: 500, total_inclusions_g: 0,
    total_water_g_nominal: 400, total_water_g_effective: 320,
    total_salt_g_equivalent: 9, total_sugar_g_equivalent: 30,
    total_fat_g_equivalent: 28, total_alcohol_g: 0, predicted_loaf_g: 700 },
  hydration: { effective_pct: 64, nominal_pct: 80, total_liquid_pct: 80, zone: { id: "sandwich", label: "Sandwich-loaf comfort", range: [55, 67], note: "BB-PDC20 sweet spot" } },
  bakers_pcts: { by_ingredient: {}, salt_equivalent_pct: 1.8, sugar_equivalent_pct: 6, fat_equivalent_pct: 5.6, yeast_pct: 1 },
  ddt_water_absorption_pct: 62, warnings: [], water_breakdown: [], salt_breakdown: [], sugar_breakdown: [], fat_breakdown: [],
};

describe("renderHydrationChart", () => {
  it("returns SVG markup", () => {
    const svg = renderHydrationChart(baseComputed, { reference: refs });
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("</svg>");
  });
  it("contains all reference dots (excluding chart-excluded)", () => {
    const svg = renderHydrationChart(baseComputed, { reference: refs });
    const dotMatches = svg.match(/class="ref-dot"/g) ?? [];
    const expected = refs.filter((r) => !r.excluded_from_chart).length;
    expect(dotMatches.length).toBe(expected);
  });
  it("contains the user star when nominal_pct is set", () => {
    const svg = renderHydrationChart(baseComputed, { reference: refs });
    expect(svg).toContain('class="user-star"');
  });
  it("omits the user star and adds a no-flour title when nominal_pct is null", () => {
    const cNull = { ...baseComputed, hydration: { effective_pct: null, nominal_pct: null, total_liquid_pct: null, zone: null } };
    const svg = renderHydrationChart(cNull, { reference: refs });
    expect(svg).not.toContain('class="user-star"');
    expect(svg).toMatch(/no flour/i);
  });
  it("escapes injected recipe names", () => {
    const evil = { ...baseComputed, recipe: { ...baseComputed.recipe, name: "<script>alert(1)</script>" } };
    const svg = renderHydrationChart(evil, { reference: refs });
    expect(svg).not.toContain("<script>");
  });
  it("contains four zone band rects", () => {
    const svg = renderHydrationChart(baseComputed, { reference: refs });
    const bandMatches = svg.match(/class="zone-band/g) ?? [];
    expect(bandMatches.length).toBe(4);
  });
  it("contains a legend group", () => {
    const svg = renderHydrationChart(baseComputed, { reference: refs });
    expect(svg).toMatch(/<g [^>]*class="legend"/);
  });
});
