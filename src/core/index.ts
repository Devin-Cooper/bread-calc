// src/core/index.ts — public library API
export { computeRecipe } from "./compute.js";
export { solveRecipe, solveWithError } from "./solve.js";
export type { SolverError, SolveResult } from "./solve.js";
export { validateRecipe } from "./validate.js";
export { classifyZone, classifyZoneId, HYDRATION_ZONES } from "./zones.js";
export { inferRole, CATEGORY_ROLE_MAP } from "./role.js";
export { escapeXml, escapeHtml } from "./escape.js";
export { computeWeightedDdtWa } from "./flour.js";
export { renderHydrationChart } from "./plot.js";
export type { ChartOptions } from "./plot.js";
export { generateUid } from "./uid.js";
export { templateToRecipe, deriveTemplateTotals } from "./templates-projection.js";
export type { RawTemplateEntry, RawTemplateItem, TemplateTotals } from "./templates-projection.js";
export type {
  Recipe, RecipeItem, ComputedRecipe, Ingredient, Flour, Database, Defaults, Machine,
  Warning, WarningCode, IngredientFlag, Role, Category, ZoneId, HydrationZone, BBPDC20Recipe,
  RecipeValidationResult, CrustShade, LoafSize,
  ExplainNode, ExplainTree,
  ConstantNode, ProjectFieldNode, SumNode, WeightedSumNode, ProductNode, RatioNode, ScaleNode, ProjectFromTreeNode,
  BBPDC20StageName, BBPDC20Stage, BBPDC20Course,
  BBPDC20LoafSize, BBPDC20CrustShade, BBPDC20DietaryMode,
  BBPDC20YeastCompat, BBPDC20Confidence,
} from "./types.js";
export { RecipeValidationError } from "./types.js";
