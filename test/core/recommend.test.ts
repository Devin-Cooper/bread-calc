import { describe, it, expect } from "vitest";
import { recommendCourse } from "../../src/core/recommend.js";
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

const baseRecipe: Recipe = {
  schema_version: "2.0",
  items: [{ uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 }],
};

function recOf(courseId: string, recs: readonly { course_id: string }[]) {
  return recs.find((r) => r.course_id === courseId);
}

describe("recommendCourse — dietary gate", () => {
  it("excludes Course 5 Gluten Free for a wheat-flour recipe", () => {
    const recs = recommendCourse(baseRecipe, db);
    const gf = recOf("gluten_free", recs);
    expect(gf).toBeDefined();
    expect(gf!.eligible).toBe(false);
    expect(gf!.reasons.some((r) => r.tier === "dietary" && r.verdict === "mismatch")).toBe(true);
  });

  it("Course 1 White is eligible for the same recipe (no dietary requirement)", () => {
    const recs = recommendCourse(baseRecipe, db);
    const white = recOf("white", recs);
    expect(white).toBeDefined();
    expect(white!.eligible).toBe(true);
  });
});
