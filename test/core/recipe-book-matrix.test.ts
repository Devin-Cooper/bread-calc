import { describe, it, expect } from "vitest";
import { recommendCourse } from "../../src/core/recommend.js";
import type { BBPDC20Course, Database, Defaults, Flour, Ingredient, Machine, Recipe } from "../../src/core/types.js";
import ingredientsFile from "../../src/data/ingredients.json" with { type: "json" };
import floursFile from "../../src/data/flours.json" with { type: "json" };
import coursesFile from "../../src/data/bb_pdc20_courses.json" with { type: "json" };
import machinesFile from "../../src/data/machines.json" with { type: "json" };
import defaultsRaw from "../../src/data/defaults.json" with { type: "json" };
import matrixFile from "../../src/data/bb_pdc20_recipe_matrix.json" with { type: "json" };

interface MatrixEntry {
  readonly name: string;
  readonly canonical_course: string;
  readonly canonical_family: readonly string[];
  readonly recipe: Recipe;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const db: Database = {
  ingredients: (ingredientsFile as any).entries as Ingredient[],
  flours:      (floursFile as any).entries as Flour[],
  references:  [],
  machines:    (machinesFile as any).entries as Machine[],
  courses:     (coursesFile as any).entries as BBPDC20Course[],
  defaults:    defaultsRaw as Defaults,
};
const FIXTURES: readonly MatrixEntry[] = (matrixFile as any).entries as MatrixEntry[];
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("BB-PDC20 recipe-book matrix — top-1 exact match per fixture", () => {
  for (const fx of FIXTURES) {
    it(`${fx.name} → ${fx.canonical_course}`, () => {
      const recs = recommendCourse(fx.recipe, db);
      const top = recs.find((r) => r.eligible);
      expect(top?.course_id).toBe(fx.canonical_course);
    });
  }
});

describe("BB-PDC20 recipe-book matrix — aggregate metrics", () => {
  it("top-1 exact match rate is 31/31 (100%)", () => {
    let exact = 0;
    for (const fx of FIXTURES) {
      const top = recommendCourse(fx.recipe, db).find((r) => r.eligible);
      if (top?.course_id === fx.canonical_course) exact++;
    }
    expect(exact).toBe(FIXTURES.length);
  });

  it("top-3 same-family rate is 31/31 (100%)", () => {
    for (const fx of FIXTURES) {
      const top3 = recommendCourse(fx.recipe, db)
        .filter((r) => r.eligible)
        .slice(0, 3)
        .map((r) => r.course_id);
      const matched = top3.some((id) => fx.canonical_family.includes(id));
      expect(
        matched,
        `${fx.name}: top-3 = ${JSON.stringify(top3)}, family = ${JSON.stringify(fx.canonical_family)}`,
      ).toBe(true);
    }
  });
});
