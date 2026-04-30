import type { Database, Recipe, ZoneId } from "./types.js";
import { computeRecipe } from "./compute.js";
import { generateUid } from "./uid.js";

export interface RawTemplateItem {
  ingredient_id: string;
  grams: number;
}

export interface RawTemplateEntry {
  id: string;
  name: string;
  course: string;
  notes?: string;
  items: RawTemplateItem[];
}

export interface TemplateTotals {
  total_water_g: number;
  total_flour_g: number;
  hydration_pct_nominal: number;
  zone: ZoneId;
}

/**
 * Build a fresh-uid v2.0 Recipe from a raw template entry. Two calls with the
 * same entry return two recipes with different uids; the rest of the data is
 * identical.
 */
export function templateToRecipe(entry: RawTemplateEntry): Recipe {
  return {
    schema_version: "2.0",
    name: entry.name,
    machine: "zojirushi_bb_pdc20",
    ...(entry.notes !== undefined ? { notes: entry.notes } : {}),
    items: entry.items.map((it) => ({
      uid: generateUid(),
      ingredient_id: it.ingredient_id,
      grams: it.grams,
    })),
  };
}

/**
 * Derive TemplateTotals from a Recipe. Pure projection over computeRecipe;
 * does not mutate the recipe and does not throw if the recipe is well-formed.
 */
export function deriveTemplateTotals(recipe: Recipe, db: Database): TemplateTotals {
  const computed = computeRecipe(recipe, db);
  return {
    total_water_g: computed.metrics.total_water_g_nominal,
    total_flour_g: computed.metrics.total_flour_g,
    hydration_pct_nominal: computed.hydration.nominal_pct ?? 0,
    zone: computed.hydration.zone?.id ?? "sandwich",
  };
}
