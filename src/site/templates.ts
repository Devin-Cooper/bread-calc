import type { Database, Recipe, ZoneId } from "../core/index.js";
import { templateToRecipe, deriveTemplateTotals, generateUid } from "../core/index.js";
import templatesFile from "../data/bb_pdc20_templates.json" with { type: "json" };

export interface TemplateEntry {
  id: string;
  name: string;
  course: string;
  notes?: string;
  recipe: Recipe;
  totals: TemplateTotals;
}

export interface TemplateTotals {
  total_water_g: number;
  total_flour_g: number;
  hydration_pct_nominal: number;
  zone: ZoneId;
}

let CACHE: TemplateEntry[] | null = null;

export function buildTemplates(db: Database): TemplateEntry[] {
  if (CACHE) return CACHE;
  CACHE = templatesFile.entries.map((entry) => {
    const recipe = templateToRecipe(entry);
    const totals = deriveTemplateTotals(recipe, db);
    return {
      id: entry.id,
      name: entry.name,
      course: entry.course,
      ...(entry.notes ? { notes: entry.notes } : {}),
      recipe,
      totals,
    };
  });
  return CACHE;
}

export function loadTemplate(entry: TemplateEntry): Recipe {
  return {
    ...entry.recipe,
    items: entry.recipe.items.map((it) => ({ ...it, uid: generateUid() })),
  };
}

/** Test-only: clear the module-level cache so tests can re-build. */
export function _resetCache(): void {
  CACHE = null;
}
