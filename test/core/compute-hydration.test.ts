import { describe, it, expect } from "vitest";
import { computeRecipe } from "../../src/core/compute.js";
import type { Recipe, Database, Ingredient, Flour, Defaults, Machine } from "../../src/core/types.js";

const flour: Flour = { id: "bread_flour", name: "Bread Flour", category: "flour", protein_pct: 12, ddt_water_absorption_pct: 62, density_g_per_cup: 130 };
const water: Ingredient = { id: "water_tap", name: "Water", category: "liquids", is_liquid: true, water_pct: 100, salt_pct: 0, sugar_pct: 0, fat_pct: 0, free_water_factor: 1, density_g_per_cup: 237 };
const banana: Ingredient = { id: "banana_ripe", name: "Banana, ripe", category: "fresh_fruit", is_liquid: false, water_pct: 75.3, salt_pct: 0, sugar_pct: 12.2, fat_pct: 0.3, free_water_factor: 0.7, density_g_per_cup: 225 };

const defaults: Defaults = {
  default_free_water_factors_by_category: { liquids: 1, sweeteners: 0.4, fats: 0.5, fresh_fruit: 0.7, dried_fruit: 0.3, nuts_seeds: 0.2, eggs: 0.85, cheese: 0.5, vegetables: 0.7, herbs_spices: 0.5, acids_alcohols: 0.95, specialty: 0.7, flour: 0, salt: 0, yeast: 0, leavener: 0 },
  default_bake_loss_pct: 12, default_machine_id: "zojirushi_bb_pdc20",
};
const machine: Machine = { id: "zojirushi_bb_pdc20", name: "Zojirushi BB-PDC20", pan_capacity_g: 907, pan_overflow_threshold_g: 950, pan_underfill_threshold_g: 600, flour_quantity_typical_min_g: 470, flour_quantity_typical_max_g: 620, inclusion_max_fraction_of_flour: 0.3 };
const db: Database = { ingredients: [water, banana], flours: [flour], defaults, references: [], machines: [machine] };

describe("computeRecipe — hydration metrics", () => {
  it("nominal_pct counts all water from all ingredients", () => {
    const r: Recipe = { schema_version: "2.0", items: [{ uid: "u_flour01", ingredient_id: "bread_flour", grams: 500 }, { uid: "u_water01", ingredient_id: "water_tap", grams: 300 }, { uid: "u_banan01", ingredient_id: "banana_ripe", grams: 200 }] };
    const c = computeRecipe(r, db);
    // (300 + 200*0.753) / 500 * 100 = (300 + 150.6)/500*100 = 90.12
    expect(c.hydration.nominal_pct).toBeCloseTo(90.12, 2);
  });
  it("effective_pct applies free_water_factor per ingredient", () => {
    const r: Recipe = { schema_version: "2.0", items: [{ uid: "u_flour01", ingredient_id: "bread_flour", grams: 500 }, { uid: "u_water01", ingredient_id: "water_tap", grams: 300 }, { uid: "u_banan01", ingredient_id: "banana_ripe", grams: 200 }] };
    const c = computeRecipe(r, db);
    // (300*1 + 200*0.753*0.7) / 500 * 100 = (300 + 105.42)/500*100 = 81.084
    expect(c.hydration.effective_pct).toBeCloseTo(81.08, 1);
  });
  it("total_liquid_pct counts only is_liquid=true grams", () => {
    const r: Recipe = { schema_version: "2.0", items: [{ uid: "u_flour01", ingredient_id: "bread_flour", grams: 500 }, { uid: "u_water01", ingredient_id: "water_tap", grams: 300 }, { uid: "u_banan01", ingredient_id: "banana_ripe", grams: 200 }] };
    const c = computeRecipe(r, db);
    expect(c.hydration.total_liquid_pct).toBeCloseTo(60, 5);
  });
  it("nominal_pct >= effective_pct (free_water_factor <= 1)", () => {
    const r: Recipe = { schema_version: "2.0", items: [{ uid: "u_flour01", ingredient_id: "bread_flour", grams: 500 }, { uid: "u_water01", ingredient_id: "water_tap", grams: 300 }, { uid: "u_banan01", ingredient_id: "banana_ripe", grams: 200 }] };
    const c = computeRecipe(r, db);
    expect(c.hydration.nominal_pct!).toBeGreaterThanOrEqual(c.hydration.effective_pct!);
  });
  it("returns null for all hydration metrics when total_flour_g == 0", () => {
    const r: Recipe = { schema_version: "2.0", items: [{ uid: "u_water01", ingredient_id: "water_tap", grams: 300 }] };
    const c = computeRecipe(r, db);
    expect(c.hydration.effective_pct).toBeNull();
    expect(c.hydration.nominal_pct).toBeNull();
    expect(c.hydration.total_liquid_pct).toBeNull();
    expect(c.hydration.zone).toBeNull();
  });
  it("classifies zone from effective_pct", () => {
    const r: Recipe = { schema_version: "2.0", items: [{ uid: "u_flour01", ingredient_id: "bread_flour", grams: 500 }, { uid: "u_water01", ingredient_id: "water_tap", grams: 300 }] };
    expect(computeRecipe(r, db).hydration.zone?.id).toBe("sandwich"); // 60%
  });
  it("respects free_water_factor_overrides", () => {
    const r: Recipe = {
      schema_version: "2.0",
      free_water_factor_overrides: { banana_ripe: 0.5 },
      items: [{ uid: "u_flour01", ingredient_id: "bread_flour", grams: 500 }, { uid: "u_banan01", ingredient_id: "banana_ripe", grams: 200 }],
    };
    const c = computeRecipe(r, db);
    // 200 * 0.753 * 0.5 / 500 * 100 = 15.06
    expect(c.hydration.effective_pct).toBeCloseTo(15.06, 2);
  });
});
