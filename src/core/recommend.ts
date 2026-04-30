import type { BBPDC20Course, Database, Recipe } from "./types.js";

/* Dataset constants — ground-truthed against src/data/flours.json + src/data/ingredients.json */

const GF_FLOUR_IDS: ReadonlySet<string> = new Set([
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

const PLANT_MILK_ALLOWLIST: ReadonlySet<string> = new Set([
  "almond_milk_unsweetened",
]);

const VEGAN_EGG_SUBSTITUTE_IDS: ReadonlySet<string> = new Set([
  "aquafaba",
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _RECIPE_TAG_VOCAB: ReadonlySet<string> = new Set([
  "high_hydration", "whole_wheat", "multigrain",
  "white_flour", "sandwich_loaf",
]);

const DAIRY_ID_PATTERN = /milk|cream|butter|whey/;

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

/* Dietary derivation helpers */

interface DietaryFacts {
  readonly is_gluten_free: boolean;
  readonly is_vegan: boolean;
  readonly is_egg_free: boolean;
  readonly is_salt_free: boolean;
  readonly is_sugar_free: boolean;
}

function deriveDietary(recipe: Recipe, db: Database): DietaryFacts {
  const flourLookup = new Map(db.flours.map((f) => [f.id, f]));
  const ingrLookup = new Map(db.ingredients.map((i) => [i.id, i]));

  let isGlutenFree = true;
  let isSaltFree = true;
  let isSugarFree = true;
  let hasEggIngredient = false;
  let hasDairyIngredient = false;

  for (const item of recipe.items) {
    const flour = flourLookup.get(item.ingredient_id);
    if (flour) {
      if (!GF_FLOUR_IDS.has(flour.id)) isGlutenFree = false;
      continue;
    }
    const ingr = ingrLookup.get(item.ingredient_id);
    if (!ingr) continue;

    if (ingr.salt_pct > 0) isSaltFree = false;
    if (ingr.sugar_pct > 0) isSugarFree = false;

    if (ingr.category === "eggs" && !VEGAN_EGG_SUBSTITUTE_IDS.has(ingr.id)) {
      hasEggIngredient = true;
    }

    if (ingr.category === "cheese") {
      hasDairyIngredient = true;
    } else if (
      (ingr.category === "liquids" || ingr.category === "fats") &&
      DAIRY_ID_PATTERN.test(ingr.id) &&
      !PLANT_MILK_ALLOWLIST.has(ingr.id)
    ) {
      hasDairyIngredient = true;
    }
  }

  const isEggFree = !hasEggIngredient;
  const isVegan = isEggFree && !hasDairyIngredient;

  return { is_gluten_free: isGlutenFree, is_vegan: isVegan, is_egg_free: isEggFree, is_salt_free: isSaltFree, is_sugar_free: isSugarFree };
}

function evaluateDietaryGate(course: BBPDC20Course, dietary: DietaryFacts): RecommendationReason {
  const required = course.dietary_modes;
  if (required.length === 0) {
    return { tier: "dietary", verdict: "neutral", evidence: "Course has no dietary requirements" };
  }
  const failed: string[] = [];
  for (const mode of required) {
    if (mode === "gluten_free" && !dietary.is_gluten_free) failed.push("gluten_free");
    if (mode === "vegan" && !dietary.is_vegan) failed.push("vegan");
    if (mode === "egg_free" && !dietary.is_egg_free) failed.push("egg_free");
    if (mode === "salt_free" && !dietary.is_salt_free) failed.push("salt_free");
    if (mode === "sugar_free" && !dietary.is_sugar_free) failed.push("sugar_free");
  }
  if (failed.length === 0) {
    return { tier: "dietary", verdict: "match", evidence: `Recipe satisfies course requirements: ${required.join(", ")}` };
  }
  return { tier: "dietary", verdict: "mismatch", evidence: `Course requires ${failed.join(", ")} but recipe is not` };
}

/* Intent gate helper */

function evaluateIntentGate(course: BBPDC20Course, opts: RecommendOpts | undefined): RecommendationReason {
  const intent = opts?.intent;
  if (intent === undefined) {
    return { tier: "intent", verdict: "neutral", evidence: "No intent specified" };
  }
  if (intent === "bake" && !course.bakes) {
    return { tier: "intent", verdict: "mismatch", evidence: "Course is dough-only; intent=bake" };
  }
  if (intent === "dough" && course.bakes) {
    return { tier: "intent", verdict: "mismatch", evidence: "Course bakes a loaf; intent=dough" };
  }
  return { tier: "intent", verdict: "match", evidence: `Course matches intent=${intent}` };
}

/* Public function */

export function recommendCourse(
  recipe: Recipe,
  db: Database,
  opts?: RecommendOpts,
): readonly CourseRecommendation[] {
  const dietary = deriveDietary(recipe, db);
  return db.courses
    .slice()
    .sort((a, b) => a.course_number - b.course_number)
    .map((course, i) => {
      const intentReason = evaluateIntentGate(course, opts);
      const dietaryReason = evaluateDietaryGate(course, dietary);
      const eligible = intentReason.verdict !== "mismatch" && dietaryReason.verdict !== "mismatch";
      return {
        course_id: course.id,
        rank: eligible ? i + 1 : null,
        eligible,
        reasons: [intentReason, dietaryReason],
      };
    });
}
