import { describe, it, expect } from "vitest";
import { recommend } from "../../src/agent/recommend.js";
import type { BBPDC20Course, Database, Defaults, Flour, Ingredient, Machine, Recipe } from "../../src/core/types.js";
import ingredientsFile from "../../src/data/ingredients.json" with { type: "json" };
import floursFile from "../../src/data/flours.json" with { type: "json" };
import coursesFile from "../../src/data/bb_pdc20_courses.json" with { type: "json" };
import machinesFile from "../../src/data/machines.json" with { type: "json" };
import defaultsRaw from "../../src/data/defaults.json" with { type: "json" };

/* eslint-disable @typescript-eslint/no-explicit-any */
const db: Database = {
  ingredients: (ingredientsFile as any).entries as Ingredient[],
  flours:      (floursFile as any).entries as Flour[],
  references:  [],
  machines:    (machinesFile as any).entries as Machine[],
  courses:     (coursesFile as any).entries as BBPDC20Course[],
  defaults:    defaultsRaw as Defaults,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const recipe: Recipe = {
  schema_version: "2.0",
  items: [{ uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 }],
};

describe("agent/recommend", () => {
  it("returns { recommendations } with 14 entries (no envelope wrap)", () => {
    const result = recommend(recipe, db);
    expect(result).toHaveProperty("recommendations");
    expect(result.recommendations.length).toBe(14);
    expect(result).not.toHaveProperty("_meta");
    expect(result).not.toHaveProperty("payload");
  });

  it("forwards opts.intent.output='dough' to the engine (excludes baking courses)", () => {
    const result = recommend(recipe, db, { intent: { output: "dough" } });
    const white = result.recommendations.find((r) => r.course_id === "white");
    expect(white?.eligible).toBe(false);
  });

  it("forwards opts.intent.dietary='sugar_free' to the engine on a sweetenerless recipe", () => {
    const sweetenerlessRecipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_a", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_b", ingredient_id: "yeast_instant", grams: 6 },
      ],
    };
    const result = recommend(sweetenerlessRecipe, db, { intent: { dietary: "sugar_free" } });
    const top = result.recommendations.find((r) => r.rank === 1);
    expect(top?.course_id).toBe("sugar_free");
  });

  it("is re-exported from src/agent/index.ts (public agent API surface)", async () => {
    const agentMod = await import("../../src/agent/index.js");
    expect(typeof agentMod.recommend).toBe("function");
    const result = agentMod.recommend(recipe, db);
    expect(result.recommendations.length).toBe(14);
  });
});
