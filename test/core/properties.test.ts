// test/core/properties.test.ts
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeRecipe, solveRecipe } from "../../src/core/index.js";
import type { Recipe, Database } from "../../src/core/types.js";
import { readFileSync } from "node:fs";

const ingredients = JSON.parse(readFileSync("src/data/ingredients.json", "utf8")).entries;
const flours = JSON.parse(readFileSync("src/data/flours.json", "utf8")).entries;
const refs = JSON.parse(readFileSync("src/data/bb_pdc20_recipes.json", "utf8")).entries;
const machines = JSON.parse(readFileSync("src/data/machines.json", "utf8")).entries;
const defaults = JSON.parse(readFileSync("src/data/defaults.json", "utf8"));
const db: Database = { ingredients, flours, references: refs, machines, defaults };

const flourIds = flours.map((f: any) => f.id);
const wetIds = ingredients.filter((i: any) => i.is_liquid).map((i: any) => i.id);

const uidArb = fc.string({ minLength: 8, maxLength: 16 })
  .filter((s) => /^[A-Za-z0-9_-]{8,16}$/.test(s));

// Build arbitraries that produce unique uids within each record
const arbRecipe = fc.tuple(uidArb, uidArb, uidArb, uidArb, uidArb, uidArb).chain(
  ([u1, u2, u3, u4, u5, u6]) => {
    // Ensure uniqueness by using distinct positions
    const uids = [u1, u2, u3, u4, u5, u6];
    return fc.record({
      schema_version: fc.constant("2.0" as const),
      items: fc.array(fc.oneof(
        fc.record({ uid: fc.constantFrom(...uids), ingredient_id: fc.constantFrom(...flourIds), grams: fc.float({ min: 100, max: 800, noNaN: true }) }),
        fc.record({ uid: fc.constantFrom(...uids), ingredient_id: fc.constantFrom(...wetIds), grams: fc.float({ min: 50, max: 500, noNaN: true }) }),
      ), { minLength: 2, maxLength: 6 }),
    });
  }
) as fc.Arbitrary<Recipe>;

// Simpler approach: generate items with pre-assigned uids based on index
const arbRecipeWithUniqueUids = fc.array(
  fc.oneof(
    fc.record({ ingredient_id: fc.constantFrom(...flourIds), grams: fc.float({ min: 100, max: 800, noNaN: true }) }),
    fc.record({ ingredient_id: fc.constantFrom(...wetIds), grams: fc.float({ min: 50, max: 500, noNaN: true }) }),
  ),
  { minLength: 2, maxLength: 6 }
).map((items) => ({
  schema_version: "2.0" as const,
  items: items.map((it, idx) => ({
    uid: `u_prop${idx.toString().padStart(4, "0")}`,
    ...it,
  })),
})) as fc.Arbitrary<Recipe>;

describe("computeRecipe properties", () => {
  it("is deterministic", () => {
    fc.assert(fc.property(arbRecipeWithUniqueUids, (r) => {
      const a = computeRecipe(r, db);
      const b = computeRecipe(r, db);
      expect(a).toEqual(b);
    }), { numRuns: 50 });
  });
  it("nominal_pct >= effective_pct (free_water_factor <= 1)", () => {
    fc.assert(fc.property(arbRecipeWithUniqueUids, (r) => {
      const c = computeRecipe(r, db);
      if (c.hydration.nominal_pct == null) return;
      expect(c.hydration.nominal_pct).toBeGreaterThanOrEqual(c.hydration.effective_pct!);
    }), { numRuns: 50 });
  });
});

describe("solveRecipe properties", () => {
  const arbModeB = fc.record({
    schema_version: fc.constant("2.0" as const),
    target_loaf_g: fc.float({ min: 400, max: 950, noNaN: true }),
    items: fc.tuple(
      fc.record({ uid: fc.constant("u_flour001"), ingredient_id: fc.constantFrom(...flourIds), bakers_pct: fc.constant(100) }),
      fc.record({ uid: fc.constant("u_water001"), ingredient_id: fc.constantFrom(...wetIds), bakers_pct: fc.float({ min: 30, max: 80, noNaN: true }) }),
    ),
  }) as fc.Arbitrary<Recipe>;

  it("is idempotent", () => {
    fc.assert(fc.property(arbModeB, (r) => {
      const a = solveRecipe(r, db);
      const b = solveRecipe(a, db);
      expect(b.items.map((i) => i.grams)).toEqual(a.items.map((i) => i.grams));
    }), { numRuns: 30 });
  });
});
