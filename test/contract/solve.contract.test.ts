import { describe, it } from "vitest";
import { solveRecipe } from "../../src/core/index.js";
import { wrap } from "../../src/core/envelope.js";
import { getExamples } from "../../src/agent/examples.js";
import { assertContract } from "./_helper.js";
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

const solverExamples = getExamples().filter((e) => e.recipe.target_loaf_g != null);

describe("solve contract", () => {
  for (const e of solverExamples) {
    it(`solveRecipe(${e.id}) shape is stable`, () => {
      const solved = solveRecipe(e.recipe, db as never);
      const env = wrap("solve", "TEST", solved);
      assertContract(`solve_${e.id}`, env);
    });
  }
});
