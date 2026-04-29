import { describe, it, expect } from "vitest";
import { verifyClaims } from "../../src/agent/verify.js";
import type { Database, Recipe } from "../../src/core/types.js";
import ingredientsFile from "../../src/data/ingredients.json" with { type: "json" };
import floursFile from "../../src/data/flours.json" with { type: "json" };
import refsFile from "../../src/data/bb_pdc20_recipes.json" with { type: "json" };
import machinesFile from "../../src/data/machines.json" with { type: "json" };
import defaultsRaw from "../../src/data/defaults.json" with { type: "json" };

/* eslint-disable @typescript-eslint/no-explicit-any */
const db: Database = {
  ingredients: (ingredientsFile as any).entries,
  flours:      (floursFile as any).entries,
  references:  (refsFile as any).entries,
  machines:    (machinesFile as any).entries,
  defaults:    defaultsRaw as any,
};

const r: Recipe = {
  schema_version: "2.0",
  items: [
    { uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 553 },
    { uid: "u_water001", ingredient_id: "water_tap",   grams: 326 },
  ],
};

describe("verifyClaims", () => {
  it("all_match=true when claims match computed metrics", () => {
    const r1 = verifyClaims(r, { "metrics.total_flour_g": 553, "metrics.total_water_g_nominal": 326 }, db);
    expect(r1.all_match).toBe(true);
    for (const res of r1.results) expect(res.match).toBe(true);
  });

  it("all_match=false when a claim diverges", () => {
    const r1 = verifyClaims(r, { "metrics.total_flour_g": 999 }, db);
    expect(r1.all_match).toBe(false);
    expect(r1.results[0]!.match).toBe(false);
    expect(r1.results[0]!.diff).toBeCloseTo(999 - 553, 5);
  });

  it("supports hydration paths", () => {
    const r1 = verifyClaims(r, { "hydration.nominal_pct": 58.95 }, db);
    expect(r1.all_match).toBe(true);
  });

  it("returns error: unsupported_path for paths outside the closed grammar", () => {
    const r1 = verifyClaims(r, { "nonsense.path": 1 }, db);
    expect(r1.results[0]!.match).toBe(false);
    expect(r1.results[0]!.actual).toBeNull();
    expect(r1.results[0]!.error).toBe("unsupported_path");
  });

  it("returns error: unknown_path for supported-prefix paths that don't resolve", () => {
    const r1 = verifyClaims(r, { "bakers_percents.by_uid.u_no_such_uid": 100 }, db);
    expect(r1.results[0]!.match).toBe(false);
    expect(r1.results[0]!.error).toBe("unknown_path");
  });

  it("supports null claims (matching null actuals)", () => {
    const noFlour = { ...r, items: [{ uid: "u_water002", ingredient_id: "water_tap", grams: 100 }] };
    const r1 = verifyClaims(noFlour, { "hydration.effective_pct": null }, db);
    expect(r1.all_match).toBe(true);
  });
});
