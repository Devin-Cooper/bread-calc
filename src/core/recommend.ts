import type { BBPDC20Course, Database, Recipe } from "./types.js";
import { computeRecipe } from "./compute.js";

/* Dataset constants — ground-truthed against src/data/flours.json + src/data/ingredients.json */

const GF_FLOUR_IDS: ReadonlySet<string> = new Set([
  "gf_flour_blend",
  "buckwheat_flour",
]);

const WHOLE_GRAIN_FLOUR_IDS: ReadonlySet<string> = new Set([
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

const RECIPE_TAG_VOCAB: ReadonlySet<string> = new Set([
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

type YeastKind = "instant" | "active_dry" | null;
type LeavenerKind = "chemical" | null;

interface RecipeFacts {
  readonly hydration_pct: number | null;
  readonly ww_pct: number;
  readonly yeast_kind: YeastKind;
  readonly leavener_kind: LeavenerKind;
}

function deriveRecipeFacts(recipe: Recipe, db: Database): RecipeFacts {
  const flourLookup = new Map(db.flours.map((f) => [f.id, f]));
  const ingrLookup = new Map(db.ingredients.map((i) => [i.id, i]));

  let totalFlour = 0;
  let wholeGrainFlour = 0;
  let yeastKind: YeastKind = null;
  let leavenerKind: LeavenerKind = null;

  for (const item of recipe.items) {
    const flour = flourLookup.get(item.ingredient_id);
    if (flour) {
      totalFlour += item.grams ?? 0;
      if (WHOLE_GRAIN_FLOUR_IDS.has(flour.id)) wholeGrainFlour += item.grams ?? 0;
      continue;
    }
    const ingr = ingrLookup.get(item.ingredient_id);
    if (!ingr) continue;
    if (ingr.category === "yeast") {
      if (ingr.id === "yeast_instant") yeastKind = "instant";
      else if (ingr.id === "yeast_active_dry") yeastKind = "active_dry";
    } else if (ingr.category === "leavener") {
      leavenerKind = "chemical";
    }
  }

  let hydration: number | null = null;
  try {
    hydration = computeRecipe(recipe, db).hydration.effective_pct;
  } catch {
    hydration = null;
  }

  const wwPct = totalFlour > 0 ? (wholeGrainFlour / totalFlour) * 100 : 0;
  return { hydration_pct: hydration, ww_pct: wwPct, yeast_kind: yeastKind, leavener_kind: leavenerKind };
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

/* Soft-tier evaluators */

interface SoftTierResult {
  readonly reason: RecommendationReason;
  readonly score: number;
}

const CONFIDENCE_RANK: Record<string, number> = { verified: 3, inferred: 2, community: 1 };

function evaluateConfidence(course: BBPDC20Course): SoftTierResult {
  const score = CONFIDENCE_RANK[course.confidence] ?? 0;
  return {
    reason: { tier: "confidence", verdict: "neutral", evidence: `Course confidence: ${course.confidence}` },
    score,
  };
}

function evaluateHydration(course: BBPDC20Course, facts: RecipeFacts): SoftTierResult {
  const range = course.hydration_range;
  if (!range) {
    return {
      reason: { tier: "hydration", verdict: "neutral", evidence: "Course has no published hydration range" },
      score: 0,
    };
  }
  if (facts.hydration_pct === null) {
    return {
      reason: { tier: "hydration", verdict: "neutral", evidence: "Recipe hydration not computable" },
      score: 0,
    };
  }
  const target = range.ideal_pct ?? (range.min_pct + range.max_pct) / 2;
  const distance = Math.abs(facts.hydration_pct - target);
  const score = -distance;
  const inRange = facts.hydration_pct >= range.min_pct && facts.hydration_pct <= range.max_pct;
  return {
    reason: {
      tier: "hydration",
      verdict: inRange ? "match" : "mismatch",
      evidence: inRange
        ? `Hydration ${facts.hydration_pct.toFixed(0)} % within range ${range.min_pct}-${range.max_pct} %`
        : `Hydration ${facts.hydration_pct.toFixed(0)} % outside range ${range.min_pct}-${range.max_pct} %`,
    },
    score,
  };
}

function evaluateWholeWheat(course: BBPDC20Course, facts: RecipeFacts): SoftTierResult {
  if (course.whole_wheat_max_pct === undefined) {
    return {
      reason: { tier: "whole_wheat", verdict: "neutral", evidence: "Course has no whole-wheat cap" },
      score: 0,
    };
  }
  const within = facts.ww_pct <= course.whole_wheat_max_pct;
  const score = within
    ? 100 - (course.whole_wheat_max_pct - facts.ww_pct)
    : -(facts.ww_pct - course.whole_wheat_max_pct);
  return {
    reason: {
      tier: "whole_wheat",
      verdict: within ? "match" : "mismatch",
      evidence: within
        ? `Whole-wheat ${facts.ww_pct.toFixed(0)} % within cap ${course.whole_wheat_max_pct} %`
        : `Whole-wheat ${facts.ww_pct.toFixed(0)} % above cap ${course.whole_wheat_max_pct} %`,
    },
    score,
  };
}

function evaluateYeast(course: BBPDC20Course, facts: RecipeFacts): SoftTierResult {
  if (facts.yeast_kind === null && facts.leavener_kind === null) {
    return {
      reason: { tier: "yeast", verdict: "neutral", evidence: "Recipe has no yeast or leavener" },
      score: 0,
    };
  }
  if (course.yeast_compatibility.length === 0) {
    if (facts.leavener_kind === "chemical" && facts.yeast_kind === null) {
      return {
        reason: { tier: "yeast", verdict: "match", evidence: "Course uses chemical leavener; recipe has chemical leavener" },
        score: 1,
      };
    }
    return {
      reason: { tier: "yeast", verdict: "mismatch", evidence: "Course requires no yeast; recipe has yeast" },
      score: -1,
    };
  }
  if (facts.yeast_kind === null) {
    return {
      reason: { tier: "yeast", verdict: "mismatch", evidence: "Course requires yeast; recipe has only chemical leavener" },
      score: -1,
    };
  }
  if (course.yeast_compatibility.includes(facts.yeast_kind)) {
    return {
      reason: { tier: "yeast", verdict: "match", evidence: `Yeast ${facts.yeast_kind} supported` },
      score: 1,
    };
  }
  return {
    reason: { tier: "yeast", verdict: "mismatch", evidence: `Yeast ${facts.yeast_kind} not in course's compatibility list` },
    score: -1,
  };
}

function evaluateCrustShade(course: BBPDC20Course, recipe: Recipe): SoftTierResult {
  if (recipe.crust_shade === undefined) {
    return {
      reason: { tier: "crust_shade", verdict: "neutral", evidence: "Recipe has no crust shade preference" },
      score: 0,
    };
  }
  if (course.crust_shades.includes(recipe.crust_shade)) {
    return {
      reason: { tier: "crust_shade", verdict: "match", evidence: `Course supports ${recipe.crust_shade} crust` },
      score: 1,
    };
  }
  return {
    reason: { tier: "crust_shade", verdict: "mismatch", evidence: `Course does not support ${recipe.crust_shade} crust` },
    score: -1,
  };
}

function evaluateLoafSize(course: BBPDC20Course, recipe: Recipe): SoftTierResult {
  if (recipe.loaf_size === undefined) {
    return {
      reason: { tier: "loaf_size", verdict: "neutral", evidence: "Recipe has no loaf size preference" },
      score: 0,
    };
  }
  if (course.loaf_sizes.includes(recipe.loaf_size)) {
    return {
      reason: { tier: "loaf_size", verdict: "match", evidence: `Course supports ${recipe.loaf_size} loaf` },
      score: 1,
    };
  }
  return {
    reason: { tier: "loaf_size", verdict: "mismatch", evidence: `Course does not support ${recipe.loaf_size} loaf` },
    score: -1,
  };
}

function deriveRecipeTags(facts: RecipeFacts): ReadonlySet<string> {
  const tags = new Set<string>();
  if (facts.hydration_pct !== null && facts.hydration_pct > 70) tags.add("high_hydration");
  if (facts.ww_pct > 50) tags.add("whole_wheat");
  if (facts.ww_pct > 30 && facts.ww_pct <= 50) tags.add("multigrain");
  if (facts.ww_pct === 0) {
    tags.add("white_flour");
    tags.add("sandwich_loaf");
  }
  return tags;
}

function evaluateRecommendedFor(course: BBPDC20Course, recipeTags: ReadonlySet<string>): SoftTierResult {
  let overlap = 0;
  const matched: string[] = [];
  for (const tag of course.recommended_for) {
    if (recipeTags.has(tag) && RECIPE_TAG_VOCAB.has(tag)) {
      overlap++;
      matched.push(tag);
    }
  }
  if (overlap > 0) {
    return {
      reason: { tier: "recommended_for", verdict: "match", evidence: `Tags overlap: ${matched.join(", ")}` },
      score: overlap,
    };
  }
  return {
    reason: { tier: "recommended_for", verdict: "neutral", evidence: "No tag overlap with course" },
    score: 0,
  };
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
