import { describe, it, expect } from "vitest";
import { renderNarrative } from "../../src/agent/explain.js";
import { buildTree } from "../../src/core/explain-tree.js";
import type { Recipe, Database } from "../../src/core/types.js";
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

const r: Recipe = {
  schema_version: "2.0",
  items: [
    { uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 553 },
    { uid: "u_water001", ingredient_id: "water_tap",   grams: 326 },
  ],
};

describe("renderNarrative", () => {
  it("renders a multi-line string for a real recipe tree", () => {
    const tree = buildTree(r, db);
    const text = renderNarrative(tree);
    expect(text.length).toBeGreaterThan(20);
    expect(text).toContain("total_flour_g");
  });

  it("contains every top-level metric label", () => {
    const tree = buildTree(r, db);
    const text = renderNarrative(tree);
    for (const label of ["total_flour_g", "total_water_g_nominal", "total_water_g_effective", "predicted_loaf_g"]) {
      expect(text).toContain(label);
    }
  });
});
