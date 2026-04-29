import { describe, it, expect } from "vitest";
import { validateRecipe } from "../../src/core/validate.js";
import type { Database, Defaults, Flour, Ingredient, Machine } from "../../src/core/types.js";

const flour: Flour = { id: "bread_flour", name: "Bread Flour", category: "flour", protein_pct: 12, ddt_water_absorption_pct: 62, density_g_per_cup: 130 };
const water: Ingredient = { id: "water_tap", name: "Water", category: "liquids", is_liquid: true, water_pct: 100, salt_pct: 0, sugar_pct: 0, fat_pct: 0, free_water_factor: 1, density_g_per_cup: 237 };
const defaults: Defaults = { default_free_water_factors_by_category: { liquids: 1, sweeteners: 0.4, fats: 0.5, fresh_fruit: 0.7, dried_fruit: 0.3, nuts_seeds: 0.2, eggs: 0.85, cheese: 0.5, vegetables: 0.7, herbs_spices: 0.5, acids_alcohols: 0.95, specialty: 0.7, flour: 0, salt: 0, yeast: 0, leavener: 0 }, default_bake_loss_pct: 12, default_machine_id: "zojirushi_bb_pdc20" };
const machine: Machine = { id: "zojirushi_bb_pdc20", name: "Zojirushi BB-PDC20", pan_capacity_g: 907, pan_overflow_threshold_g: 950, pan_underfill_threshold_g: 600, flour_quantity_typical_min_g: 470, flour_quantity_typical_max_g: 620, inclusion_max_fraction_of_flour: 0.3 };
const db: Database = { ingredients: [water], flours: [flour], defaults, references: [], machines: [machine] };

describe("validateRecipe", () => {
  it("accepts a minimal valid recipe", () => {
    const r = { schema_version: "2.0", items: [{ uid: "u_flour001", ingredient_id: "bread_flour", grams: 500 }] };
    expect(validateRecipe(r, db).valid).toBe(true);
  });
  it("rejects missing schema_version", () => {
    const r = { items: [{ uid: "u_flour001", ingredient_id: "bread_flour", grams: 500 }] };
    const result = validateRecipe(r, db);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "schema_violation")).toBe(true);
  });
  it("rejects unknown ingredient_id", () => {
    const r = { schema_version: "2.0", items: [{ uid: "u_flour001", ingredient_id: "doesnotexist", grams: 500 }] };
    const result = validateRecipe(r, db);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "unknown_ingredient_id")).toBe(true);
  });
  it("rejects __proto__ key (prototype-pollution defense)", () => {
    const r: any = { schema_version: "2.0", items: [{ uid: "u_flour001", ingredient_id: "bread_flour", grams: 500 }] };
    r.__proto__ = { polluted: true };
    // schema's ForbiddenKeys catches this when serialized; we test via JSON.parse roundtrip
    const tainted = JSON.parse('{"schema_version":"2.0","items":[{"uid":"u_flour001","ingredient_id":"bread_flour","grams":500}],"__proto__":{"x":1}}');
    const result = validateRecipe(tainted, db);
    expect(result.valid).toBe(false);
  });
  it("rejects mode-B item without grams or bakers_pct", () => {
    const r = { schema_version: "2.0", target_loaf_g: 800, items: [{ uid: "u_flour001", ingredient_id: "bread_flour" }] };
    const result = validateRecipe(r, db);
    expect(result.valid).toBe(false);
  });
  it("accepts schema_version 2.0 (current major); rejects 1.0", () => {
    const r1 = { schema_version: "1.0", items: [{ ingredient_id: "bread_flour", grams: 500 }] };
    const result = validateRecipe(r1, db);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path.includes("schema_version"))).toBe(true);
  });
});

describe("v2.0 uid validation", () => {
  it("emits invalid_item_uid_format for too-short uid", () => {
    const r = validateRecipe({
      schema_version: "2.0",
      items: [{ uid: "short", ingredient_id: "bread_flour", grams: 100 }],
    } as never);
    expect(r.valid).toBe(false);
    // The schema regex catches this first; we still want a meaningful code.
    expect(r.issues.some((i) =>
      i.code === "invalid_item_uid_format" || i.message.toLowerCase().includes("uid"),
    )).toBe(true);
  });

  it("emits duplicate_item_uid for repeated uid", () => {
    const r = validateRecipe({
      schema_version: "2.0",
      items: [
        { uid: "abcdefgh", ingredient_id: "bread_flour", grams: 100 },
        { uid: "abcdefgh", ingredient_id: "water_tap",   grams: 60 },
      ],
    } as never);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.code === "duplicate_item_uid")).toBe(true);
  });
});
