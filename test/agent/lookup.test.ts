import { describe, it, expect } from "vitest";
import { lookupIngredient } from "../../src/agent/lookup.js";
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

describe("lookupIngredient", () => {
  it("id_exact match scores 1.0", () => {
    const r = lookupIngredient("bread_flour", { db });
    expect(r[0]!.ingredient_id).toBe("bread_flour");
    expect(r[0]!.score).toBe(1.0);
    expect(r[0]!.match_reason).toBe("id_exact");
  });

  it("name_exact (case-insensitive) scores 0.95", () => {
    const r = lookupIngredient("salt, kosher (diamond crystal)", { db });
    expect(r[0]!.ingredient_id).toBe("salt_kosher");
    expect(r[0]!.score).toBe(0.95);
  });

  it("id_prefix scores 0.85", () => {
    const r = lookupIngredient("bread", { db });
    // bread_flour starts with "bread" — id_prefix.
    expect(r[0]!.ingredient_id).toBe("bread_flour");
    expect(r[0]!.score).toBe(0.85);
  });

  it("respects limit option", () => {
    const r = lookupIngredient("a", { db, limit: 3 });
    expect(r.length).toBeLessThanOrEqual(3);
  });

  it("ties broken by id lex order", () => {
    // Two ingredients with the same name_substring score should sort by id.
    const r = lookupIngredient("oil", { db });
    const oilEntries = r.filter((x) => x.match_reason === "name_substring");
    if (oilEntries.length >= 2) {
      const ids = oilEntries.map((x) => x.ingredient_id);
      expect([...ids]).toEqual([...ids].sort());
    }
  });

  it("returns up to 12 by default", () => {
    const r = lookupIngredient("a", { db });
    expect(r.length).toBeLessThanOrEqual(12);
  });

  it("returns empty for nonsense queries", () => {
    const r = lookupIngredient("zzzzzzzzz_no_match", { db });
    expect(r).toEqual([]);
  });
});
