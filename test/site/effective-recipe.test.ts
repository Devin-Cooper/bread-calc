/// <reference types="happy-dom" />
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { Database, Recipe } from "../../src/core/index.js";
import { effectiveRecipe } from "../../src/site/effective-recipe.js";

const db: Database = {
  ingredients: JSON.parse(readFileSync("src/data/ingredients.json", "utf8")).entries,
  flours:      JSON.parse(readFileSync("src/data/flours.json", "utf8")).entries,
  references:  JSON.parse(readFileSync("src/data/bb_pdc20_recipes.json", "utf8")).entries,
  machines:    JSON.parse(readFileSync("src/data/machines.json", "utf8")).entries,
  courses:     [],
  defaults:    JSON.parse(readFileSync("src/data/defaults.json", "utf8")),
};

describe("effectiveRecipe", () => {
  it("returns the input recipe unchanged when target_loaf_g is unset", () => {
    const r: Recipe = { schema_version: "2.0", items: [{ uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 500 }] };
    expect(effectiveRecipe(r, db)).toBe(r);
  });

  it("returns the input recipe unchanged when no item has bakers_pct", () => {
    const r: Recipe = {
      schema_version: "2.0", target_loaf_g: 900,
      items: [{ uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 500 }],
    };
    expect(effectiveRecipe(r, db)).toBe(r);
  });

  it("solves grams from bakers_pct when target_loaf_g is set", () => {
    const r: Recipe = {
      schema_version: "2.0", target_loaf_g: 900,
      items: [
        { uid: "u_brdfl001", ingredient_id: "bread_flour", bakers_pct: 100 },
        { uid: "u_water001", ingredient_id: "water_tap", bakers_pct: 65 },
      ],
    };
    const solved = effectiveRecipe(r, db);
    expect(solved).not.toBe(r);
    const flourGrams = solved.items[0]!.grams!;
    const waterGrams = solved.items[1]!.grams!;
    expect(flourGrams).toBeGreaterThan(0);
    expect(waterGrams).toBeCloseTo(flourGrams * 0.65, 0);
  });

  it("falls back to the input recipe on solver error (ambiguous flour)", () => {
    // Fixed-grams flour mixed with a bakers_pct item triggers solver_ambiguous_flour.
    const r: Recipe = {
      schema_version: "2.0", target_loaf_g: 900,
      items: [
        { uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_water001", ingredient_id: "water_tap", bakers_pct: 65 },
      ],
    };
    expect(effectiveRecipe(r, db)).toBe(r);
  });
});
