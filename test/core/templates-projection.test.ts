import { describe, it, expect } from "vitest";
import type { Database } from "../../src/core/index.js";
import {
  templateToRecipe,
  deriveTemplateTotals,
  type RawTemplateEntry,
} from "../../src/core/templates-projection.js";

// Minimal db with the ingredients used by the fixture below. The test seeds
// just enough to satisfy computeRecipe.
const db: Database = {
  ingredients: [
    { id: "water_tap", name: "Water (tap)", category: "liquids", is_liquid: true,
      water_pct: 100, salt_pct: 0, sugar_pct: 0, fat_pct: 0,
      free_water_factor: 1.0, density_g_per_cup: 236 } as never,
    { id: "salt_table", name: "Salt (table)", category: "salt", is_liquid: false,
      water_pct: 0, salt_pct: 100, sugar_pct: 0, fat_pct: 0,
      free_water_factor: 0, density_g_per_cup: 273 } as never,
  ] as never,
  flours: [
    { id: "bread_flour", name: "Bread flour",
      water_pct: 14, protein_pct: 12.7, ash_pct: 0.5, density_g_per_cup: 130,
      water_absorption_pct: 62 } as never,
  ] as never,
  references: [],
  machines: [
    { id: "zojirushi_bb_pdc20", name: "Zojirushi BB-PDC20", bake_loss_pct: 13 } as never,
  ] as never,
  courses: [],
  defaults: {
    default_machine_id: "zojirushi_bb_pdc20",
    default_bake_loss_pct: 13,
    default_free_water_factors_by_category: { flour: 0 },
  } as never,
};

const entry: RawTemplateEntry = {
  id: "test_white",
  name: "Test White",
  course: "White (Course 1)",
  items: [
    { ingredient_id: "bread_flour", grams: 500 },
    { ingredient_id: "water_tap", grams: 300 },
    { ingredient_id: "salt_table", grams: 10 },
  ],
};

describe("templates-projection", () => {
  it("templateToRecipe returns a v2.0 recipe with fresh uids", () => {
    const r1 = templateToRecipe(entry);
    expect(r1.schema_version).toBe("2.0");
    expect(r1.name).toBe("Test White");
    expect(r1.machine).toBe("zojirushi_bb_pdc20");
    expect(r1.items.length).toBe(3);
    expect(r1.items[0]!.uid).toMatch(/^[A-Za-z0-9_-]{8,16}$/);
    // Two calls produce DIFFERENT uids
    const r2 = templateToRecipe(entry);
    expect(r2.items[0]!.uid).not.toBe(r1.items[0]!.uid);
  });

  it("templateToRecipe carries notes when present", () => {
    const r = templateToRecipe({ ...entry, notes: "soft crumb" });
    expect(r.notes).toBe("soft crumb");
  });

  it("templateToRecipe omits notes key when absent (exactOptionalPropertyTypes)", () => {
    const r = templateToRecipe(entry);
    expect("notes" in r).toBe(false);
  });

  it("deriveTemplateTotals returns water/flour/hydration/zone", () => {
    const recipe = templateToRecipe(entry);
    const t = deriveTemplateTotals(recipe, db);
    expect(t.total_water_g).toBe(300);
    expect(t.total_flour_g).toBe(500);
    // Nominal hydration: 300/500 * 100 = 60%
    expect(t.hydration_pct_nominal).toBeCloseTo(60, 1);
    // 60% lands in 'sandwich' zone
    expect(t.zone).toBe("sandwich");
  });
});
