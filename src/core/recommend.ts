import type { BBPDC20Course, Database, Recipe } from "./types.js";
import { computeRecipe } from "./compute.js";

/* Dataset constants */

const GF_FLOUR_IDS: ReadonlySet<string> = new Set([
  "gf_flour_blend",
  "buckwheat_flour",
]);

// Note: WHOLE_GRAIN_FLOUR_IDS includes rye flours, so a recipe with
// rye_flour_light or rye_flour_dark contributes to BOTH ww_g (whole-grain
// total) AND rye_g. This is intentional: the grain_whole_wheat tree branch
// fires when ww_pct ≥ 30, which catches BF+WW+rye blends like Light Rye
// (35% combined whole-grain) and Pumpernickel (44% combined whole-grain).
const WHOLE_GRAIN_FLOUR_IDS: ReadonlySet<string> = new Set([
  "whole_wheat_flour", "white_whole_wheat_flour",
  "spelt_flour", "einkorn_flour", "kamut_flour",
  "rye_flour_dark", "rye_flour_light",
  "buckwheat_flour",
]);

const RYE_FLOUR_IDS: ReadonlySet<string> = new Set([
  "rye_flour_dark", "rye_flour_light",
]);

const GRAIN_CEREAL_CATEGORY = "grain_cereal";

const PLANT_MILK_ALLOWLIST: ReadonlySet<string> = new Set([
  "almond_milk_unsweetened",
]);

const VEGAN_EGG_SUBSTITUTE_IDS: ReadonlySet<string> = new Set([
  "aquafaba",
]);

const DAIRY_ID_PATTERN = /milk|cream|butter|whey/;

/* Tolerance thresholds — incidental amounts from butter / milk lactose */
const SALT_TOLERANCE_G = 0.5;
const SWEETENERS_TOLERANCE_G = 2.0;

/* Public types */

export type DietaryIntent = "salt_free" | "sugar_free" | "vegan" | "gluten_free";
export type TimeIntent = "rapid";
export type OutputIntent = "bake" | "dough";

export interface RecipeIntent {
  readonly dietary?: DietaryIntent;
  readonly time?: TimeIntent;
  readonly output?: OutputIntent;
}

export type TreeBranch =
  | "intent_output_dough"
  | "intent_output_bake"
  | "dietary_gluten_free"
  | "dietary_salt_free"
  | "dietary_vegan"
  | "dietary_sugar_free"
  | "rapid_white"
  | "rapid_whole_wheat"
  | "grain_multigrain"
  | "grain_whole_wheat"
  | "structural_european"
  | "default_white"
  | "non_baking_ineligible";

export type RecommendationReason =
  | { readonly kind: "tree_branch"; readonly branch: TreeBranch; readonly evidence: string }
  | { readonly kind: "predicate_fact"; readonly fact: string; readonly value: string | number | boolean };

export interface CourseRecommendation {
  readonly course_id: string;
  readonly rank: number | null;
  readonly eligible: boolean;
  readonly reasons: readonly RecommendationReason[];
}

export interface RecommendOpts {
  readonly intent?: RecipeIntent;
}

/* Fact derivation */

interface RecipeFacts {
  hydration_pct: number | null;
  ww_pct: number;
  rye_pct: number;
  bread_flour_pct: number;
  total_flour_g: number;
  has_flour: boolean;

  sugar_g: number;
  honey_g: number;
  molasses_g: number;
  maple_g: number;
  agave_g: number;
  brown_sugar_g: number;
  all_sweeteners_g: number;

  butter_g: number;
  lard_g: number;
  oil_g: number;

  dry_milk_g: number;
  fluid_milk_g: number;
  has_egg: boolean;
  has_dairy: boolean;
  has_meat: boolean;
  has_honey: boolean;

  salt_g: number;

  has_acv: boolean;
  has_plant_milk: boolean;
  has_gf_flour: boolean;
  has_grain_cereal: boolean;

  yeast_kind: "instant" | "active_dry" | null;
  leavener_kind: "chemical" | null;

  is_gluten_free_structural: boolean;
  is_salt_free_structural: boolean;
  is_vegan_structural: boolean;
  is_sugar_free_structural: boolean;
  is_european_structural: boolean;
}

