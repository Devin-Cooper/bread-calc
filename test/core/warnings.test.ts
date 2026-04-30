import { describe, it, expect } from "vitest";
import { computeRecipe } from "../../src/core/compute.js";
import type { Recipe, Database, Ingredient, Flour, Defaults, Machine } from "../../src/core/types.js";
import type { BBPDC20Course } from "../../src/core/index.js";

function makeCourse(partial: Pick<BBPDC20Course, "id" | "course_number" | "name" | "crust_shades" | "loaf_sizes">): BBPDC20Course {
  return {
    total_minutes: 200,
    stages: [],
    bakes: true,
    inclusions_beep: true,
    dietary_modes: [],
    recommended_for: [],
    yeast_compatibility: ["instant"],
    confidence: "verified",
    sources: [],
    ...partial,
  };
}

const flour: Flour = { id: "bread_flour", name: "Bread Flour", category: "flour", protein_pct: 12, ddt_water_absorption_pct: 62, density_g_per_cup: 130 };
const water: Ingredient = { id: "water_tap", name: "Water", category: "liquids", is_liquid: true, water_pct: 100, salt_pct: 0, sugar_pct: 0, fat_pct: 0, free_water_factor: 1, density_g_per_cup: 237 };
const salt: Ingredient = { id: "salt_table", name: "Salt", category: "salt", is_liquid: false, water_pct: 0, salt_pct: 100, sugar_pct: 0, fat_pct: 0, free_water_factor: 0, density_g_per_cup: 273 };
const yeast: Ingredient = { id: "yeast_instant", name: "Instant Yeast", category: "yeast", is_liquid: false, water_pct: 0, salt_pct: 0, sugar_pct: 0, fat_pct: 0, free_water_factor: 0, density_g_per_cup: 192 };
const sugar: Ingredient = { id: "sugar_granulated", name: "Sugar", category: "sweeteners", is_liquid: false, water_pct: 0, salt_pct: 0, sugar_pct: 100, fat_pct: 0, free_water_factor: 0, density_g_per_cup: 200 };
const oil: Ingredient = { id: "oil_canola", name: "Canola Oil", category: "fats", is_liquid: false, water_pct: 0, salt_pct: 0, sugar_pct: 0, fat_pct: 100, free_water_factor: 0, density_g_per_cup: 218 };
const pineapple: Ingredient = { id: "pineapple_fresh", name: "Pineapple", category: "fresh_fruit", is_liquid: false, water_pct: 86, salt_pct: 0, sugar_pct: 10, fat_pct: 0, free_water_factor: 0.7, density_g_per_cup: 165, flags: ["enzymatic_protease"] };
const banana: Ingredient = { id: "banana_freezer_thawed", name: "Banana, frozen-thawed", category: "fresh_fruit", is_liquid: false, water_pct: 78, salt_pct: 0, sugar_pct: 14, fat_pct: 0, free_water_factor: 0.7, density_g_per_cup: 250, flags: ["late_water_release"] };
const honey: Ingredient = { id: "honey", name: "Honey", category: "sweeteners", is_liquid: false, water_pct: 17, salt_pct: 0, sugar_pct: 82, fat_pct: 0, free_water_factor: 0.4, density_g_per_cup: 339, flags: ["humectant_bound_water"] };
const beer: Ingredient = { id: "beer_stout", name: "Stout Beer", category: "acids_alcohols", is_liquid: true, water_pct: 89.3, salt_pct: 0, sugar_pct: 0, fat_pct: 0, free_water_factor: 0.95, density_g_per_cup: 240, alcohol_pct: 6 };
const feta: Ingredient = { id: "feta", name: "Feta", category: "cheese", is_liquid: false, water_pct: 55.2, salt_pct: 3.5, sugar_pct: 0, fat_pct: 21, free_water_factor: 0.5, density_g_per_cup: 150, flags: ["high_salt"] };
const xanthan: Ingredient = { id: "xanthan_gum", name: "Xanthan Gum", category: "specialty", is_liquid: false, water_pct: 10, salt_pct: 0, sugar_pct: 0, fat_pct: 0, free_water_factor: 0.5, density_g_per_cup: 100, flags: ["gf_stabilizer"] };
const vwg: Ingredient = { id: "vital_wheat_gluten", name: "Vital Wheat Gluten", category: "specialty", is_liquid: false, water_pct: 7, salt_pct: 0, sugar_pct: 0, fat_pct: 1.9, free_water_factor: 0.4, density_g_per_cup: 145, flags: ["gluten_strengthener"] };

