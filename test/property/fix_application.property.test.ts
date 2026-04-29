import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { applyFix } from "../../src/agent/fix.js";
import type { Recipe, Fix } from "../../src/core/types.js";

const baseRecipe: Recipe = {
  schema_version: "2.0",
  items: [
    { uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 553 },
    { uid: "u_water001", ingredient_id: "water_tap",   grams: 326 },
  ],
};

describe("fix application property", () => {
  it("set_grams is idempotent under repeated application", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        (g) => {
          const fix: Fix = { kind: "set_grams", uid: "u_brdfl001", grams: g, rationale: "p" };
          const r1 = applyFix(baseRecipe, fix);
          if (!r1.ok) return false;
          const r2 = applyFix(r1.recipe, fix);
          if (!r2.ok) return false;
          return r1.recipe.items[0]!.grams === r2.recipe.items[0]!.grams;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("increase_grams + decrease_grams roundtrip leaves grams unchanged", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000, noNaN: true }),
        (delta) => {
          const inc: Fix = { kind: "increase_grams", uid: "u_water001", delta_g: delta, rationale: "p" };
          const dec: Fix = { kind: "decrease_grams", uid: "u_water001", delta_g: delta, rationale: "p" };
          const r1 = applyFix(baseRecipe, inc);
          if (!r1.ok) return false;
          const r2 = applyFix(r1.recipe, dec);
          if (!r2.ok) return false;
          return Math.abs((r2.recipe.items[1]!.grams ?? 0) - 326) < 1e-9;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("add_ingredient with explicit uid produces deterministic output", () => {
    const fix: Fix = { kind: "add_ingredient", uid: "u_yeast001", ingredient_id: "yeast_instant", grams: 5, rationale: "p" };
    const r1 = applyFix(baseRecipe, fix);
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.recipe.items.length).toBe(3);
      expect(r1.recipe.items[2]!.uid).toBe("u_yeast001");
    }
  });
});
