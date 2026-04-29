import { describe, it } from "vitest";
import * as fc from "fast-check";
import { convert } from "../../src/agent/convert.js";
import type { Database } from "../../src/core/types.js";
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

const idsWithDensity = db.ingredients.filter((i) => (i.density_g_per_cup ?? 0) > 0).map((i) => i.id);

describe("convert roundtrip property", () => {
  it("convert(qty, unit, ing) → grams → convert(grams, 'g', ing) is the identity", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...idsWithDensity),
        fc.constantFrom("cup", "tbsp", "tsp", "ml", "l", "floz"),
        fc.float({ min: Math.fround(0.01), max: 1000, noNaN: true }),
        (id, unit, qty) => {
          const a = convert({ qty, unit, ingredient_id: id }, db);
          if (!a.ok) return true;
          const b = convert({ qty: a.grams, unit: "g", ingredient_id: id }, db);
          if (!b.ok) return false;
          return Math.abs(a.grams - b.grams) < 1e-6;
        },
      ),
      { numRuns: 100 },
    );
  });
});
