import { describe, it, expect } from "vitest";
import { solveRecipe } from "../../src/core/solve.js";
import { computeRecipe } from "../../src/core/compute.js";
import type { Recipe, Database, Ingredient, Flour, Defaults, Machine } from "../../src/core/types.js";

const flour: Flour = { id: "bread_flour", name: "Bread Flour", category: "flour", protein_pct: 12, ddt_water_absorption_pct: 62, density_g_per_cup: 130 };
const water: Ingredient = { id: "water_tap", name: "Water", category: "liquids", is_liquid: true, water_pct: 100, salt_pct: 0, sugar_pct: 0, fat_pct: 0, free_water_factor: 1, density_g_per_cup: 237 };
const salt: Ingredient = { id: "salt_table", name: "Salt", category: "salt", is_liquid: false, water_pct: 0, salt_pct: 100, sugar_pct: 0, fat_pct: 0, free_water_factor: 0, density_g_per_cup: 273 };

const defaults: Defaults = {
  default_free_water_factors_by_category: { liquids: 1, sweeteners: 0.4, fats: 0.5, fresh_fruit: 0.7, dried_fruit: 0.3, nuts_seeds: 0.2, eggs: 0.85, cheese: 0.5, vegetables: 0.7, herbs_spices: 0.5, acids_alcohols: 0.95, specialty: 0.7, flour: 0, salt: 0, yeast: 0, leavener: 0 },
  default_bake_loss_pct: 12, default_machine_id: "zojirushi_bb_pdc20",
};
const machine: Machine = { id: "zojirushi_bb_pdc20", name: "Zojirushi BB-PDC20", pan_capacity_g: 907, pan_overflow_threshold_g: 950, pan_underfill_threshold_g: 600, flour_quantity_typical_min_g: 470, flour_quantity_typical_max_g: 620, inclusion_max_fraction_of_flour: 0.3 };
const db: Database = { ingredients: [water, salt], flours: [flour], defaults, references: [], machines: [machine] };

describe("solveRecipe — mode B", () => {
  it("returns the recipe unchanged when target_loaf_g is absent", () => {
    const r: Recipe = { schema_version: "2.0", items: [{ uid: "u_flour01", ingredient_id: "bread_flour", grams: 500 }] };
    expect(solveRecipe(r, db)).toEqual(r);
  });
  it("Case 1 — all-percentage: solves grams from total target", () => {
    const r: Recipe = {
      schema_version: "2.0", target_loaf_g: 800, bake_loss_pct: 12,
      items: [
        { uid: "u_flour01", ingredient_id: "bread_flour", bakers_pct: 100 },
        { uid: "u_water01", ingredient_id: "water_tap", bakers_pct: 65 },
        { uid: "u_salt001", ingredient_id: "salt_table", bakers_pct: 2 },
      ],
    };
    const solved = solveRecipe(r, db);
    // total_mass_target = 800 / 0.88 = 909.09
    // sum_of_pcts = 167; total_flour = 909.09 * 100/167 = 544.37
    expect(solved.items[0]!.grams).toBeCloseTo(544.37, 1);
    expect(solved.items[1]!.grams).toBeCloseTo(353.84, 1);
    expect(solved.items[2]!.grams).toBeCloseTo(10.89, 1);
  });
  it("scales linearly with target_loaf_g", () => {
    const base: Recipe = { schema_version: "2.0", target_loaf_g: 800, items: [
      { uid: "u_flour01", ingredient_id: "bread_flour", bakers_pct: 100 },
      { uid: "u_water01", ingredient_id: "water_tap", bakers_pct: 65 },
    ]};
    const half: Recipe = { ...base, target_loaf_g: 400 };
    const a = solveRecipe(base, db);
    const b = solveRecipe(half, db);
    expect(a.items[0]!.grams! / b.items[0]!.grams!).toBeCloseTo(2, 5);
  });
  it("Case 2 — non-flour fixed grams: subtracts before partitioning", () => {
    const r: Recipe = {
      schema_version: "2.0", target_loaf_g: 800,
      items: [
        { uid: "u_flour01", ingredient_id: "bread_flour", bakers_pct: 100 },
        { uid: "u_water01", ingredient_id: "water_tap", bakers_pct: 65 },
        { uid: "u_salt001", ingredient_id: "salt_table", grams: 10 },
      ],
    };
    const solved = solveRecipe(r, db);
    // total_mass_target = 909.09; remaining = 899.09; sum_of_pcts (unfixed) = 165
    // total_flour = 899.09 * 100 / 165 = 544.9
    expect(solved.items[0]!.grams).toBeCloseTo(544.9, 1);
    expect(solved.items[1]!.grams).toBeCloseTo(354.18, 1);
    expect(solved.items[2]!.grams).toBe(10);
  });
  it("emits solver_overconstrained when fixed grams >= target_total_mass", () => {
    const r: Recipe = {
      schema_version: "2.0", target_loaf_g: 100,
      items: [{ uid: "u_flour01", ingredient_id: "bread_flour", bakers_pct: 100 }, { uid: "u_salt001", ingredient_id: "salt_table", grams: 200 }],
    };
    const c = computeRecipe(r, db);
    expect(c.warnings.find((w) => w.code === "solver_overconstrained")).toBeDefined();
  });
  it("emits solver_ambiguous_flour when flour fixed grams + non-flour bakers_pct mixed", () => {
    const r: Recipe = {
      schema_version: "2.0", target_loaf_g: 800,
      items: [{ uid: "u_flour01", ingredient_id: "bread_flour", grams: 200 }, { uid: "u_water01", ingredient_id: "water_tap", bakers_pct: 65 }],
    };
    const c = computeRecipe(r, db);
    expect(c.warnings.find((w) => w.code === "solver_ambiguous_flour")).toBeDefined();
  });
  it("emits target_loaf_g_ignored_no_pcts when no item has bakers_pct", () => {
    const r: Recipe = {
      schema_version: "2.0", target_loaf_g: 800,
      items: [{ uid: "u_flour01", ingredient_id: "bread_flour", grams: 500 }, { uid: "u_water01", ingredient_id: "water_tap", grams: 300 }],
    };
    const c = computeRecipe(r, db);
    expect(c.warnings.find((w) => w.code === "target_loaf_g_ignored_no_pcts")).toBeDefined();
  });
  it("solver is idempotent: solve(solve(r)) == solve(r)", () => {
    const r: Recipe = { schema_version: "2.0", target_loaf_g: 800, items: [
      { uid: "u_flour01", ingredient_id: "bread_flour", bakers_pct: 100 },
      { uid: "u_water01", ingredient_id: "water_tap", bakers_pct: 65 },
    ]};
    const a = solveRecipe(r, db);
    const b = solveRecipe(a, db);
    expect(b).toEqual(a);
  });
});
