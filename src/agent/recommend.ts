import type { Database, Recipe } from "../core/types.js";
import { recommendCourse, type CourseRecommendation, type RecommendOpts } from "../core/recommend.js";

export interface RecommendReport {
  readonly recommendations: readonly CourseRecommendation[];
}

export function recommend(
  recipe: Recipe,
  db: Database,
  opts?: RecommendOpts,
): RecommendReport {
  return { recommendations: recommendCourse(recipe, db, opts) };
}