function deriveFacts(recipe: Recipe, db: Database): RecipeFacts {
  const flourLookup = new Map(db.flours.map((f) => [f.id, f]));
  const ingrLookup = new Map(db.ingredients.map((i) => [i.id, i]));

  let total_flour_g = 0;
  let ww_g = 0;
  let rye_g = 0;
  let bf_g = 0;
  let sugar_g = 0;
  let honey_g = 0;
  let molasses_g = 0;
  let maple_g = 0;
  let agave_g = 0;
  let brown_sugar_g = 0;
  let butter_g = 0;
  let lard_g = 0;
  let oil_g = 0;
  let dry_milk_g = 0;
  let fluid_milk_g = 0;
  let salt_g = 0;
  let has_egg = false;
  let has_dairy = false;
  let has_meat = false;
  let has_acv = false;
  let has_plant_milk = false;
  let has_gf_flour = false;
  let has_grain_cereal = false;
  let yeast_kind: RecipeFacts["yeast_kind"] = null;
  let leavener_kind: RecipeFacts["leavener_kind"] = null;

  for (const item of recipe.items) {
    const grams = item.grams ?? 0;

    const flour = flourLookup.get(item.ingredient_id);
    if (flour) {
      total_flour_g += grams;
      if (WHOLE_GRAIN_FLOUR_IDS.has(flour.id)) ww_g += grams;
      if (RYE_FLOUR_IDS.has(flour.id)) rye_g += grams;
      if (flour.id === "bread_flour") bf_g += grams;
      if (GF_FLOUR_IDS.has(flour.id)) has_gf_flour = true;
      continue;
    }

    const ingr = ingrLookup.get(item.ingredient_id);
    if (!ingr) continue;

    if (ingr.category === GRAIN_CEREAL_CATEGORY) {
      has_grain_cereal = true;
      continue;
    }

    salt_g += grams * (ingr.salt_pct / 100);

    // Sweeteners
    if (ingr.id === "sugar_granulated") sugar_g += grams;
    if (ingr.id === "sugar_brown") brown_sugar_g += grams;
    if (ingr.id === "honey") honey_g += grams;
    if (ingr.id === "molasses" || ingr.id === "molasses_dark") molasses_g += grams;
    if (ingr.id === "maple_syrup") maple_g += grams;
    if (ingr.id === "agave_nectar") agave_g += grams;

    // Fats
    if (ingr.id === "butter_unsalted" || ingr.id === "butter_salted") butter_g += grams;
    if (ingr.id === "lard") lard_g += grams;
    if (ingr.id === "olive_oil" || ingr.id === "vegetable_oil" || ingr.id === "canola_oil" || ingr.id === "coconut_oil") oil_g += grams;

    // Milk
    if (ingr.id === "milk_powder_nonfat" || ingr.id === "milk_powder_whole") dry_milk_g += grams;
    if (ingr.id === "milk_whole" || ingr.id === "milk_skim" || ingr.id === "milk_2pct" || ingr.id === "buttermilk") fluid_milk_g += grams;

    // Egg / dairy / meat detection
    if (ingr.category === "eggs" && !VEGAN_EGG_SUBSTITUTE_IDS.has(ingr.id)) has_egg = true;
    if (ingr.category === "cheese") has_dairy = true;
    if ((ingr.category === "liquids" || ingr.category === "fats") && DAIRY_ID_PATTERN.test(ingr.id) && !PLANT_MILK_ALLOWLIST.has(ingr.id)) {
      has_dairy = true;
    }
    if (ingr.id === "bacon_cooked" || ingr.id === "ham_cooked" || ingr.id === "sausage_cooked") has_meat = true;

    // Affirmative dietary signals
    if (ingr.id === "vinegar_apple_cider") has_acv = true;
    if (PLANT_MILK_ALLOWLIST.has(ingr.id)) has_plant_milk = true;

    // Yeast / leavener
    if (ingr.category === "yeast") {
      if (ingr.id === "yeast_instant") yeast_kind = "instant";
      else if (ingr.id === "yeast_active_dry") yeast_kind = "active_dry";
    } else if (ingr.category === "leavener") {
      leavener_kind = "chemical";
    }
  }

  let hydration_pct: number | null = null;
  try {
    hydration_pct = computeRecipe(recipe, db).hydration.effective_pct;
  } catch {
    hydration_pct = null;
  }

  const ww_pct = total_flour_g > 0 ? (ww_g / total_flour_g) * 100 : 0;
  const rye_pct = total_flour_g > 0 ? (rye_g / total_flour_g) * 100 : 0;
  const bread_flour_pct = total_flour_g > 0 ? (bf_g / total_flour_g) * 100 : 0;
  const has_flour = total_flour_g > 0;
  const all_sweeteners_g = sugar_g + honey_g + molasses_g + maple_g + agave_g + brown_sugar_g;
  const has_honey = honey_g > 0;

  // Structural predicates (per spec §4.3)
  const is_gluten_free_structural =
    has_gf_flour && ww_pct === 0 && rye_pct === 0 && bread_flour_pct === 0;

  const is_salt_free_structural =
    salt_g < SALT_TOLERANCE_G && has_acv && has_flour;

  const is_vegan_structural =
    !has_egg && !has_dairy && !has_meat && !has_honey && has_plant_milk && has_flour;

  const is_sugar_free_structural =
    all_sweeteners_g < SWEETENERS_TOLERANCE_G && has_flour && yeast_kind !== null;

  const is_european_structural =
    bread_flour_pct >= 95 &&
    total_flour_g > 0 &&
    (sugar_g + honey_g) / total_flour_g <= 0.04 &&
    (butter_g + lard_g) / total_flour_g <= 0.02 &&
    dry_milk_g <= 12 &&
    fluid_milk_g <= 50 &&
    has_flour;

  return {
    hydration_pct, ww_pct, rye_pct, bread_flour_pct, total_flour_g, has_flour,
    sugar_g, honey_g, molasses_g, maple_g, agave_g, brown_sugar_g, all_sweeteners_g,
    butter_g, lard_g, oil_g,
    dry_milk_g, fluid_milk_g, has_egg, has_dairy, has_meat, has_honey,
    salt_g,
    has_acv, has_plant_milk, has_gf_flour, has_grain_cereal,
    yeast_kind, leavener_kind,
    is_gluten_free_structural, is_salt_free_structural, is_vegan_structural,
    is_sugar_free_structural, is_european_structural,
  };
}

