import type { Database, Recipe } from "./types.js";

/* Dataset constants — ground-truthed against src/data/flours.json + src/data/ingredients.json */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _GF_FLOUR_IDS: ReadonlySet<string> = new Set([
  "gf_flour_blend",
  "buckwheat_flour",
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _WHOLE_GRAIN_FLOUR_IDS: ReadonlySet<string> = new Set([
  "whole_wheat_flour", "white_whole_wheat_flour",
  "spelt_flour", "einkorn_flour", "kamut_flour",
  "rye_flour_dark", "rye_flour_light",
  "buckwheat_flour",
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _PLANT_MILK_ALLOWLIST: ReadonlySet<string> = new Set([
  "almond_milk_unsweetened",
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _VEGAN_EGG_SUBSTITUTE_IDS: ReadonlySet<string> = new Set([
  "aquafaba",
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _RECIPE_TAG_VOCAB: ReadonlySet<string> = new Set([
  "high_hydration", "whole_wheat", "multigrain",
  "white_flour", "sandwich_loaf",
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _DAIRY_ID_PATTERN = /milk|cream|butter|whey/;

/* Public types */

export type RecommendationTier =
  | "intent" | "dietary"
  | "confidence" | "hydration" | "whole_wheat"
  | "yeast" | "crust_shade" | "loaf_size"
  | "recommended_for";

export type RecommendationVerdict = "match" | "mismatch" | "neutral";

export interface RecommendationReason {
  readonly tier: RecommendationTier;
  readonly verdict: RecommendationVerdict;
  readonly evidence: string;
}

export interface CourseRecommendation {
  readonly course_id: string;
  readonly rank: number | null;
  readonly eligible: boolean;
  readonly reasons: readonly RecommendationReason[];
}

export interface RecommendOpts {
  readonly intent?: "bake" | "dough";
}

/* Stub function — real algorithm lands across Phases 2-3 */

export function recommendCourse(
  _recipe: Recipe,
  db: Database,
  _opts?: RecommendOpts,
): readonly CourseRecommendation[] {
  void _recipe;
  void _opts;
  return db.courses
    .slice()
    .sort((a, b) => a.course_number - b.course_number)
    .map((c, i) => ({
      course_id: c.id,
      rank: i + 1,
      eligible: true,
      reasons: [],
    }));
}
