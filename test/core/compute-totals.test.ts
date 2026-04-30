import { describe, it, expect } from "vitest";
import { computeRecipe } from "../../src/core/compute.js";
import type { Recipe, Database, Ingredient, Flour, Defaults, Machine } from "../../src/core/types.js";

const flour: Flour = { id: "bread_flour", name: "Bread Flour", category: "flour", protein_pct: 12, ddt_water_absorption_pct: 62, density_g_per_cup: 130 };
const water: Ingredient = { id: "water_tap", name: "Water", category: "liquids", is_liquid: true, water_pct: 100, salt_pct: 0, sugar_pct: 0, fat_pct: 0, free_water_factor: 1, density_g_per_cup: 237 };
const salt: Ingredient = { id: "salt_table", name: "Salt", category: "salt", is_liquid: false, water_pct: 0, salt_pct: 100, sugar_pct: 0, fat_pct: 0, free_water_factor: 0, density_g_per_cup: 273 };
const yeast: Ingredient = { id: "yeast_instant", name: "Instant Yeast", category: "yeast", is_liquid: false, water_pct: 0, salt_pct: 0, sugar_pct: 0, fat_pct: 0, free_water_factor: 0, density_g_per_cup: 192 };

const defaults: Defaults = {
  default_free_water_factors_by_category: {
    liquids: 1, sweeteners: 0.4, fats: 0.5, fresh_fruit: 0.7, dried_fruit: 0.3,
    nuts_seeds: 0.2, eggs: 0.85, cheese: 0.5, vegetables: 0.7, herbs_spices: 0.5,
    acids_alcohols: 0.95, specialty: 0.7, flour: 0, grain_cereal: 0.3, salt: 0, yeast: 0, leavener: 0,
  },
  default_bake_loss_pct: 12,
  default_machine_id: "zojirushi_bb_pdc20",
};
const machine: Machine = {
  id: "zojirushi_bb_pdc20", name: "Zojirushi BB-PDC20",
  pan_capacity_g: 907, pan_overflow_threshold_g: 950, pan_underfill_threshold_g: 600,
  flour_quantity_typical_min_g: 470, flour_quantity_typical_max_g: 620,
  inclusion_max_fraction_of_flour: 0.30,
};
const db: Database = { ingredients: [water, salt, yeast], flours: [flour], defaults, references: [], machines: [machine], courses: [] };

describe("computeRecipe — totals", () => {
  it("computes total_mass_g as sum of all grams", () => {
    const r: Recipe = {
      schema_version: "2.0", items: [
        { uid: "u_flour01", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_water01", ingredient_id: "water_tap", grams: 320 },
        { uid: "u_salt001", ingredient_id: "salt_table", grams: 9 },
        { uid: "u_yeast01", ingredient_id: "yeast_instant", grams: 5 },
      ],
    };
    const c = computeRecipe(r, db);
    expect(c.metrics.total_mass_g).toBeCloseTo(834, 5);
  });
  it("computes total_flour_g from items with role=flour", () => {
    const r: Recipe = { schema_version: "2.0", items: [{ uid: "u_flour01", ingredient_id: "bread_flour", grams: 500 }, { uid: "u_water01", ingredient_id: "water_tap", grams: 320 }] };
    expect(computeRecipe(r, db).metrics.total_flour_g).toBe(500);
  });
  it("computes predicted_loaf_g with default 12% bake loss", () => {
    const r: Recipe = { schema_version: "2.0", items: [{ uid: "u_flour01", ingredient_id: "bread_flour", grams: 500 }, { uid: "u_water01", ingredient_id: "water_tap", grams: 320 }] };
    expect(computeRecipe(r, db).metrics.predicted_loaf_g).toBeCloseTo(820 * 0.88, 5);
  });
  it("honors a custom bake_loss_pct", () => {
    const r: Recipe = { schema_version: "2.0", bake_loss_pct: 10, items: [{ uid: "u_flour01", ingredient_id: "bread_flour", grams: 500 }, { uid: "u_water01", ingredient_id: "water_tap", grams: 300 }] };
    expect(computeRecipe(r, db).metrics.predicted_loaf_g).toBeCloseTo(800 * 0.90, 5);
  });
});