/* Decision tree */

interface TreeResult {
  readonly winner_course_id: string;
  readonly branch: TreeBranch;
  readonly evidence: string;
}

function runTree(facts: RecipeFacts, intent: RecipeIntent): TreeResult {
  if (intent.output === "dough") {
    return {
      winner_course_id: "dough",
      branch: "intent_output_dough",
      evidence: "Recipe intent.output = 'dough' → routed to Dough course",
    };
  }

  if (facts.is_gluten_free_structural) {
    return {
      winner_course_id: "gluten_free",
      branch: "dietary_gluten_free",
      evidence: "GF flour present + no wheat/rye → routed to Gluten Free course",
    };
  }
  if (facts.is_salt_free_structural) {
    return {
      winner_course_id: "salt_free",
      branch: "dietary_salt_free",
      evidence: "salt < 0.5g + apple cider vinegar present → routed to Salt Free course",
    };
  }
  if (facts.is_vegan_structural) {
    return {
      winner_course_id: "vegan",
      branch: "dietary_vegan",
      evidence: "no egg/dairy/meat/honey + plant milk present → routed to Vegan course",
    };
  }
  if (facts.is_sugar_free_structural && intent.dietary === "sugar_free") {
    return {
      winner_course_id: "sugar_free",
      branch: "dietary_sugar_free",
      evidence: "all sweeteners absent + intent.dietary='sugar_free' → routed to Sugar Free course",
    };
  }

  if (intent.time === "rapid") {
    if (facts.ww_pct >= 30) {
      return {
        winner_course_id: "rapid_whole_wheat",
        branch: "rapid_whole_wheat",
        evidence: "intent.time='rapid' + ww_pct ≥ 30 → routed to Rapid Whole Wheat course",
      };
    }
    return {
      winner_course_id: "rapid_white",
      branch: "rapid_white",
      evidence: "intent.time='rapid' + ww_pct < 30 → routed to Rapid White course",
    };
  }

  if (facts.has_grain_cereal) {
    return {
      winner_course_id: "multigrain",
      branch: "grain_multigrain",
      evidence: "grain_cereal-category ingredient present → routed to Multigrain course",
    };
  }
  if (facts.ww_pct >= 30 || facts.rye_pct >= 30) {
    return {
      winner_course_id: "whole_wheat",
      branch: "grain_whole_wheat",
      evidence: `ww_pct=${facts.ww_pct.toFixed(0)} or rye_pct=${facts.rye_pct.toFixed(0)} ≥ 30 → routed to Whole Wheat course`,
    };
  }
  if (facts.is_european_structural) {
    return {
      winner_course_id: "european",
      branch: "structural_european",
      evidence: "bread flour ≥ 95% + lean (sugar ≤ 4%, butter ≤ 2%, low dairy) → routed to European course",
    };
  }

  return {
    winner_course_id: "white",
    branch: "default_white",
    evidence: "no special branch matched → routed to White course (default)",
  };
}

