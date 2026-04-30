import { describe, it, expect } from "vitest";
import { classifyZoneId } from "../../src/core/index.js";
import templatesFile from "../../src/data/bb_pdc20_templates.json" with { type: "json" };
import recipesFile from "../../src/data/bb_pdc20_recipes.json" with { type: "json" };

const TOL_GRAMS = 1;       // ±1 g on tap water and flour
const TOL_HYDRATION = 0.5; // ±0.5 % on legacy-equivalent hydration

// IMPORTANT: this test cross-checks "legacy-equivalent" metrics, NOT Wave 1's
// metrics.total_water_g_nominal.
//
// `bb_pdc20_recipes.json`'s `total_water_g` is the tap-water grams added directly
// to the dough, and `hydration_pct_nominal` = (total_water_g / total_flour_g) × 100.
//
// Wave 1's `metrics.total_water_g_nominal` is broader — it sums water contributions
// from every liquid-categorized ingredient plus water-by-composition from non-liquids
// (butter ~17.9 %, honey ~17.1 %, etc.). Comparing Wave-1 metrics directly to the
// legacy file produces systematic offsets for any recipe that includes water-bearing
// non-liquids — that's a definitional difference, not a transcription bug.
//
// To catch transcription drift without conflating the two metrics, this test
// derives the LEGACY-equivalent totals from the template's items[] (sum the
// `water_tap` rows, sum the flour rows) and compares those to the legacy file.

const FLOUR_IDS = new Set([
  "bread_flour", "ap_flour", "whole_wheat_flour", "white_whole_wheat_flour",
  "high_gluten_flour", "rye_flour_dark", "rye_flour_light", "spelt_flour",
  "00_flour", "semolina_flour", "einkorn_flour", "kamut_flour",
  "buckwheat_flour", "gf_flour_blend",
]);

interface RawItem { ingredient_id: string; grams: number }

function legacyEquivalentTotals(items: readonly RawItem[]) {
  const tapWater = items.filter((i) => i.ingredient_id === "water_tap")
    .reduce((s, i) => s + i.grams, 0);
  const flour = items.filter((i) => FLOUR_IDS.has(i.ingredient_id))
    .reduce((s, i) => s + i.grams, 0);
  return {
    total_water_g: tapWater,
    total_flour_g: flour,
    hydration_pct_nominal: flour > 0 ? (tapWater / flour) * 100 : 0,
  };
}

interface LegacyRecipe {
  name: string;
  total_water_g: number;
  total_flour_g: number;
  hydration_pct_nominal: number;
  zone: string;
}

describe("template totals cross-check vs. legacy bb_pdc20_recipes.json", () => {
  const legacyEntries = (recipesFile as { entries: LegacyRecipe[] }).entries;
  for (const tpl of templatesFile.entries) {
    const legacy = legacyEntries.find((r) => r.name === tpl.name);
    if (!legacy) continue; // not in legacy file — skip (could be a new template)

    it(`${tpl.name}: legacy-equivalent totals match within tolerance`, () => {
      const totals = legacyEquivalentTotals(tpl.items);

      expect(Math.abs(totals.total_water_g - legacy.total_water_g)).toBeLessThanOrEqual(TOL_GRAMS);
      expect(Math.abs(totals.total_flour_g - legacy.total_flour_g)).toBeLessThanOrEqual(TOL_GRAMS);
      expect(Math.abs(totals.hydration_pct_nominal - legacy.hydration_pct_nominal)).toBeLessThanOrEqual(TOL_HYDRATION);
      // Zone via the same classifier the rest of the project uses. If the
      // template's tap-water hydration falls in a different zone than the
      // legacy's, that's drift worth flagging.
      expect(classifyZoneId(totals.hydration_pct_nominal)).toBe(legacy.zone);
    });
  }
});
