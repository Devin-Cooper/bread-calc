import { describe, it, expect } from "vitest";
import { convert } from "../../src/agent/convert.js";
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
  courses:     [],
  defaults:    defaultsRaw as any,
};

describe("convert", () => {
  it("g passes through unchanged", () => {
    const r = convert({ qty: 100, unit: "g", ingredient_id: "bread_flour" }, db);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.grams).toBe(100);
  });

  it("kg → g", () => {
    const r = convert({ qty: 1, unit: "kg", ingredient_id: "bread_flour" }, db);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.grams).toBe(1000);
  });

  it("oz → g (28.3495 g/oz)", () => {
    const r = convert({ qty: 1, unit: "oz", ingredient_id: "bread_flour" }, db);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.grams).toBeCloseTo(28.3495, 3);
  });

  it("cup uses density_g_per_cup directly", () => {
    // water_tap density_g_per_cup = 237 in v2.0 data (kept as-is from USDA).
    const r = convert({ qty: 1, unit: "cup", ingredient_id: "water_tap" }, db);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.grams).toBe(237);
  });

  it("tbsp = 1/16 cup", () => {
    const r = convert({ qty: 16, unit: "tbsp", ingredient_id: "water_tap" }, db);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.grams).toBeCloseTo(237, 3);
  });

  it("tsp = 1/48 cup", () => {
    const r = convert({ qty: 48, unit: "tsp", ingredient_id: "water_tap" }, db);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.grams).toBeCloseTo(237, 3);
  });

  it("ml uses 240 ml = 1 cup definition", () => {
    const r = convert({ qty: 240, unit: "ml", ingredient_id: "water_tap" }, db);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.grams).toBeCloseTo(237, 3);
  });

  it("density_unavailable → ok=false when ingredient lacks density", () => {
    // No real ingredients lack density today; force one by manipulating db copy.
    const stripped: Database = {
      ...db,
      ingredients: db.ingredients.map((i) =>
        i.id === "water_tap" ? { ...i, density_g_per_cup: null } : i,
      ),
    };
    const r = convert({ qty: 1, unit: "cup", ingredient_id: "water_tap" }, stripped);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.warnings.some((w) => w.code === "density_unavailable")).toBe(true);
  });

  it("unsupported_unit → ok=false", () => {
    const r = convert({ qty: 1, unit: "stick" as never, ingredient_id: "butter_unsalted" }, db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.warnings.some((w) => w.code === "unsupported_unit")).toBe(true);
  });

  it("unknown_ingredient_id → ok=false", () => {
    const r = convert({ qty: 1, unit: "g", ingredient_id: "not_a_real_ingredient" }, db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.warnings.some((w) => w.code === "unknown_ingredient_id")).toBe(true);
  });

  it("zero qty produces grams=0 with ok=true (legitimate, not a failure)", () => {
    const r = convert({ qty: 0, unit: "g", ingredient_id: "bread_flour" }, db);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.grams).toBe(0);
  });
});
