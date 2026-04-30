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
  "salt_free", "low_sodium", "sugar_free", "diabetic_friendly",
  "vegan", "egg_free", "dairy_free",
  "gluten_free",
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

// Tolerance thresholds for dietary classification — recipes with trace
// amounts of salt/sugar from incidental sources (e.g., butter_unsalted's
// 0.05 % salt content, ~0.018 g per 35 g) should still classify as
// salt-free / sugar-free. Real intentional sugar/salt is one or two
// orders of magnitude above these thresholds.
const SALT_TOLERANCE_G = 0.5;
const SUGAR_TOLERANCE_G = 2.0;

function deriveDietary(recipe: Recipe, db: Database): DietaryFacts {
  const flourLookup = new Map(db.flours.map((f) => [f.id, f]));
  const ingrLookup = new Map(db.ingredients.map((i) => [i.id, i]));

  let isGlutenFree = true;
  let saltGrams = 0;
  let sugarGrams = 0;
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

    const grams = item.grams ?? 0;
    saltGrams += grams * (ingr.salt_pct / 100);
    sugarGrams += grams * (ingr.sugar_pct / 100);

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

  const isSaltFree = saltGrams < SALT_TOLERANCE_G;
  const isSugarFree = sugarGrams < SUGAR_TOLERANCE_G;
  const isEggFree = !hasEggIngredient;
  const isVegan = isEggFree && !hasDairyIngredient;

  return { is_gluten_free: isGlutenFree, is_vegan: isVegan, is_egg_free: isEggFree, is_salt_free: isSaltFree, is_sugar_free: isSugarFree };
}

type YeastKind = "instant" | "active_dry" | null;
type LeavenerKind = "chemical" | null;

interface RecipeFacts {
  readonly hydration_pct: number | null;
  readonly ww_pct: number;
  readonly has_flour: boolean;
  readonly yeast_kind: YeastKind;
  readonly leavener_kind: LeavenerKind;
  // Affirmative dietary-intent signals — used by deriveRecipeTags to
  // distinguish "recipe was authored for a dietary course" from "recipe
  // happens to be incidentally compatible". E.g., a plain bread-flour-water
  // recipe is technically vegan + salt-free, but doesn't signal dietary
  // intent unless an affirmative substitute (plant milk, apple cider
  // vinegar) is present.
  readonly has_acv_compensator: boolean;
  readonly has_plant_milk: boolean;
  readonly has_gf_flour: boolean;
}