/* Eligibility — applies to all 14 rows */

function isCourseEligibleForOutput(course: BBPDC20Course, intent: RecipeIntent, facts: RecipeFacts): boolean {
  // Output intent gate
  if (intent.output === "bake" && !course.bakes) return false;
  if (intent.output === "dough" && course.bakes) return false;

  // Cake course: chemical-leavened batters only; ineligible if the recipe has yeast
  if (course.id === "cake") {
    if (facts.yeast_kind !== null) return false;
  }

  return true;
}

/* Predicate-fact reason builders (for non-winner explanations) */

function buildPredicateFacts(facts: RecipeFacts): readonly RecommendationReason[] {
  const out: RecommendationReason[] = [];
  if (facts.hydration_pct !== null) out.push({ kind: "predicate_fact", fact: "hydration_pct", value: Math.round(facts.hydration_pct * 10) / 10 });
  out.push({ kind: "predicate_fact", fact: "ww_pct", value: Math.round(facts.ww_pct * 10) / 10 });
  if (facts.rye_pct > 0) out.push({ kind: "predicate_fact", fact: "rye_pct", value: Math.round(facts.rye_pct * 10) / 10 });
  out.push({ kind: "predicate_fact", fact: "bread_flour_pct", value: Math.round(facts.bread_flour_pct * 10) / 10 });
  out.push({ kind: "predicate_fact", fact: "all_sweeteners_g", value: Math.round(facts.all_sweeteners_g * 10) / 10 });
  out.push({ kind: "predicate_fact", fact: "salt_g", value: Math.round(facts.salt_g * 100) / 100 });
  if (facts.has_grain_cereal) out.push({ kind: "predicate_fact", fact: "has_grain_cereal", value: true });
  if (facts.has_acv) out.push({ kind: "predicate_fact", fact: "has_acv", value: true });
  if (facts.has_plant_milk) out.push({ kind: "predicate_fact", fact: "has_plant_milk", value: true });
  if (facts.has_gf_flour) out.push({ kind: "predicate_fact", fact: "has_gf_flour", value: true });
  return out;
}

/* Public functions */

export function recommendCourse(
  recipe: Recipe,
  db: Database,
  opts?: RecommendOpts,
): readonly CourseRecommendation[] {
  const recipeIntent = recipe.intent ?? {};
  const optsIntent = opts?.intent ?? {};
  const intent: RecipeIntent = { ...recipeIntent, ...optsIntent };

  const facts = deriveFacts(recipe, db);
  const tree = runTree(facts, intent);
  const factReasons = buildPredicateFacts(facts);

  const winnerCourse = db.courses.find((c) => c.id === tree.winner_course_id);
  const winnerEligible = winnerCourse !== undefined && isCourseEligibleForOutput(winnerCourse, intent, facts);

  // Build winner row's reasons: tree branch + predicate facts
  const winnerReasons: RecommendationReason[] = [
    { kind: "tree_branch", branch: tree.branch, evidence: tree.evidence },
    ...factReasons,
  ];

  // Build all 14 rows
  const rows: Array<{ course: BBPDC20Course; isWinner: boolean; eligible: boolean; reasons: readonly RecommendationReason[] }> =
    db.courses.map((course) => {
      const eligible = isCourseEligibleForOutput(course, intent, facts);
      const isWinner = course.id === tree.winner_course_id && winnerEligible && eligible;
      const reasons: readonly RecommendationReason[] = isWinner
        ? winnerReasons
        : [{ kind: "tree_branch", branch: tree.branch, evidence: `Tree picked '${tree.winner_course_id}' via ${tree.branch}; this course not selected` }];
      return { course, isWinner, eligible, reasons };
    });

  // Sort: winner first, then eligible non-winners by course_number, then ineligible by course_number
  rows.sort((a, b) => {
    if (a.isWinner && !b.isWinner) return -1;
    if (!a.isWinner && b.isWinner) return 1;
    if (a.eligible && !b.eligible) return -1;
    if (!a.eligible && b.eligible) return 1;
    return a.course.course_number - b.course.course_number;
  });

  // Assign ranks: eligible rows get 1..N, ineligible rows get null
  let nextRank = 1;
  return rows.map((r) => ({
    course_id: r.course.id,
    rank: r.eligible ? nextRank++ : null,
    eligible: r.eligible,
    reasons: r.reasons,
  }));
}

export interface ResolvedCourse {
  readonly course: BBPDC20Course;
  readonly source: "user" | "recommended";
}

export function resolveCourse(recipe: Recipe, db: Database): ResolvedCourse | null {
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