const defaults: Defaults = {
  default_free_water_factors_by_category: { liquids: 1, sweeteners: 0.4, fats: 0.5, fresh_fruit: 0.7, dried_fruit: 0.3, nuts_seeds: 0.2, eggs: 0.85, cheese: 0.5, vegetables: 0.7, herbs_spices: 0.5, acids_alcohols: 0.95, specialty: 0.7, flour: 0, salt: 0, yeast: 0, leavener: 0 },
  default_bake_loss_pct: 12, default_machine_id: "zojirushi_bb_pdc20",
};
const machine: Machine = { id: "zojirushi_bb_pdc20", name: "Zojirushi BB-PDC20", pan_capacity_g: 907, pan_overflow_threshold_g: 950, pan_underfill_threshold_g: 600, flour_quantity_typical_min_g: 470, flour_quantity_typical_max_g: 620, inclusion_max_fraction_of_flour: 0.3 };
const db: Database = { ingredients: [water, salt, yeast, sugar, oil, pineapple, banana, honey, beer, feta, xanthan, vwg], flours: [flour], defaults, references: [], machines: [machine], courses: [] };

let _uidCounter = 0;
function uid(): string {
  return `u_warn${(++_uidCounter).toString().padStart(4, "0")}`;
}

function recipeOf(items: Recipe["items"], extra: Partial<Recipe> = {}): Recipe {
  return { schema_version: "2.0", machine: "zojirushi_bb_pdc20", items, ...extra };
}

