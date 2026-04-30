// Invariant test for the Phase-4 breakdowns-vs-tree drift risk: the
// `breakdowns.{water,salt,sugar,fat}` arrays in ComputedRecipe are currently
// re-derived from `resolved[]` rather than projected from the tree leaves.
// If either path drifts (math change in compute.ts not propagated to
// buildTree, or vice versa), this test catches it: sum of breakdown
// contributions must equal the corresponding tree projection.

import { describe, it } from "vitest";
import * as fc from "fast-check";
import { computeRecipe } from "../../src/core/index.js";
import { projectByLabel } from "../../src/core/explain-tree.js";
import type { Recipe, Database } from "../../src/core/types.js";
import ingredientsFile from "../../src/data/ingredients.json" with { type: "json" };
import floursFile from "../../src/data/flours.json" with { type: "json" };
import refsFile from "../../src/data/bb_pdc20_recipes.json" with { type: "json" };
import machinesFile from "../../src/data/machines.json" with { type: "json" };
import defaultsRaw from "../../src/data/defaults.json" with { type: "json" };

/* eslint-disable @typescript-eslint/no-explicit-any */
const db: Database = {
  ingredients: (ingredientsFile as any).entries,
  flours:      (floursFile as any).entries,
  references:  (refsFile as any).entries,
  machines:    (machinesFile as any).entries,
  courses:     [],
  defaults:    defaultsRaw as any,
};

const uidArb = fc.string({ minLength: 8, maxLength: 16 })
  .filter((s) => /^[A-Za-z0-9_-]{8,16}$/.test(s));

const ingredientIds = [...db.ingredients.map((i) => i.id), ...db.flours.map((f) => f.id)];

const itemArb = fc.record({
  uid: uidArb,
  ingredient_id: fc.constantFrom(...ingredientIds),
  grams: fc.float({ min: 0, max: 1000, noNaN: true }),
});

const recipeArb = fc.record({
  schema_version: fc.constant("2.0" as const),
  items: fc.array(itemArb, { minLength: 1, maxLength: 8 })
    .filter((items) => new Set(items.map((i) => i.uid)).size === items.length),
}) as fc.Arbitrary<Recipe>;

function approxEqual(a: number, b: number, eps = 0.5): boolean {
  // Tolerance is 0.5 g — covers per-item r2() rounding (each entry rounded
  // to 0.01g; sum-of-100-items worst case is ~1.0g; 0.5g is comfortable).
  return Math.abs(a - b) <= eps;
}

describe("breakdowns ↔ tree consistency property", () => {
  it("sum of breakdowns.water[].contribution_g equals tree's total_water_g_nominal", () => {
    fc.assert(
      fc.property(recipeArb, (recipe) => {
        const c = computeRecipe(recipe, db);
        const breakdownSum = c.breakdowns.water.reduce((s, e) => s + e.contribution_g, 0);
        const treeProj = projectByLabel(c.tree, "total_water_g_nominal") ?? 0;
        return approxEqual(breakdownSum, treeProj);
      }),
      { numRuns: 200 },
    );
  });

  it("sum of breakdowns.water[].contribution_g_effective equals tree's total_water_g_effective", () => {
    fc.assert(
      fc.property(recipeArb, (recipe) => {
        const c = computeRecipe(recipe, db);
        const breakdownSum = c.breakdowns.water.reduce(
          (s, e) => s + (e.contribution_g_effective ?? 0), 0,
        );
        const treeProj = projectByLabel(c.tree, "total_water_g_effective") ?? 0;
        return approxEqual(breakdownSum, treeProj);
      }),
      { numRuns: 200 },
    );
  });

  it("sum of breakdowns.salt[].contribution_g equals tree's total_salt_g_equivalent", () => {
    fc.assert(
      fc.property(recipeArb, (recipe) => {
        const c = computeRecipe(recipe, db);
        const breakdownSum = c.breakdowns.salt.reduce((s, e) => s + e.contribution_g, 0);
        const treeProj = projectByLabel(c.tree, "total_salt_g_equivalent") ?? 0;
        return approxEqual(breakdownSum, treeProj);
      }),
      { numRuns: 200 },
    );
  });

  it("sum of breakdowns.sugar[].contribution_g equals tree's total_sugar_g_equivalent", () => {
    fc.assert(
      fc.property(recipeArb, (recipe) => {
        const c = computeRecipe(recipe, db);
        const breakdownSum = c.breakdowns.sugar.reduce((s, e) => s + e.contribution_g, 0);
        const treeProj = projectByLabel(c.tree, "total_sugar_g_equivalent") ?? 0;
        return approxEqual(breakdownSum, treeProj);
      }),
      { numRuns: 200 },
    );
  });

  it("sum of breakdowns.fat[].contribution_g equals tree's total_fat_g_equivalent", () => {
    fc.assert(
      fc.property(recipeArb, (recipe) => {
        const c = computeRecipe(recipe, db);
        const breakdownSum = c.breakdowns.fat.reduce((s, e) => s + e.contribution_g, 0);
        const treeProj = projectByLabel(c.tree, "total_fat_g_equivalent") ?? 0;
        return approxEqual(breakdownSum, treeProj);
      }),
      { numRuns: 200 },
    );
  });
});
