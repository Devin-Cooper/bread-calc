import type { Recipe, Database } from "./types.js";
import { inferRole } from "./role.js";

export type SolverError = "solver_overconstrained" | "solver_ambiguous_flour" | "target_loaf_g_ignored_no_pcts";

export interface SolveResult {
  recipe: Recipe;
  error: SolverError | null;
}

function roleOf(item: Recipe["items"][number], db: Database): string {
  if (item.role) return item.role;
  const flour = db.flours.find((f) => f.id === item.ingredient_id);
  if (flour) return "flour";
  const ing = db.ingredients.find((i) => i.id === item.ingredient_id);
  if (!ing) return "inclusion";
  return inferRole(ing.category, ing.is_liquid);
}

export function solveWithError(recipe: Recipe, db: Database): SolveResult {
  if (recipe.target_loaf_g == null) return { recipe, error: null };

  const items = recipe.items;
  const fixed = items.filter((i) => i.grams != null);
  const pct = items.filter((i) => i.grams == null && i.bakers_pct != null);

  if (pct.length === 0) return { recipe, error: "target_loaf_g_ignored_no_pcts" };

  const fixedFlour = fixed.filter((i) => roleOf(i, db) === "flour");
  if (fixedFlour.length > 0 && pct.length > 0) {
    return { recipe, error: "solver_ambiguous_flour" };
  }

  const bake_loss_pct = recipe.bake_loss_pct ?? db.defaults.default_bake_loss_pct;
  const total_mass_target = recipe.target_loaf_g / (1 - bake_loss_pct / 100);
  const fixed_grams_total = fixed.reduce((s, i) => s + (i.grams ?? 0), 0);
  const remaining = total_mass_target - fixed_grams_total;
  if (remaining <= 0) return { recipe, error: "solver_overconstrained" };

  const sum_of_pcts = pct.reduce((s, i) => s + (i.bakers_pct ?? 0), 0);
  if (sum_of_pcts === 0) return { recipe, error: "target_loaf_g_ignored_no_pcts" };

  const total_flour_unfixed = (remaining * 100) / sum_of_pcts;

  const newItems = items.map((i) => {
    if (i.grams != null) return i;
    if (i.bakers_pct == null) return i;
    return { ...i, grams: (total_flour_unfixed * i.bakers_pct) / 100 };
  });
  return { recipe: { ...recipe, items: newItems }, error: null };
}

export function solveRecipe(recipe: Recipe, db: Database): Recipe {
  return solveWithError(recipe, db).recipe;
}