describe("warnings", () => {
  it("emits no_flour when total_flour_g == 0", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "water_tap", grams: 300 }]), db);
    const codes = c.warnings.map((w) => w.code);
    expect(codes).toContain("no_flour");
    // no_flour warning must have suggested_fixes array (non-optional)
    const nf = c.warnings.find((w) => w.code === "no_flour")!;
    expect(Array.isArray(nf.suggested_fixes)).toBe(true);
  });
  it("emits pan_overflow_predicted when predicted_loaf_g > 950", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 800 }, { uid: uid(), ingredient_id: "water_tap", grams: 500 }]), db);
    expect(c.warnings.find((w) => w.code === "pan_overflow_predicted")?.severity).toBe("error");
  });
  it("emits pan_underfill_predicted when predicted_loaf_g < 600", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 300 }, { uid: uid(), ingredient_id: "water_tap", grams: 200 }]), db);
    expect(c.warnings.find((w) => w.code === "pan_underfill_predicted")).toBeDefined();
  });
  it("emits sugar_too_high above 12%", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "sugar_granulated", grams: 70 }]), db);
    expect(c.warnings.find((w) => w.code === "sugar_too_high")).toBeDefined();
  });
  it("does not emit sugar_too_high at exactly 12%", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "sugar_granulated", grams: 60 }]), db);
    expect(c.warnings.find((w) => w.code === "sugar_too_high")).toBeUndefined();
  });
  it("emits salt_too_high above 2.5%", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "salt_table", grams: 14 }]), db);
    expect(c.warnings.find((w) => w.code === "salt_too_high")).toBeDefined();
  });
  it("emits salt_too_high from inherent feta salt and pairs with salt_inherent_dominant", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "feta", grams: 400 }]), db);
    expect(c.warnings.find((w) => w.code === "salt_too_high")).toBeDefined();
    expect(c.warnings.find((w) => w.code === "salt_inherent_dominant")).toBeDefined();
  });
  it("emits fat_too_high above 12%", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "oil_canola", grams: 70 }]), db);
    expect(c.warnings.find((w) => w.code === "fat_too_high")).toBeDefined();
  });
  it("emits enzymatic_gluten_degradation when pineapple is present", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 250 }, { uid: uid(), ingredient_id: "pineapple_fresh", grams: 100 }]), db);
    expect(c.warnings.find((w) => w.code === "enzymatic_gluten_degradation")).toBeDefined();
  });
  it("emits inclusions_exceed_pan when inclusions > 30% of flour", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "banana_freezer_thawed", grams: 180, role: "inclusion" }]), db);
    expect(c.warnings.find((w) => w.code === "inclusions_exceed_pan")).toBeDefined();
  });
  it("emits late_water_release_present (info) when frozen banana present", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 250 }, { uid: uid(), ingredient_id: "banana_freezer_thawed", grams: 100 }]), db);
    expect(c.warnings.find((w) => w.code === "late_water_release_present")).toBeDefined();
  });
  it("emits no_yeast_or_leavener when both are zero", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }]), db);
    expect(c.warnings.find((w) => w.code === "no_yeast_or_leavener")).toBeDefined();
  });
  it("emits no_salt below 0.5%", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "yeast_instant", grams: 5 }]), db);
    expect(c.warnings.find((w) => w.code === "no_salt")).toBeDefined();
  });
  it("emits flour_quantity_atypical when flour outside [470,620]", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 800 }, { uid: uid(), ingredient_id: "water_tap", grams: 500 }]), db);
    expect(c.warnings.find((w) => w.code === "flour_quantity_atypical")).toBeDefined();
  });
  it("emits humectant_overestimate_risk when humectants > 10% flour without override", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 300 }, { uid: uid(), ingredient_id: "honey", grams: 60 }]), db);
    expect(c.warnings.find((w) => w.code === "humectant_overestimate_risk")).toBeDefined();
  });
  it("emits alcohol_yeast_inhibition when alcohol > 3% of total mass", () => {
    // beer_stout: alcohol_pct=6, water_pct=89.3. 500g flour + 500g beer_stout: alcohol = 500*0.06 = 30g, total mass = 1000g, ratio = 0.030 — at boundary.
    // 600g beer_stout pushes to 36/1100 = 3.27% > 3% (fires).
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "beer_stout", grams: 600 }]), db);
    expect(c.warnings.find((w) => w.code === "alcohol_yeast_inhibition")).toBeDefined();
  });
  it("emits wet_zone_needs_gluten_support in wet zone without strengthener", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 360 }]), db);
    expect(c.warnings.find((w) => w.code === "wet_zone_needs_gluten_support")).toBeDefined();
  });
  it("does NOT emit wet_zone_needs_gluten_support when vital wheat gluten is present", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 360 }, { uid: uid(), ingredient_id: "vital_wheat_gluten", grams: 30 }]), db);
    expect(c.warnings.find((w) => w.code === "wet_zone_needs_gluten_support")).toBeUndefined();
  });
  it("emits very_wet_zone above 75% effective without GF stabilizer or eggs", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 400 }]), db);
    expect(c.warnings.find((w) => w.code === "very_wet_zone")).toBeDefined();
  });
  it("does NOT emit very_wet_zone when xanthan is present", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 400 }, { uid: uid(), ingredient_id: "xanthan_gum", grams: 5 }]), db);
    expect(c.warnings.find((w) => w.code === "very_wet_zone")).toBeUndefined();
  });
  it("emits under_developed_gluten when effective_pct < ddt_wa_pct", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 250 }, { uid: uid(), ingredient_id: "yeast_instant", grams: 5 }, { uid: uid(), ingredient_id: "salt_table", grams: 9 }]), db);
    expect(c.warnings.find((w) => w.code === "under_developed_gluten")).toBeDefined();
  });

  // --- course_crust_shade_unsupported ---
  it("emits course_crust_shade_unsupported when crust_shade not in course.crust_shades", () => {
    const wholeWheat = makeCourse({ id: "whole_wheat", course_number: 2, name: "Whole Wheat", crust_shades: ["medium"], loaf_sizes: ["1.5lb", "2lb"] });
    const dbWithCourses: Database = { ...db, courses: [wholeWheat] };
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "yeast_instant", grams: 5 }, { uid: uid(), ingredient_id: "salt_table", grams: 9 }], { course: "whole_wheat", crust_shade: "light" }), dbWithCourses);
    expect(c.warnings.find((w) => w.code === "course_crust_shade_unsupported")).toBeDefined();
  });
  it("does NOT emit course_crust_shade_unsupported when crust_shade is supported", () => {
    const white = makeCourse({ id: "white", course_number: 1, name: "White", crust_shades: ["light", "medium", "dark"], loaf_sizes: ["1lb", "1.5lb", "2lb"] });
    const dbWithCourses: Database = { ...db, courses: [white] };
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "yeast_instant", grams: 5 }, { uid: uid(), ingredient_id: "salt_table", grams: 9 }], { course: "white", crust_shade: "dark" }), dbWithCourses);
    expect(c.warnings.find((w) => w.code === "course_crust_shade_unsupported")).toBeUndefined();
  });
  it("does NOT emit course_crust_shade_unsupported when course is unknown", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "yeast_instant", grams: 5 }, { uid: uid(), ingredient_id: "salt_table", grams: 9 }], { course: "made_up", crust_shade: "light" }), db);
    expect(c.warnings.find((w) => w.code === "course_crust_shade_unsupported")).toBeUndefined();
  });

  // --- course_loaf_size_unsupported ---
  it("emits course_loaf_size_unsupported when loaf_size not in course.loaf_sizes", () => {
    const white = makeCourse({ id: "white", course_number: 1, name: "White", crust_shades: ["light", "medium", "dark"], loaf_sizes: ["1.5lb", "2lb"] });
    const dbWithCourses: Database = { ...db, courses: [white] };
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "yeast_instant", grams: 5 }, { uid: uid(), ingredient_id: "salt_table", grams: 9 }], { course: "white", loaf_size: "1lb" }), dbWithCourses);
    expect(c.warnings.find((w) => w.code === "course_loaf_size_unsupported")).toBeDefined();
  });
  it("does NOT emit course_loaf_size_unsupported when course.loaf_sizes is empty (non-baking course)", () => {
    const dough = makeCourse({ id: "dough", course_number: 8, name: "Dough", crust_shades: [], loaf_sizes: [] });
    const dbWithCourses: Database = { ...db, courses: [dough] };
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "yeast_instant", grams: 5 }, { uid: uid(), ingredient_id: "salt_table", grams: 9 }], { course: "dough", loaf_size: "1lb" }), dbWithCourses);
    expect(c.warnings.find((w) => w.code === "course_loaf_size_unsupported")).toBeUndefined();
  });

  // --- unknown_course_id ---
  it("emits unknown_course_id when recipe.course is not in db.courses", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "yeast_instant", grams: 5 }, { uid: uid(), ingredient_id: "salt_table", grams: 9 }], { course: "nonexistent_course" }), db);
    expect(c.warnings.find((w) => w.code === "unknown_course_id")).toBeDefined();
  });
  it("does NOT emit unknown_course_id when recipe.course is undefined", () => {
    const c = computeRecipe(recipeOf([{ uid: uid(), ingredient_id: "bread_flour", grams: 500 }, { uid: uid(), ingredient_id: "water_tap", grams: 320 }, { uid: uid(), ingredient_id: "yeast_instant", grams: 5 }, { uid: uid(), ingredient_id: "salt_table", grams: 9 }]), db);
    expect(c.warnings.find((w) => w.code === "unknown_course_id")).toBeUndefined();
  });
});