function deriveRecipeFacts(recipe: Recipe, db: Database): RecipeFacts {
  const flourLookup = new Map(db.flours.map((f) => [f.id, f]));
  const ingrLookup = new Map(db.ingredients.map((i) => [i.id, i]));

  let totalFlour = 0;
  let wholeGrainFlour = 0;
  let yeastKind: YeastKind = null;
  let leavenerKind: LeavenerKind = null;
  let hasAcvCompensator = false;
  let hasPlantMilk = false;
  let hasGfFlour = false;

  for (const item of recipe.items) {
    const flour = flourLookup.get(item.ingredient_id);
    if (flour) {
      totalFlour += item.grams ?? 0;
      if (WHOLE_GRAIN_FLOUR_IDS.has(flour.id)) wholeGrainFlour += item.grams ?? 0;
      if (GF_FLOUR_IDS.has(flour.id)) hasGfFlour = true;
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
    if (ingr.id === "vinegar_apple_cider") hasAcvCompensator = true;
    if (PLANT_MILK_ALLOWLIST.has(ingr.id)) hasPlantMilk = true;
  }

  let hydration: number | null = null;
  try {
    hydration = computeRecipe(recipe, db).hydration.effective_pct;
  } catch {
    hydration = null;
  }

  const wwPct = totalFlour > 0 ? (wholeGrainFlour / totalFlour) * 100 : 0;
  return {
    hydration_pct: hydration,
    ww_pct: wwPct,
    has_flour: totalFlour > 0,
    yeast_kind: yeastKind,
    leavener_kind: leavenerKind,
    has_acv_compensator: hasAcvCompensator,
    has_plant_milk: hasPlantMilk,
    has_gf_flour: hasGfFlour,
  };
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

// All 14 catalog rows currently ship with confidence: "verified", so this tier
// is effectively a no-op today. Wired and tested for the day a community-sourced
// or inferred row lands in src/data/bb_pdc20_courses.json.
function evaluateConfidence(course: BBPDC20Course): SoftTierResult {
  const score = CONFIDENCE_RANK[course.confidence] ?? 0;
  return {
    reason: { tier: "confidence", verdict: "neutral", evidence: `Course confidence: ${course.confidence}` },
    score,
  };
}

// Hydration tier scoring stratifies into three bands AND buckets the in-range
// distance so close-but-not-identical hydration matches do not artificially
// break ties at tier 2. Without bucketing, two baking courses both in-range
// for the same recipe would split on sub-percent distance differences,
// preventing tier 3 (whole_wheat) from arbitrating between them.
//
//   in-range courses    →  +100 - floor(distance / 5) * 5   (buckets of 5pp)
//   no-range courses    →                                0   (neutral)
//   out-of-range course →               -distance_from_ideal (negative)
//
// Bucket size is 5pp — typical bread-machine measurement noise is about
// 2-3pp; 5pp groups "essentially identical" matches into the same bucket
// so the whole_wheat / yeast / recommended_for tiers can decide.
//
// This stratification (rather than a single-distance metric) ensures:
//   • in-range baking course > no-range course (Dough/Cake/Jam)
//   • no-range course > out-of-range baking course
//   • close-fit-by-hydration courses tie, letting whole-wheat or other
//     downstream tiers separate them.
//
// Earlier single-distance scoring caused Course 11 Dough to win for typical
// white-bread recipes (Dough scored 0 on tier 2, beating White's negative
// distance score). The current scoring picks White correctly.
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
  const inRange = facts.hydration_pct >= range.min_pct && facts.hydration_pct <= range.max_pct;
  const score = inRange ? 100 - Math.floor(distance / 5) * 5 : -distance;
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
  if (!facts.has_flour) {
    return {
      reason: { tier: "whole_wheat", verdict: "neutral", evidence: "Recipe has no flour" },
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

// Note: `BBPDC20YeastCompat` includes "sourdough" and "fresh" but no current
// ingredient in src/data/ingredients.json maps to those. As a result the
// "sourdough" branch of `recipe_yeast` is dead code today — Course 12
// Sourdough Starter (`yeast_compatibility: ["sourdough"]`) will mismatch
// every recipe on tier 4 until a sourdough_starter ingredient is added.
// Documented in spec §10; revisit when a real sourdough ingredient lands.
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

function deriveRecipeTags(facts: RecipeFacts, dietary: DietaryFacts): ReadonlySet<string> {
  const tags = new Set<string>();
  // Hydration / whole-grain / structural tags
  if (facts.hydration_pct !== null && facts.hydration_pct > 70) tags.add("high_hydration");
  if (facts.ww_pct > 50) tags.add("whole_wheat");
  if (facts.ww_pct > 30 && facts.ww_pct <= 50) tags.add("multigrain");
  if (facts.ww_pct === 0) {
    tags.add("white_flour");
    tags.add("sandwich_loaf");
  }
  // Dietary-derived tags — emitted ONLY when the recipe carries an affirmative
  // intent signal, not on absence alone. A plain water-flour-yeast-salt recipe
  // is technically vegan + sugar-free, but isn't authored for those courses.
  // Affirmative signals:
  //   salt_free: apple cider vinegar (a common gluten-stabilizing salt
  //              substitute in salt-free bread recipes)
  //   vegan:    a plant-milk ingredient (almond_milk_unsweetened etc.)
  //   gluten_free: a GF flour ingredient (gf_flour_blend etc.)
  // No affirmative-signal heuristic exists for sugar_free or for incidental
  // egg_free; recipes targeting those courses must set recipe.course
  // explicitly to surface the dietary-formulation cycle.
  if (dietary.is_salt_free && facts.has_acv_compensator) {
    tags.add("salt_free");
    tags.add("low_sodium");
  }
  if (dietary.is_vegan && facts.has_plant_milk) {
    tags.add("vegan");
    tags.add("egg_free");
    tags.add("dairy_free");
  }
  if (dietary.is_gluten_free && facts.has_gf_flour) tags.add("gluten_free");
  return tags;
}

function evaluateRecommendedFor(_course: BBPDC20Course, _recipeTags: ReadonlySet<string>): SoftTierResult {
  return {
    reason: { tier: "recommended_for", verdict: "neutral", evidence: "Disabled (engine rewrite in progress)" },
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
  const facts = deriveRecipeFacts(recipe, db);
  const recipeTags = deriveRecipeTags(facts, dietary);

  type Row = {
    course: BBPDC20Course;
    eligible: boolean;
    reasons: RecommendationReason[];
    scores: readonly number[];
  };

  const rows: Row[] = db.courses.map((course) => {
    const intent = evaluateIntentGate(course, opts);
    const dietaryReason = evaluateDietaryGate(course, dietary);
    const eligibilityFailed = intent.verdict === "mismatch" || dietaryReason.verdict === "mismatch";

    const fillerNeutral = (tier: RecommendationTier): RecommendationReason => ({
      tier, verdict: "neutral", evidence: "Not evaluated — eligibility failed",
    });

    if (eligibilityFailed) {
      return {
        course,
        eligible: false,
        reasons: [
          intent, dietaryReason,
          fillerNeutral("confidence"), fillerNeutral("hydration"),
          fillerNeutral("whole_wheat"), fillerNeutral("yeast"),
          fillerNeutral("crust_shade"), fillerNeutral("loaf_size"),
          fillerNeutral("recommended_for"),
        ],
        scores: [],
      };
    }

    const t1 = evaluateConfidence(course);
    const t2 = evaluateHydration(course, facts);
    const t3 = evaluateWholeWheat(course, facts);
    const t4 = evaluateYeast(course, facts);
    const t5 = evaluateCrustShade(course, recipe);
    const t6 = evaluateLoafSize(course, recipe);
    const t7 = evaluateRecommendedFor(course, recipeTags);

    return {
      course,
      eligible: true,
      reasons: [intent, dietaryReason, t1.reason, t2.reason, t3.reason, t4.reason, t5.reason, t6.reason, t7.reason],
      scores: [t1.score, t2.score, t3.score, t4.score, t5.score, t6.score, t7.score],
    };
  });

  const eligibleRows = rows.filter((r) => r.eligible);
  eligibleRows.sort((a, b) => {
    for (let i = 0; i < a.scores.length; i++) {
      if (a.scores[i]! !== b.scores[i]!) return b.scores[i]! - a.scores[i]!;
    }
    return a.course.course_number - b.course.course_number;
  });

  const ineligibleRows = rows.filter((r) => !r.eligible);
  ineligibleRows.sort((a, b) => a.course.course_number - b.course.course_number);

  const out: CourseRecommendation[] = [];
  eligibleRows.forEach((row, i) => {
    out.push({
      course_id: row.course.id,
      rank: i + 1,
      eligible: true,
      reasons: row.reasons,
    });
  });
  for (const row of ineligibleRows) {
    out.push({
      course_id: row.course.id,
      rank: null,
      eligible: false,
      reasons: row.reasons,
    });
  }
  return out;
}

/**
 * Resolves which course a UI consumer should display for a given recipe.
 *
 * Rules (matches the kitchen-card and recipe-meta strip's display logic):
 * - If `recipe.course` is set AND resolves to a known catalog row → return
 *   that course with `source: "user"`. NO eligibility check is applied —
 *   user-set courses are rendered verbatim. Eligibility violations surface
 *   in the on-screen warnings panel, not here.
 * - If `recipe.course` is set but unknown to `db.courses` → return null.
 *   Consumers should omit the course display rather than fall back to a
 *   recommendation (respects user intent).
 * - If `recipe.course` is unset → call `recommendCourse(recipe, db)` and
 *   return the top eligible course with `source: "recommended"`. Returns
 *   null if no course is eligible.
 *
 * Used by `src/site/pdf/kitchen-card.ts` and may be used by other consumers
 * that want the same "user pick wins, recommendation fills in" semantics.
 */
export interface ResolvedCourse {
  readonly course: BBPDC20Course;
  readonly source: "user" | "recommended";
}

export function resolveCourse(
  recipe: Recipe,
  db: Database,
): ResolvedCourse | null {
  if (recipe.course !== undefined) {
    const found = db.courses.find((c) => c.id === recipe.course);
    if (found) return { course: found, source: "user" };
    return null;
  }
  const recs = recommendCourse(recipe, db);
  const top = recs.find((r) => r.eligible);
  if (!top) return null;
  const found = db.courses.find((c) => c.id === top.course_id);
  if (!found) return null;
  return { course: found, source: "recommended" };
}
