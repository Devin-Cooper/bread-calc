import type { Database, Recipe } from "../core/index.js";
import { solveWithError } from "../core/index.js";

// In target mode (target_loaf_g set), produce a rescaled recipe so downstream
// readers (compute, chart, table) see grams populated for the chosen target.
//
// Two paths:
//
//   1. Recipe has at least one bakers_pct set → run the solver. The solver
//      treats fixed-grams items as fixed, distributes the remaining mass
//      across pct-only items by their pcts. This is the "user is thinking
//      in baker's percent" path.
//
//   2. Recipe is grams-only (no bakers_pct anywhere) → proportionally
//      rescale every item by target_total / current_total. This is the
//      "user clicked the Size toggle on a hand-entered recipe and expects
//      the whole thing to scale" path.
//
// Both honor bake_loss_pct: target_loaf_g is the BAKED weight, so the
// pre-bake total is target_loaf_g / (1 - bake_loss_pct / 100).
export function effectiveRecipe(state: Recipe, db: Database): Recipe {
  if (state.target_loaf_g == null) return state;

  const hasPct = state.items.some((i) => i.bakers_pct != null);
  if (hasPct) {
    const result = solveWithError(state, db);
    return result.error ? state : result.recipe;
  }

  // Grams-only recipe: proportional rescale.
  const bake_loss_pct = state.bake_loss_pct ?? db.defaults.default_bake_loss_pct;
  const total_mass_target = state.target_loaf_g / (1 - bake_loss_pct / 100);
  const current_total = state.items.reduce((s, i) => s + (i.grams ?? 0), 0);
  if (current_total === 0) return state;
  const scale = total_mass_target / current_total;
  return {
    ...state,
    items: state.items.map((i) => ({ ...i, grams: (i.grams ?? 0) * scale })),
  };
}
