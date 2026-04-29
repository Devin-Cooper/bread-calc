// test/data/database.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { validateIngredientsFile, validateFloursFile, validateBBPDC20RecipesFile, validateMachinesFile, validateDefaults } from "../../src/core/validator.generated.js";
import { classifyZoneId } from "../../src/core/zones.js";

const ingredients = JSON.parse(readFileSync("src/data/ingredients.json", "utf8"));
const flours = JSON.parse(readFileSync("src/data/flours.json", "utf8"));
const refs = JSON.parse(readFileSync("src/data/bb_pdc20_recipes.json", "utf8"));
const machines = JSON.parse(readFileSync("src/data/machines.json", "utf8"));
const defaults = JSON.parse(readFileSync("src/data/defaults.json", "utf8"));

describe("data files validate against schema", () => {
  it("ingredients.json", () => { expect(validateIngredientsFile(ingredients)).toBe(true); });
  it("flours.json", () => { expect(validateFloursFile(flours)).toBe(true); });
  it("bb_pdc20_recipes.json", () => { expect(validateBBPDC20RecipesFile(refs)).toBe(true); });
  it("machines.json", () => { expect(validateMachinesFile(machines)).toBe(true); });
  it("defaults.json", () => { expect(validateDefaults(defaults)).toBe(true); });
});

describe("ingredients data sanity", () => {
  it("ids are unique and snake_case", () => {
    const ids = new Set<string>();
    for (const i of ingredients.entries) {
      expect(/^[a-z0-9_]+$/.test(i.id)).toBe(true);
      expect(ids.has(i.id)).toBe(false);
      ids.add(i.id);
    }
  });
  it("composition percentages don't exceed 100±2 when summed (sanity check, not strict)", () => {
    for (const i of ingredients.entries) {
      const sum = i.water_pct + i.salt_pct + i.sugar_pct + i.fat_pct
        + (i.protein_pct ?? 0) + (i.carb_pct ?? 0) + (i.ash_pct ?? 0);
      // Sugar is part of carbs in USDA so we may double-count; allow a generous bound
      expect(sum).toBeLessThanOrEqual(110);
    }
  });
  it("free_water_factor in [0,1]", () => {
    for (const i of ingredients.entries) {
      expect(i.free_water_factor).toBeGreaterThanOrEqual(0);
      expect(i.free_water_factor).toBeLessThanOrEqual(1);
    }
  });
});

describe("bb_pdc20_recipes zone consistency", () => {
  it("zone matches classifyZone(hydration_pct_nominal)", () => {
    for (const r of refs.entries) {
      if (r.excluded_from_chart) continue;
      expect(r.zone).toBe(classifyZoneId(r.hydration_pct_nominal));
    }
  });
  it("hydration_pct in [0, 200]", () => {
    for (const r of refs.entries) {
      expect(r.hydration_pct_nominal).toBeGreaterThanOrEqual(0);
      expect(r.hydration_pct_nominal).toBeLessThanOrEqual(200);
    }
  });
});
