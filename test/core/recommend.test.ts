import { describe, it, expect } from "vitest";
import { recommendCourse, resolveCourse } from "../../src/core/recommend.js";
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

describe("recommendCourse — invariants and ranking", () => {
  it("always returns 14 entries (one per catalog course)", () => {
    const recs = recommendCourse(baseRecipe, db);
    expect(recs.length).toBe(14);
  });

  it("every recommendation has reasons.length === 9", () => {
    const recs = recommendCourse(baseRecipe, db);
    for (const r of recs) {
      expect(r.reasons.length).toBe(9);
    }
  });

  it("eligible courses come before ineligible courses", () => {
    const recs = recommendCourse(baseRecipe, db);
    let seenIneligible = false;
    for (const r of recs) {
      if (!r.eligible) seenIneligible = true;
      else if (seenIneligible) {
        throw new Error(`Eligible course ${r.course_id} appears after an ineligible course`);
      }
    }
    expect(true).toBe(true);
  });

  it("eligible courses are ranked 1..N; ineligible courses have rank null", () => {
    const recs = recommendCourse(baseRecipe, db);
    const eligibleRecs = recs.filter((r) => r.eligible);
    eligibleRecs.forEach((r, i) => expect(r.rank).toBe(i + 1));
    for (const r of recs.filter((r) => !r.eligible)) expect(r.rank).toBe(null);
  });

  it("hydration tier ranks White (ideal 58 %) ahead of Whole Wheat (ideal 67 %) for a 58 % recipe", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_test_a01c", ingredient_id: "water_tap", grams: 290 },
      ],
    };
    const recs = recommendCourse(recipe, db);
    const whiteRank = recs.find((r) => r.course_id === "white")?.rank;
    const wwRank = recs.find((r) => r.course_id === "whole_wheat")?.rank;
    expect(whiteRank).toBeDefined();
    expect(wwRank).toBeDefined();
    expect(whiteRank!).toBeLessThan(wwRank!);
  });

  it("whole-wheat tier ranks Whole Wheat ahead of White for a 60 %-WW recipe", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "whole_wheat_flour", grams: 300 },
        { uid: "u_test_a01c", ingredient_id: "bread_flour", grams: 200 },
        { uid: "u_test_a01d", ingredient_id: "water_tap", grams: 320 },
      ],
    };
    const recs = recommendCourse(recipe, db);
    const whiteRank = recs.find((r) => r.course_id === "white")?.rank;
    const wwRank = recs.find((r) => r.course_id === "whole_wheat")?.rank;
    expect(wwRank!).toBeLessThan(whiteRank!);
  });

  it("ineligible courses are sorted by course_number", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "milk_whole", grams: 200 },
        { uid: "u_test_a01c", ingredient_id: "salt_table", grams: 9 },
        { uid: "u_test_a01d", ingredient_id: "sugar_granulated", grams: 12 },
        { uid: "u_test_a01e", ingredient_id: "egg_whole_large", grams: 50 },
        { uid: "u_test_a01f", ingredient_id: "bread_flour", grams: 500 },
      ],
    };
    const recs = recommendCourse(recipe, db, { intent: "bake" });
    const ineligible = recs.filter((r) => !r.eligible);
    const courseNumbers = ineligible.map((r) => db.courses.find((c) => c.id === r.course_id)!.course_number);
    const sorted = [...courseNumbers].sort((a, b) => a - b);
    expect(courseNumbers).toEqual(sorted);
  });
});

