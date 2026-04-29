import { describe, it, expect } from "vitest";
import { parseText } from "../../src/agent/parse.js";
import type { Database } from "../../src/core/types.js";
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

describe("parseText", () => {
  it("parses a simple multi-line recipe", () => {
    const text = `
500 g bread_flour
300 g water_tap
1.5 tsp salt_table
`;
    const r = parseText(text, db);
    expect(r.recipe.schema_version).toBe("2.0");
    expect(r.recipe.items.length).toBe(3);
    expect(r.unparseable).toEqual([]);
    expect(r.recipe.items.every((i) => /^[A-Za-z0-9_-]{8,16}$/.test(i.uid))).toBe(true);
  });

  it("emits no_quantity on lines without numbers", () => {
    const r = parseText("a pinch of salt_table", db);
    expect(r.unparseable.length).toBe(1);
    expect(r.unparseable[0]!.reason).toBe("no_quantity");
  });

  it("emits no_unit when only number + word", () => {
    const r = parseText("5 bread_flour", db);
    expect(r.unparseable.length).toBe(1);
    expect(r.unparseable[0]!.reason).toBe("no_unit");
  });

  it("emits no_ingredient when match score is low", () => {
    const r = parseText("100 g xyzzy_nonexistent", db);
    expect(r.unparseable[0]!.reason).toBe("no_ingredient");
  });

  it("supports fractional quantities", () => {
    const r = parseText("1 1/2 tsp salt_table", db);
    expect(r.recipe.items.length).toBe(1);
    expect(r.recipe.items[0]!.grams).toBeGreaterThan(0);
  });

  it("strips inline comments", () => {
    const r = parseText("100 g bread_flour # ap or bread\n50 g water_tap // city water", db);
    expect(r.recipe.items.length).toBe(2);
  });

  it("extracts name from `# title:` comment", () => {
    const r = parseText("# title: My loaf\n500 g bread_flour\n300 g water_tap", db);
    expect(r.recipe.name).toBe("My loaf");
  });

  it("strips inline comments from `# title:` capture", () => {
    const r1 = parseText("# title: My loaf  // a note\n500 g bread_flour\n300 g water_tap", db);
    expect(r1.recipe.name).toBe("My loaf");
    const r2 = parseText("# title: Loaf # also has hash\n500 g bread_flour\n300 g water_tap", db);
    expect(r2.recipe.name).toBe("Loaf");
  });

  it("each parsed item has a unique uid", () => {
    const r = parseText("500 g bread_flour\n500 g bread_flour", db);
    const uids = r.recipe.items.map((i) => i.uid);
    expect(new Set(uids).size).toBe(uids.length);
  });
});
