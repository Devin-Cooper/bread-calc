import { describe, it, expect } from "vitest";
import { recommendCourse, resolveCourse } from "../../src/core/recommend.js";
import type { CourseRecommendation, TreeBranch } from "../../src/core/recommend.js";
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

function recOf(courseId: string, recs: readonly CourseRecommendation[]): CourseRecommendation | undefined {
  return recs.find((r) => r.course_id === courseId);
}

function topBranchOf(recs: readonly CourseRecommendation[]): TreeBranch | undefined {
  const top = recs[0];
  if (!top) return undefined;
  const reason = top.reasons.find((r) => r.kind === "tree_branch");
  return reason?.kind === "tree_branch" ? reason.branch : undefined;
}

const baseRecipe: Recipe = {
  schema_version: "2.0",
  items: [{ uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 }],
};

describe("recommendCourse — invariants", () => {
  it("returns 14 entries (one per catalog course)", () => {
    expect(recommendCourse(baseRecipe, db).length).toBe(14);
  });

  it("eligible courses come before ineligible courses", () => {
    const recs = recommendCourse(baseRecipe, db);
    let seenIneligible = false;
    for (const r of recs) {
      if (!r.eligible) seenIneligible = true;
      else if (seenIneligible) throw new Error(`Eligible ${r.course_id} appears after ineligible`);
    }
    expect(true).toBe(true);
  });

  it("eligible courses are ranked 1..N; ineligible courses have rank null", () => {
    const recs = recommendCourse(baseRecipe, db);
    const eligibleRecs = recs.filter((r) => r.eligible);
    eligibleRecs.forEach((r, i) => expect(r.rank).toBe(i + 1));
    for (const r of recs.filter((r) => !r.eligible)) expect(r.rank).toBe(null);
  });

  it("ineligible courses are sorted by course_number", () => {
    const recs = recommendCourse(baseRecipe, db, { intent: { output: "dough" } });
    const ineligible = recs.filter((r) => !r.eligible);
    const courseNumbers = ineligible.map((r) => db.courses.find((c) => c.id === r.course_id)!.course_number);
    expect(courseNumbers).toEqual([...courseNumbers].sort((a, b) => a - b));
  });
});

describe("recommendCourse — tree branches", () => {
  it("intent.output='dough' routes to Dough", () => {
    const recs = recommendCourse(baseRecipe, db, { intent: { output: "dough" } });
    expect(recs[0]?.course_id).toBe("dough");
    expect(topBranchOf(recs)).toBe("intent_output_dough");
  });

  it("GF flour + no wheat/rye → Gluten Free", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_a", ingredient_id: "gf_flour_blend", grams: 400 },
        { uid: "u_b", ingredient_id: "water_tap", grams: 300 },
        { uid: "u_c", ingredient_id: "yeast_active_dry", grams: 9 },
      ],
    };
    const recs = recommendCourse(recipe, db);
    expect(recs[0]?.course_id).toBe("gluten_free");
    expect(topBranchOf(recs)).toBe("dietary_gluten_free");
  });

  it("salt_g=0 + ACV present → Salt Free", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_a", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_b", ingredient_id: "water_tap", grams: 300 },
        { uid: "u_c", ingredient_id: "vinegar_apple_cider", grams: 15 },
        { uid: "u_d", ingredient_id: "yeast_instant", grams: 6 },
      ],
    };
    expect(recommendCourse(recipe, db)[0]?.course_id).toBe("salt_free");
    expect(topBranchOf(recommendCourse(recipe, db))).toBe("dietary_salt_free");
  });

  it("no animal products + plant milk → Vegan", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_a", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_b", ingredient_id: "water_tap", grams: 200 },
        { uid: "u_c", ingredient_id: "almond_milk_unsweetened", grams: 150 },
        { uid: "u_d", ingredient_id: "olive_oil", grams: 24 },
        { uid: "u_e", ingredient_id: "salt_table", grams: 9 },
        { uid: "u_f", ingredient_id: "yeast_instant", grams: 6 },
      ],
    };
    expect(recommendCourse(recipe, db)[0]?.course_id).toBe("vegan");
  });

  it("all sweeteners absent + intent.dietary='sugar_free' → Sugar Free", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_a", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_b", ingredient_id: "water_tap", grams: 300 },
        { uid: "u_c", ingredient_id: "salt_table", grams: 9 },
        { uid: "u_d", ingredient_id: "yeast_instant", grams: 6 },
      ],
      intent: { dietary: "sugar_free" },
    };
    expect(recommendCourse(recipe, db)[0]?.course_id).toBe("sugar_free");
  });

  it("all sweeteners absent WITHOUT intent → no false-positive sugar_free (routes to White by structure)", () => {
    // Sweetenerless recipe with butter present — fails European (butter > 2%)
    // and Sugar Free requires intent flag, so it routes to White. Demonstrates:
    // missing intent ≠ sugar_free even when sweeteners=0.
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_a", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_b", ingredient_id: "water_tap", grams: 300 },
        { uid: "u_c", ingredient_id: "butter_unsalted", grams: 35 },
        { uid: "u_d", ingredient_id: "salt_table", grams: 9 },
        { uid: "u_e", ingredient_id: "yeast_instant", grams: 6 },
      ],
    };
    const top = recommendCourse(recipe, db)[0]?.course_id;
    expect(top).not.toBe("sugar_free");
    expect(top).toBe("white");
  });

  it("intent.time='rapid' + ww_pct < 30 → Rapid White", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [{ uid: "u_a", ingredient_id: "bread_flour", grams: 500 }],
      intent: { time: "rapid" },
    };
    expect(recommendCourse(recipe, db)[0]?.course_id).toBe("rapid_white");
  });

  it("intent.time='rapid' + ww_pct ≥ 30 → Rapid Whole Wheat", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_a", ingredient_id: "whole_wheat_flour", grams: 500 },
        { uid: "u_b", ingredient_id: "water_tap", grams: 350 },
      ],
      intent: { time: "rapid" },
    };
    expect(recommendCourse(recipe, db)[0]?.course_id).toBe("rapid_whole_wheat");
  });

  it("grain_cereal-category ingredient → Multigrain", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_a", ingredient_id: "bread_flour", grams: 200 },
        { uid: "u_b", ingredient_id: "whole_wheat_flour", grams: 200 },
        { uid: "u_c", ingredient_id: "seven_grain_cereal", grams: 100 },
      ],
    };
    expect(recommendCourse(recipe, db)[0]?.course_id).toBe("multigrain");
  });

  it("ww_pct ≥ 30 → Whole Wheat (when no grain_cereal)", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_a", ingredient_id: "bread_flour", grams: 200 },
        { uid: "u_b", ingredient_id: "whole_wheat_flour", grams: 300 },
      ],
    };
    expect(recommendCourse(recipe, db)[0]?.course_id).toBe("whole_wheat");
  });

  it("rye-blend bread → Whole Wheat (not Multigrain)", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_a", ingredient_id: "bread_flour", grams: 358 },
        { uid: "u_b", ingredient_id: "whole_wheat_flour", grams: 65 },
        { uid: "u_c", ingredient_id: "rye_flour_light", grams: 130 },
      ],
    };
    expect(recommendCourse(recipe, db)[0]?.course_id).toBe("whole_wheat");
  });

  it("BF-only + lean (low sugar, low butter) → European", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_a", ingredient_id: "water_tap", grams: 320 },
        { uid: "u_b", ingredient_id: "bread_flour", grams: 553 },
        { uid: "u_c", ingredient_id: "sugar_granulated", grams: 12 },
        { uid: "u_d", ingredient_id: "milk_powder_nonfat", grams: 8 },
        { uid: "u_e", ingredient_id: "salt_table", grams: 10 },
        { uid: "u_f", ingredient_id: "yeast_instant", grams: 3 },
      ],
    };
    expect(recommendCourse(recipe, db)[0]?.course_id).toBe("european");
  });

  it("default fallback → White", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_a", ingredient_id: "water_tap", grams: 320 },
        { uid: "u_b", ingredient_id: "bread_flour", grams: 553 },
        { uid: "u_c", ingredient_id: "sugar_granulated", grams: 48 },
        { uid: "u_d", ingredient_id: "butter_unsalted", grams: 35 },
        { uid: "u_e", ingredient_id: "salt_table", grams: 10 },
        { uid: "u_f", ingredient_id: "yeast_instant", grams: 6 },
      ],
    };
    expect(recommendCourse(recipe, db)[0]?.course_id).toBe("white");
  });
});

