import { describe, it } from "vitest";
import { validateRecipe } from "../../src/core/index.js";
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

// A minimal invalid recipe that exercises schema violation reporting.
const invalidRecipe = {
  schema_version: "2.0",
  name: "invalid",
  items: [
    // missing uid — schema violation
    { ingredient_id: "bread_flour", grams: 500 },
  ],
};

describe("validate contract", () => {
  // Valid examples: all 10 should pass validation
  for (const e of getExamples()) {
    it(`validateRecipe(${e.id}) valid shape is stable`, () => {
      const result = validateRecipe(e.recipe, db as never);
      const env = wrap("validate", "TEST", result);
      assertContract(`validate_valid_${e.id}`, env);
    });
  }

  it("validateRecipe(invalid) error shape is stable", () => {
    const result = validateRecipe(invalidRecipe, db as never);
    const env = wrap("validate", "TEST", result);
    assertContract("validate_invalid_missing_uid", env);
  });

  it("validateRecipe(unknown_ingredient) error shape is stable", () => {
    const badIngredient = {
      schema_version: "2.0",
      items: [
        { uid: "u_test0001", ingredient_id: "nonexistent_ingredient_xyz", grams: 100 },
      ],
    };
    const result = validateRecipe(badIngredient, db as never);
    const env = wrap("validate", "TEST", result);
    assertContract("validate_invalid_unknown_ingredient", env);
  });
});
