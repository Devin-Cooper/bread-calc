import { describe, it, expect } from "vitest";
import { runAudit, formatAudit } from "../../src/cli/format/audit.js";
import type { BBPDC20Course, Database, Defaults, Flour, Ingredient, Machine, Recipe } from "../../src/core/types.js";
import ingredientsFile from "../../src/data/ingredients.json" with { type: "json" };
import floursFile from "../../src/data/flours.json" with { type: "json" };
import coursesFile from "../../src/data/bb_pdc20_courses.json" with { type: "json" };
import machinesFile from "../../src/data/machines.json" with { type: "json" };
import defaultsRaw from "../../src/data/defaults.json" with { type: "json" };
import matrixFile from "../../src/data/bb_pdc20_recipe_matrix.json" with { type: "json" };

/* eslint-disable @typescript-eslint/no-explicit-any */
const db: Database = {
  ingredients: (ingredientsFile as any).entries as Ingredient[],
  flours:      (floursFile as any).entries as Flour[],
  references:  [],
  machines:    (machinesFile as any).entries as Machine[],
  courses:     (coursesFile as any).entries as BBPDC20Course[],
  defaults:    defaultsRaw as Defaults,
};
const matrixEntries = (matrixFile as any).entries as Array<{
  name: string; canonical_course: string; canonical_family: string[]; recipe: Recipe;
}>;
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("audit-recommendations", () => {
  it("runAudit reports 31/31 exact match on the BB-PDC20 manual matrix", () => {
    const result = runAudit(matrixEntries, db);
    expect(result.total).toBe(31);
    expect(result.exact).toBe(31);
    expect(result.mismatch).toBe(0);
  });

  it("formatAudit text output contains the exact-match line", () => {
    const result = runAudit(matrixEntries, db);
    const text = formatAudit(result, db);
    expect(text).toContain("exact:       31/31");
  });

  it("formatAudit json output is valid JSON with the expected shape", () => {
    const result = runAudit(matrixEntries, db);
    const json = formatAudit(result, db, { json: true });
    const parsed = JSON.parse(json);
    expect(parsed.total).toBe(31);
    expect(parsed.exact).toBe(31);
    expect(Array.isArray(parsed.rows)).toBe(true);
  });
});
