import { describe, it, expect } from "vitest";
import { runAudit, formatAudit } from "../../src/cli/format/audit.js";
import type { BBPDC20Course, Database, Defaults, Flour, Ingredient, Machine, Recipe } from "../../src/core/types.js";
import ingredientsFile from "../../src/data/ingredients.json" with { type: "json" };
import floursFile from "../../src/data/flours.json" with { type: "json" };
import coursesFile from "../../src/data/bb_pdc20_courses.json" with { type: "json" };
import machinesFile from "../../src/data/machines.json" with { type: "json" };
import defaultsRaw from "../../src/data/defaults.json" with { type: "json" };
import matrixFile from "../../src/data/bb_pdc20_recipe_matrix.json" with { type: "json" };

/* eslint-disable @typescript-eslint/no-explicit-any */
const db: Database = {
  ingredients: (ingredientsFile as any).entries as Ingredient[],
  flours:      (floursFile as any).entries as Flour[],
  references:  [],
  machines:    (machinesFile as any).entries as Machine[],
  courses:     (coursesFile as any).entries as BBPDC20Course[],
  defaults:    defaultsRaw as Defaults,
};
const matrixEntries = (matrixFile as any).entries as Array<{
  name: string; canonical_course: string; canonical_family: string[]; recipe: Recipe;
}>;
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("audit-recommendations", () => {
  it("runAudit reports 31/31 exact match on the BB-PDC20 manual matrix", () => {
    const result = runAudit(matrixEntries, db);
    expect(result.total).toBe(31);
    expect(result.exact).toBe(31);
    expect(result.mismatch).toBe(0);
  });

  it("formatAudit text output contains the exact-match line", () => {
    const result = runAudit(matrixEntries, db);
    const text = formatAudit(result, db);
    expect(text).toContain("exact:       31/31");
  });

  it("formatAudit json output is valid JSON with the expected shape", () => {
    const result = runAudit(matrixEntries, db);
    const json = formatAudit(result, db, { json: true });
    const parsed = JSON.parse(json);
    expect(parsed.total).toBe(31);
    expect(parsed.exact).toBe(31);
    expect(Array.isArray(parsed.rows)).toBe(true);
  });
});

describe("runAudit — verdict classification on synthetic fixtures", () => {
  // Synthetic 3-fixture set exercising each verdict path
  const syntheticFixtures = [
    {
      name: "Exact match fixture",
      canonical_course: "white",
      canonical_family: ["white", "rapid_white", "european"],
      recipe: {
        schema_version: "2.0" as const,
        items: [
          { uid: "u_e1", ingredient_id: "bread_flour", grams: 500 },
          { uid: "u_e2", ingredient_id: "water_tap", grams: 290 },
          { uid: "u_e3", ingredient_id: "sugar_granulated", grams: 30 },
          { uid: "u_e4", ingredient_id: "butter_unsalted", grams: 30 },
          { uid: "u_e5", ingredient_id: "salt_table", grams: 9 },
          { uid: "u_e6", ingredient_id: "yeast_instant", grams: 6 },
        ],
      },
    },
    {
      name: "Same-family fixture (claims rapid_white, engine picks white)",
      canonical_course: "rapid_white",
      canonical_family: ["white", "rapid_white", "european"],
      recipe: {
        schema_version: "2.0" as const,
        items: [
          { uid: "u_s1", ingredient_id: "bread_flour", grams: 500 },
          { uid: "u_s2", ingredient_id: "water_tap", grams: 290 },
          { uid: "u_s3", ingredient_id: "sugar_granulated", grams: 30 },
          { uid: "u_s4", ingredient_id: "butter_unsalted", grams: 30 },
          { uid: "u_s5", ingredient_id: "salt_table", grams: 9 },
          { uid: "u_s6", ingredient_id: "yeast_instant", grams: 6 },
        ],
        // No intent.time="rapid", so engine routes to white instead of rapid_white;
        // canonical_family contains both, so verdict is "same_family"
      },
    },
    {
      name: "Mismatch fixture (claims sourdough_starter, engine picks white)",
      canonical_course: "sourdough_starter",
      canonical_family: ["sourdough_starter"],
      recipe: {
        schema_version: "2.0" as const,
        items: [
          { uid: "u_m1", ingredient_id: "bread_flour", grams: 500 },
          { uid: "u_m2", ingredient_id: "water_tap", grams: 290 },
          { uid: "u_m3", ingredient_id: "sugar_granulated", grams: 30 },
          { uid: "u_m4", ingredient_id: "butter_unsalted", grams: 30 },
          { uid: "u_m5", ingredient_id: "salt_table", grams: 9 },
          { uid: "u_m6", ingredient_id: "yeast_instant", grams: 6 },
        ],
      },
    },
  ];

  it("classifies all three verdict types in one audit run", () => {
    const result = runAudit(syntheticFixtures, db);
    expect(result.exact).toBe(1);
    expect(result.same_family).toBe(1);
    expect(result.mismatch).toBe(1);
    expect(result.total).toBe(3);
  });

  it("formatAudit text output uses the right markers (✓, ~, ✗) per verdict", () => {
    const result = runAudit(syntheticFixtures, db);
    const text = formatAudit(result, db);
    expect(text).toContain("✓ Exact match fixture");
    expect(text).toContain("~ Same-family fixture (claims rapid_white, engine picks white)");
    expect(text).toContain("✗ Mismatch fixture (claims sourdough_starter, engine picks white)");
  });
});
