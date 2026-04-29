import type { Database, Recipe } from "../core/index.js";
import { solveWithError } from "../core/index.js";

// In target mode (target_loaf_g set + at least one bakers_pct), run the solver
// so downstream readers (compute, chart, table) see grams populated from the
// percentages. Falls back to the raw recipe if the solver returns an error
// (e.g. ambiguous flour, no pcts) — the warnings panel surfaces those upstream.
export function effectiveRecipe(state: Recipe, db: Database): Recipe {
  if (state.target_loaf_g == null) return state;
  const hasPct = state.items.some((i) => i.bakers_pct != null);
  if (!hasPct) return state;
  const result = solveWithError(state, db);
  return result.error ? state : result.recipe;
}
