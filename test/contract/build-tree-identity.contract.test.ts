import { describe, it, expect } from "vitest";
import { buildTree } from "../../src/core/explain-tree.js";
import { computeRecipe } from "../../src/core/index.js";
import { getExamples } from "../../src/agent/examples.js";
import ingredientsFile from "../../src/data/ingredients.json" with { type: "json" };
import floursFile from "../../src/data/flours.json" with { type: "json" };
import refsFile from "../../src/data/bb_pdc20_recipes.json" with { type: "json" };
import machinesFile from "../../src/data/machines.json" with { type: "json" };
import defaultsRaw from "../../src/data/defaults.json" with { type: "json" };

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = {
  ingredients: (ingredientsFile as any).entries,
  flours:      (floursFile as any).entries,
  references:  (refsFile as any).entries,
  machines:    (machinesFile as any).entries,
  defaults:    defaultsRaw as any,
};

describe("buildTree byte-identity (audit risk #3)", () => {
  it("buildTree(r) byte-equals computeRecipe(r).tree for every example", () => {
    for (const e of getExamples()) {
      const t1 = buildTree(e.recipe, db as never);
      const t2 = computeRecipe(e.recipe, db as never).tree;
      expect(JSON.stringify(t1), `byte mismatch for example "${e.id}"`).toBe(JSON.stringify(t2));
    }
  });
});
