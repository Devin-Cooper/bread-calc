export { applyFix } from "./fix.js";
export { convert } from "./convert.js";
export type { ConvertResult, ConvertWarning } from "./convert.js";
export { lookupIngredient } from "./lookup.js";
export type { LookupResult } from "./lookup.js";
export { parseText } from "./parse.js";
export type { ParseFailure } from "./parse.js";
export { verifyClaims } from "./verify.js";
export type { VerifyReport } from "./verify.js";
export { renderNarrative } from "./explain.js";
export { describe } from "./describe.js";
export type { CapabilityManifest, SubcommandSpec, WarningRuleSpec, FixKindSpec, ExplainNodeTypeSpec } from "./describe.js";
export { getExamples } from "./examples.js";
export type { ExampleEntry } from "./examples.js";

// Re-export core types referenced in agent function signatures so consumers
// of bread-calc/agent can type their inputs/outputs without reaching into
// bread-calc directly.
export type {
  Recipe, RecipeItem, Database, Fix, ApplyFixResult, ApplyFixError, ApplyFixErrorCode,
  ZoneId, HydrationZone, Category, Role, Warning, WarningCode, ComputedRecipe,
} from "../core/types.js";
