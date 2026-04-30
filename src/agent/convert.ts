import type { Database, Ingredient, Flour } from "../core/types.js";

export interface ConvertWarning {
  code: "density_unavailable" | "volume_inappropriate_for_ingredient" | "unsupported_unit" | "unknown_ingredient_id" | "approximate_density";
  message: string;
}

export type ConvertResult =
  | { ok: true;  grams: number; warnings: ConvertWarning[] }
  | { ok: false; grams: null;   warnings: ConvertWarning[] };

const MASS_TO_G: Record<string, number> = {
  g: 1, kg: 1000, oz: 28.3495231, lb: 453.59237,
};

// Cup is canonical 240 ml (US legal cup, FDA labeling standard).
const CUP_FRACTIONS: Record<string, number> = {
  cup: 1, cups: 1,
  tbsp: 1/16, tablespoon: 1/16, tablespoons: 1/16,
  tsp:  1/48, teaspoon:  1/48, teaspoons:  1/48,
  ml: 1/240,
  l:  1000/240, liter: 1000/240, liters: 1000/240,
  floz: 1/8, "fl oz": 1/8,
};

const VOLUME_INAPPROPRIATE_INGREDIENTS = new Set<string>([
  // Add ingredients here whose densities are inherent-mass (e.g. butter "1 stick").
  // None for v2.0 — the data file has full density coverage.
]);

// Lazy default db: imported at module scope (synchronous JSON imports) so a
// caller can omit the `db` arg and still get the bundled database. Per spec
// §3.4: "`db` is optional everywhere — defaults to the bundled database".
// Trade-off: this pulls the data files into the import graph of every agent
// module that takes `db?`. Tree-shakers see them as side-effect-free pure
// JSON imports, but bundle size grows by ~30 KB minified. Phase 9 verifies
// this is bounded.
import ingredientsFile from "../data/ingredients.json"      with { type: "json" };
import floursFile      from "../data/flours.json"           with { type: "json" };
import refsFile        from "../data/bb_pdc20_recipes.json" with { type: "json" };
import coursesFile     from "../data/bb_pdc20_courses.json" with { type: "json" };
import machinesFile    from "../data/machines.json"         with { type: "json" };
import defaultsRaw     from "../data/defaults.json"         with { type: "json" };

let _defaultDb: Database | null = null;
function defaultDb(): Database {
  if (_defaultDb) return _defaultDb;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  _defaultDb = {
    ingredients: (ingredientsFile as any).entries,
    flours:      (floursFile as any).entries,
    references:  (refsFile as any).entries,
    machines:    (machinesFile as any).entries,
    courses:     (coursesFile as any).entries,
    defaults:    defaultsRaw as any,
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return _defaultDb;
}

export function convert(
  input: { qty: number; unit: string; ingredient_id: string },
  db: Database = defaultDb(),
): ConvertResult {
  const ingredient = (db.ingredients.find((i) => i.id === input.ingredient_id) as Ingredient | undefined)
                  ?? (db.flours.find((f) => f.id === input.ingredient_id) as Flour | undefined);
  if (!ingredient) {
    return { ok: false, grams: null, warnings: [{ code: "unknown_ingredient_id", message: `Unknown ingredient_id: ${input.ingredient_id}` }] };
  }

  const u = input.unit.toLowerCase();
  if (u in MASS_TO_G) {
    return { ok: true, grams: input.qty * MASS_TO_G[u]!, warnings: [] };
  }
  if (u in CUP_FRACTIONS) {
    if (VOLUME_INAPPROPRIATE_INGREDIENTS.has(input.ingredient_id)) {
      return { ok: false, grams: null, warnings: [{
        code: "volume_inappropriate_for_ingredient",
        message: `Volume conversion is inappropriate for ${input.ingredient_id}; use a mass unit (g/oz/lb).`,
      }]};
    }
    const density = (ingredient as { density_g_per_cup?: number | null }).density_g_per_cup;
    if (density == null || density <= 0) {
      return { ok: false, grams: null, warnings: [{
        code: "density_unavailable",
        message: `Ingredient ${input.ingredient_id} lacks density_g_per_cup; cannot convert volume.`,
      }]};
    }
    const cups = input.qty * CUP_FRACTIONS[u]!;
    return { ok: true, grams: cups * density, warnings: [] };
  }
  return { ok: false, grams: null, warnings: [{
    code: "unsupported_unit",
    message: `Unsupported unit "${input.unit}". Supported: g, kg, oz, lb, cup, tbsp, tsp, ml, l, floz.`,
  }]};
}
