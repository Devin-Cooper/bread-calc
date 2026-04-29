import { describe, it } from "vitest";
import * as fc from "fast-check";
import { buildTree, evaluateTree } from "../../src/core/explain-tree.js";
import type { Recipe, Database } from "../../src/core/types.js";
// (Reuse the db construction pattern from existing core tests; e.g.)
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

describe("tree consistency property", () => {
  it("evaluateTree(buildTree(r, db)).ok === true for any valid recipe", () => {
    fc.assert(
      fc.property(recipeArb, (recipe) => {
        const tree = buildTree(recipe, db);
        const result = evaluateTree(tree);
        return result.ok === true;
      }),
      { numRuns: 200 },
    );
  });
});