describe("recommendCourse — edge cases", () => {
  it("empty items: hydration unknown; rankings fall back to confidence + course_number", () => {
    const recipe: Recipe = { schema_version: "2.0", items: [] };
    const recs = recommendCourse(recipe, db);
    expect(recs.length).toBe(14);
    const eligible = recs.filter((r) => r.eligible);
    expect(eligible.length).toBeGreaterThan(0);
    expect(eligible[0]!.course_id).toBe("white");
  });

  it("crust_shade tier fires only when recipe.crust_shade is set", () => {
    const recipe1: Recipe = { schema_version: "2.0", items: [{ uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 }] };
    const recipe2: Recipe = { ...recipe1, crust_shade: "light" };
    const r1 = recommendCourse(recipe1, db).find((r) => r.course_id === "whole_wheat")!;
    const r2 = recommendCourse(recipe2, db).find((r) => r.course_id === "whole_wheat")!;
    const cs1 = r1.reasons.find((x) => x.tier === "crust_shade")!;
    const cs2 = r2.reasons.find((x) => x.tier === "crust_shade")!;
    expect(cs1.verdict).toBe("neutral");
    expect(cs2.verdict).toBe("mismatch");
  });

  it("Cake course matches a recipe with baking powder and no yeast", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "ap_flour", grams: 250 },
        { uid: "u_test_a01c", ingredient_id: "baking_powder", grams: 8 },
        { uid: "u_test_a01d", ingredient_id: "sugar_granulated", grams: 200 },
        { uid: "u_test_a01e", ingredient_id: "egg_whole_large", grams: 100 },
        { uid: "u_test_a01f", ingredient_id: "milk_whole", grams: 200 },
      ],
    };
    const recs = recommendCourse(recipe, db, { intent: "bake" });
    const cake = recs.find((r) => r.course_id === "cake")!;
    expect(cake.eligible).toBe(true);
    const yeastReason = cake.reasons.find((x) => x.tier === "yeast")!;
    expect(yeastReason.verdict).toBe("match");
  });

  it("Course 12 Sourdough Starter mismatches yeast for any current recipe (no sourdough ingredient yet)", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_test_a01c", ingredient_id: "yeast_instant", grams: 6 },
      ],
    };
    const recs = recommendCourse(recipe, db, { intent: "dough" });
    const sd = recs.find((r) => r.course_id === "sourdough_starter")!;
    expect(sd.eligible).toBe(true);
    const yeastReason = sd.reasons.find((x) => x.tier === "yeast")!;
    expect(yeastReason.verdict).toBe("mismatch");
  });

  it("ineligible course's reasons array still has length 9 with neutral fillers after the failing gate", () => {
    const recs = recommendCourse(baseRecipe, db);
    const gf = recs.find((r) => r.course_id === "gluten_free")!;
    expect(gf.reasons.length).toBe(9);
    const dietaryIdx = gf.reasons.findIndex((x) => x.tier === "dietary");
    for (let i = dietaryIdx + 1; i < gf.reasons.length; i++) {
      expect(gf.reasons[i]!.verdict).toBe("neutral");
      expect(gf.reasons[i]!.evidence).toBe("Not evaluated — eligibility failed");
    }
  });
});

describe("recommendCourse — sugar-free dietary gate", () => {
  it("recipe with sugar fails Course 7 Sugar Free", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_test_a01c", ingredient_id: "sugar_granulated", grams: 30 },
      ],
    };
    const recs = recommendCourse(recipe, db);
    const sf = recOf("sugar_free", recs);
    expect(sf!.eligible).toBe(false);
  });

  it("sugar-free recipe (no sugar items) passes Course 7 Sugar Free", () => {
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_test_a01c", ingredient_id: "water_tap", grams: 320 },
        { uid: "u_test_a01d", ingredient_id: "yeast_instant", grams: 6 },
      ],
    };
    const recs = recommendCourse(recipe, db);
    const sf = recOf("sugar_free", recs);
    expect(sf!.eligible).toBe(true);
  });
});

