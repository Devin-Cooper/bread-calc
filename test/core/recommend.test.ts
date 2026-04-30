import { describe, it, expect } from "vitest";
import { recommendCourse } from "../../src/core/recommend.js";
import type { CourseRecommendation } from "../../src/core/recommend.js";
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

function recOf(courseId: string, recs: readonly CourseRecommendation[]) {
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

  it("salt-free recipe (no salt items) passes Course 6 Salt Free", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_test_a01c", ingredient_id: "water_tap", grams: 320 },
        { uid: "u_test_a01d", ingredient_id: "yeast_instant", grams: 6 },
      ],
    };
    const recs = recommendCourse(recipe, db);
    const sf = recOf("salt_free", recs);
    expect(sf!.eligible).toBe(true);
  });

  it("recipe with salt fails Course 6 Salt Free", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_test_a01c", ingredient_id: "salt_table", grams: 9 },
      ],
    };
    const recs = recommendCourse(recipe, db);
    const sf = recOf("salt_free", recs);
    expect(sf!.eligible).toBe(false);
  });

  it("vegan recipe (no eggs/dairy) passes Course 8 Vegan", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_test_a01c", ingredient_id: "water_tap", grams: 320 },
        { uid: "u_test_a01d", ingredient_id: "almond_milk_unsweetened", grams: 100 },
        { uid: "u_test_a01e", ingredient_id: "olive_oil", grams: 24 },
      ],
    };
    const recs = recommendCourse(recipe, db);
    const v = recOf("vegan", recs);
    expect(v!.eligible).toBe(true);
  });

  it("recipe with milk fails Course 8 Vegan", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_test_a01c", ingredient_id: "milk_whole", grams: 200 },
      ],
    };
    const recs = recommendCourse(recipe, db);
    const v = recOf("vegan", recs);
    expect(v!.eligible).toBe(false);
  });

  it("recipe with butter fails Course 8 Vegan (dairy fat)", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_test_a01c", ingredient_id: "butter_unsalted", grams: 28 },
      ],
    };
    const recs = recommendCourse(recipe, db);
    const v = recOf("vegan", recs);
    expect(v!.eligible).toBe(false);
  });

  it("recipe with aquafaba (vegan egg substitute) does NOT block Course 8 Vegan", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_test_a01c", ingredient_id: "aquafaba", grams: 50 },
      ],
    };
    const recs = recommendCourse(recipe, db);
    const v = recOf("vegan", recs);
    expect(v!.eligible).toBe(true);
  });

  it("non-vegan no-egg recipe (milk + butter) fails Course 8 Vegan", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_test_a01c", ingredient_id: "milk_whole", grams: 200 },
        { uid: "u_test_a01d", ingredient_id: "butter_unsalted", grams: 28 },
      ],
    };
    const recs = recommendCourse(recipe, db);
    const v = recOf("vegan", recs);
    expect(v!.eligible).toBe(false);
  });

  it("GF recipe (only gf_flour_blend) passes Course 5 Gluten Free", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "gf_flour_blend", grams: 400 },
        { uid: "u_test_a01c", ingredient_id: "water_tap", grams: 320 },
      ],
    };
    const recs = recommendCourse(recipe, db);
    const gf = recOf("gluten_free", recs);
    expect(gf!.eligible).toBe(true);
  });
});

describe("recommendCourse — intent gate", () => {
  it("intent='bake' excludes non-baking courses (Dough, Sourdough Starter, Jam)", () => {
    const recs = recommendCourse(baseRecipe, db, { intent: "bake" });
    expect(recOf("dough", recs)!.eligible).toBe(false);
    expect(recOf("sourdough_starter", recs)!.eligible).toBe(false);
    expect(recOf("jam", recs)!.eligible).toBe(false);
    expect(recOf("white", recs)!.eligible).toBe(true);
  });

  it("intent='dough' excludes baking courses; only Dough/Sourdough Starter/Jam eligible", () => {
    const recs = recommendCourse(baseRecipe, db, { intent: "dough" });
    expect(recOf("dough", recs)!.eligible).toBe(true);
    expect(recOf("sourdough_starter", recs)!.eligible).toBe(true);
    expect(recOf("jam", recs)!.eligible).toBe(true);
    expect(recOf("white", recs)!.eligible).toBe(false);
    expect(recOf("cake", recs)!.eligible).toBe(false);
  });

  it("intent unset: gate emits neutral; never excludes on intent alone", () => {
    const recs = recommendCourse(baseRecipe, db);
    for (const r of recs) {
      const intentReason = r.reasons.find((x) => x.tier === "intent");
      if (intentReason) expect(intentReason.verdict).not.toBe("mismatch");
    }
  });
});