describe("recommendCourse — eligibility (output intent)", () => {
  it("intent.output='bake' → non-baking courses (Dough, Sourdough Starter, Jam) are ineligible", () => {
    const recs = recommendCourse(baseRecipe, db, { intent: { output: "bake" } });
    expect(recOf("dough", recs)?.eligible).toBe(false);
    expect(recOf("sourdough_starter", recs)?.eligible).toBe(false);
    expect(recOf("jam", recs)?.eligible).toBe(false);
    expect(recOf("white", recs)?.eligible).toBe(true);
  });

  it("intent.output='dough' → all baking courses are ineligible", () => {
    const recs = recommendCourse(baseRecipe, db, { intent: { output: "dough" } });
    expect(recOf("white", recs)?.eligible).toBe(false);
    expect(recOf("cake", recs)?.eligible).toBe(false);
    expect(recOf("dough", recs)?.eligible).toBe(true);
  });
});

describe("recommendCourse — recipe.intent vs opts.intent", () => {
  it("recipe.intent.dietary='sugar_free' on a sweetenerless recipe routes to sugar_free", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      intent: { dietary: "sugar_free" },
      items: [
        { uid: "u_a", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_b", ingredient_id: "yeast_instant", grams: 6 },
      ],
    };
    expect(recommendCourse(recipe, db)[0]?.course_id).toBe("sugar_free");
  });

  it("opts.intent.output overrides recipe.intent.output", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      intent: { output: "bake" },
      items: [{ uid: "u_a", ingredient_id: "bread_flour", grams: 500 }],
    };
    const recs = recommendCourse(recipe, db, { intent: { output: "dough" } });
    expect(recs[0]?.course_id).toBe("dough");
  });
});

describe("resolveCourse", () => {
  it("returns user pick when recipe.course is set + valid", () => {
    const recipe: Recipe = { schema_version: "2.0", course: "white", items: [] };
    const r = resolveCourse(recipe, db);
    expect(r?.course.id).toBe("white");
    expect(r?.source).toBe("user");
  });

  it("returns null when recipe.course is unknown", () => {
    expect(resolveCourse({ schema_version: "2.0", course: "made_up", items: [] }, db)).toBeNull();
  });

  it("returns recommendation when recipe.course is unset", () => {
    const r = resolveCourse({
      schema_version: "2.0",
      items: [{ uid: "u_a", ingredient_id: "bread_flour", grams: 500 }],
    }, db);
    expect(r?.source).toBe("recommended");
  });
});