describe("recommendCourse — lexicographic comparator (synthetic-stub tier breaks)", () => {
  // These tests construct stub courses with carefully chosen tier scores so
  // that the lex-sort comparator's per-tier behavior is exercised directly,
  // not just via the catalog's incidental scores.
  function makeStubCourse(partial: Partial<BBPDC20Course> & Pick<BBPDC20Course, "id" | "course_number" | "name">): BBPDC20Course {
    return {
      total_minutes: 200,
      stages: [],
      bakes: true,
      loaf_sizes: ["1.5lb", "2lb"],
      crust_shades: ["medium"],
      inclusions_beep: false,
      dietary_modes: [],
      recommended_for: [],
      yeast_compatibility: ["instant"],
      confidence: "verified",
      sources: [],
      ...partial,
    };
  }

  it("tier 1 (confidence) decides ranking when no other tier differs", () => {
    const stubDb: Database = {
      ...db,
      courses: [
        makeStubCourse({ id: "stub_a", course_number: 99, name: "Stub A", confidence: "community" }),
        makeStubCourse({ id: "stub_b", course_number: 100, name: "Stub B", confidence: "verified" }),
      ],
    };
    const recipe: Recipe = { schema_version: "2.0", items: [{ uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 }] };
    const recs = recommendCourse(recipe, stubDb);
    // Verified beats community — stub_b ranks first despite higher course_number.
    expect(recs[0]!.course_id).toBe("stub_b");
    expect(recs[1]!.course_id).toBe("stub_a");
  });

  it("tier 2 (hydration) breaks tier-1 ties", () => {
    const stubDb: Database = {
      ...db,
      courses: [
        makeStubCourse({ id: "stub_close", course_number: 99, name: "Stub Close", hydration_range: { min_pct: 55, max_pct: 65, ideal_pct: 60 } }),
        makeStubCourse({ id: "stub_far",   course_number: 100, name: "Stub Far",   hydration_range: { min_pct: 75, max_pct: 85, ideal_pct: 80 } }),
      ],
    };
    // 320g water / 500g bread_flour = 64% hydration. Closer to stub_close (60%) than stub_far (80%).
    const recipe: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_test_a01c", ingredient_id: "water_tap", grams: 320 },
      ],
    };
    const recs = recommendCourse(recipe, stubDb);
    expect(recs[0]!.course_id).toBe("stub_close");
  });

  it("course_number breaks all-tiers-equal ties (stable, deterministic)", () => {
    const stubDb: Database = {
      ...db,
      courses: [
        makeStubCourse({ id: "stub_z", course_number: 100, name: "Stub Z" }),
        makeStubCourse({ id: "stub_a", course_number: 99, name: "Stub A" }),
      ],
    };
    const recipe: Recipe = { schema_version: "2.0", items: [] };
    const recs = recommendCourse(recipe, stubDb);
    // All scores tie → course_number ascending → stub_a (99) before stub_z (100).
    expect(recs[0]!.course_id).toBe("stub_a");
    expect(recs[1]!.course_id).toBe("stub_z");
  });
});

describe("resolveCourse", () => {
  it("returns user pick with source='user' when recipe.course is set + valid", () => {
    const recipe: Recipe = { schema_version: "2.0", course: "white", items: [] };
    const r = resolveCourse(recipe, db);
    expect(r).not.toBeNull();
    expect(r!.course.id).toBe("white");
    expect(r!.source).toBe("user");
  });

  it("returns null when recipe.course is set to unknown id (no fallback)", () => {
    const recipe: Recipe = { schema_version: "2.0", course: "made_up", items: [] };
    expect(resolveCourse(recipe, db)).toBeNull();
  });

  it("returns top recommendation with source='recommended' when recipe.course is unset", () => {
    const recipe: Recipe = { schema_version: "2.0", items: [{ uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 }] };
    const r = resolveCourse(recipe, db);
    expect(r).not.toBeNull();
    expect(r!.source).toBe("recommended");
  });

  it("returns null when there are no eligible courses", () => {
    const stubDb: Database = { ...db, courses: [] };
    const recipe: Recipe = { schema_version: "2.0", items: [] };
    expect(resolveCourse(recipe, stubDb)).toBeNull();
  });

  it("does NOT apply eligibility check on user-set courses (renders verbatim)", () => {
    // Recipe is wheat-based; user explicitly chose Gluten Free. resolveCourse
    // returns the user pick anyway. Eligibility violations surface in warnings,
    // not here.
    const recipe: Recipe = {
      schema_version: "2.0",
      course: "gluten_free",
      items: [{ uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 }],
    };
    const r = resolveCourse(recipe, db);
    expect(r).not.toBeNull();
    expect(r!.course.id).toBe("gluten_free");
    expect(r!.source).toBe("user");
  });
});
