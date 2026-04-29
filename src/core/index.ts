// src/core/index.ts — public library API
export { computeRecipe } from "./compute.js";
export { solveRecipe, solveWithError } from "./solve.js";
export type { SolverError, SolveResult } from "./solve.js";
export { validateRecipe } from "./validate.js";
export { classifyZone, HYDRATION_ZONES } from "./zones.js";
export { inferRole, CATEGORY_ROLE_MAP } from "./role.js";
export { escapeXml, escapeHtml } from "./escape.js";
export { computeWeightedDdtWa } from "./flour.js";
export { renderHydrationChart } from "./plot.js";
export type { ChartOptions } from "./plot.js";
export type {
  Recipe, RecipeItem, ComputedRecipe, Ingredient, Flour, Database, Defaults, Machine,
  Warning, WarningCode, IngredientFlag, Role, Category, ZoneId, BBPDC20Recipe,
  RecipeValidationResult,
} from "./types.js";
export { RecipeValidationError } from "./types.js";
