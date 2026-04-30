import { describe, it, expect } from "vitest";
import type { Database } from "../../src/core/index.js";
import { templateToRecipe, deriveTemplateTotals } from "../../src/core/index.js";
import templatesFile from "../../src/data/bb_pdc20_templates.json" with { type: "json" };
import recipesFile from "../../src/data/bb_pdc20_recipes.json" with { type: "json" };
import ingredientsFile from "../../src/data/ingredients.json" with { type: "json" };
import floursFile from "../../src/data/flours.json" with { type: "json" };
import machinesFile from "../../src/data/machines.json" with { type: "json" };
import defaultsRaw from "../../src/data/defaults.json" with { type: "json" };

/* eslint-disable @typescript-eslint/no-explicit-any */
const db: Database = {
  ingredients: (ingredientsFile as any).entries,
  flours:      (floursFile as any).entries,
  references:  (recipesFile as any).entries,
  machines:    (machinesFile as any).entries,
  defaults:    defaultsRaw as any,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const TOL_GRAMS = 1;       // ±1 g on water/flour
const TOL_HYDRATION = 0.5; // ±0.5 % on hydration

describe("template totals cross-check vs. legacy bb_pdc20_recipes.json", () => {
  for (const tpl of templatesFile.entries) {
    const legacy = (recipesFile as any).entries.find((r: any) => r.name === tpl.name);
    if (!legacy) continue; // not in legacy file — skip (could be a new template)

    it(`${tpl.name}: derived totals match legacy within tolerance`, () => {
      const recipe = templateToRecipe(tpl);
      const totals = deriveTemplateTotals(recipe, db);

      expect(Math.abs(totals.total_water_g - legacy.total_water_g)).toBeLessThanOrEqual(TOL_GRAMS);
      expect(Math.abs(totals.total_flour_g - legacy.total_flour_g)).toBeLessThanOrEqual(TOL_GRAMS);
      expect(Math.abs(totals.hydration_pct_nominal - legacy.hydration_pct_nominal)).toBeLessThanOrEqual(TOL_HYDRATION);
      expect(totals.zone).toBe(legacy.zone);
    });
  }
});
