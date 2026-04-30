// Public types for bread-calc. Mirrors src/data/schema.json (JSON Schema).

export type Category =
  | "liquids" | "sweeteners" | "fats" | "fresh_fruit" | "dried_fruit"
  | "nuts_seeds" | "eggs" | "cheese" | "vegetables"
  | "herbs_spices" | "acids_alcohols" | "specialty"
  | "flour" | "salt" | "yeast" | "leavener";

export type Role =
  | "flour" | "wet" | "fat" | "sweetener" | "salt" | "yeast" | "leavener"
  | "inclusion" | "enrichment";

export type ZoneId = "dry" | "sandwich" | "wet" | "very_wet";

export interface HydrationZone {
  id: ZoneId;
  label: string;
  range: readonly [number, number];
  note: string;
}

export type IngredientFlag =
  | "enzymatic_protease" | "late_water_release" | "humectant_bound_water"
  | "alcohol_yeast_inhibitor" | "high_salt" | "acidic" | "leavener_consumed"
  | "gluten_strengthener" | "gf_stabilizer";

export interface Ingredient {
  id: string;
  name: string;
  category: Category;
  is_liquid: boolean;
  water_pct: number;
  salt_pct: number;
  sugar_pct: number;
  fat_pct: number;
  free_water_factor: number;
  density_g_per_cup: number | null;
  protein_pct?: number;
  carb_pct?: number;
  alcohol_pct?: number;
  ash_pct?: number;
  ph?: number;
  notes?: string;
  usda_fdc_id?: number;
  form_variants?: string[];
  flags?: IngredientFlag[];
}

export interface Flour {
  id: string;
  name: string;
  category: "flour";
  protein_pct: number;
  ddt_water_absorption_pct: number;
  density_g_per_cup: number;
  notes?: string;
}

export interface BBPDC20Recipe {
  name: string;
  course: string;
  total_water_g: number;
  total_flour_g: number;
  hydration_pct_nominal: number;
  zone: ZoneId;
  excluded_from_chart?: boolean;
}

export interface Defaults {
  default_free_water_factors_by_category: Record<Category, number>;
  default_bake_loss_pct: number;
  default_machine_id: string;
}

export interface Machine {
  id: string;
  name: string;
  pan_capacity_g: number;
  pan_overflow_threshold_g: number;
  pan_underfill_threshold_g: number;
  flour_quantity_typical_min_g: number;
  flour_quantity_typical_max_g: number;
  inclusion_max_fraction_of_flour: number;
}

export type BBPDC20StageName =
  | "preheat" | "knead_1" | "rest" | "knead_2"
  | "rise_1" | "punch" | "add_ins_beep" | "rise_2"
  | "preheat_bake" | "bake" | "cool" | "keep_warm";

export interface BBPDC20Stage {
  readonly name: BBPDC20StageName;
  readonly duration_minutes: number;
  readonly target_temp_c: number | null;
  readonly notes?: string;
}

export type BBPDC20LoafSize = "1lb" | "1.5lb" | "2lb";
export type BBPDC20CrustShade = "light" | "medium" | "dark";
export type BBPDC20DietaryMode =
  | "vegan" | "salt_free" | "sugar_free" | "egg_free" | "gluten_free";
export type BBPDC20YeastCompat =
  | "instant" | "active_dry" | "sourdough" | "fresh";
export type BBPDC20Confidence = "verified" | "inferred" | "community";

export interface BBPDC20Course {
  readonly id: string;
  readonly course_number: number;
  readonly name: string;

  readonly total_minutes: number;
  readonly stages: readonly BBPDC20Stage[];

  readonly bakes: boolean;
  readonly loaf_sizes: readonly BBPDC20LoafSize[];
  readonly crust_shades: readonly BBPDC20CrustShade[];
  readonly inclusions_beep: boolean;
  readonly dietary_modes: readonly BBPDC20DietaryMode[];

  readonly recommended_for: readonly string[];
  readonly recommended_for_notes?: string;
  readonly hydration_range?: {
    readonly min_pct: number;
    readonly max_pct: number;
    readonly ideal_pct?: number;
  };
  readonly whole_wheat_max_pct?: number;
  readonly yeast_compatibility: readonly BBPDC20YeastCompat[];

  readonly confidence: BBPDC20Confidence;
  readonly sources: readonly string[];

  readonly notes?: string;
}

export interface Database {
  ingredients: readonly Ingredient[];
  flours: readonly Flour[];
  defaults: Defaults;
  references: readonly BBPDC20Recipe[];
  machines: readonly Machine[];
  courses: readonly BBPDC20Course[];
}

export interface RecipeItem {
  uid: string;
  ingredient_id: string;
  grams?: number;
  bakers_pct?: number;
  role?: Role;
}

export type CrustShade = "light" | "medium" | "dark";
export type LoafSize = "1lb" | "1.5lb" | "2lb";

export interface Recipe {
  schema_version: "2.0";
  name?: string;
  notes?: string;
  machine?: string;
  target_loaf_g?: number;
  bake_loss_pct?: number;
  items: RecipeItem[];
  free_water_factor_overrides?: Record<string, number>;
  headline_metric?: "effective" | "nominal" | "total_liquid";

  // Sub-project B: recipe metadata expansion
  course?: string;
  crust_shade?: CrustShade;
  loaf_size?: LoafSize;
  extended_notes?: string;
  bake_hints?: string[];
}

export type WarningCode =
  | "no_flour" | "solver_overconstrained" | "solver_ambiguous_flour" | "pan_overflow_predicted"
  | "under_developed_gluten" | "sugar_too_high" | "salt_too_high" | "fat_too_high"
  | "enzymatic_gluten_degradation" | "inclusions_exceed_pan"
  | "wet_zone_needs_gluten_support" | "very_wet_zone"
  | "alcohol_yeast_inhibition" | "no_yeast_or_leavener"
  | "pan_underfill_predicted" | "late_water_release_present" | "humectant_overestimate_risk"
  | "flour_quantity_atypical" | "no_salt" | "salt_inherent_dominant"
  | "target_loaf_g_ignored_no_pcts"
  // Sub-project B
  | "course_crust_shade_unsupported"
  | "course_loaf_size_unsupported"
  | "unknown_course_id";

export interface Warning {
  code: WarningCode;
  severity: "info" | "warn" | "error";
  message: string;
  related_uids?: string[];
  suggested_fixes: Fix[];   // non-optional; empty array for pure-info warnings
}

export type Fix =
  | { kind: "set_grams";          uid: string; grams: number;       rationale: string; }
  | { kind: "increase_grams";     uid: string; delta_g: number;     rationale: string; }
  | { kind: "decrease_grams";     uid: string; delta_g: number;     rationale: string; }
  | { kind: "set_bakers_pct";     uid: string; bakers_pct: number;  rationale: string; }
  | { kind: "add_ingredient";     uid?: string; ingredient_id: string;
                                  grams?: number; bakers_pct?: number; role?: Role;
                                  rationale: string; }
  | { kind: "remove_ingredient";  uid: string; rationale: string; }
  | { kind: "set_field";          field: "bake_loss_pct" | "target_loaf_g" | "machine";
                                  value: number | string | null; rationale: string; }
  | { kind: "set_role";           uid: string; role: Role; rationale: string; };

export type ApplyFixErrorCode =
  | "unknown_uid" | "unknown_kind" | "invalid_payload" | "post_apply_invalid"
  | "negative_grams" | "value_type_mismatch";

export interface ApplyFixError {
  code: ApplyFixErrorCode;
  message: string;
  details?: unknown;
}

export type ApplyFixResult =
  | { ok: true;  recipe: Recipe }
  | { ok: false; error: ApplyFixError };

export interface BreakdownEntry {
  uid: string;
  ingredient_id: string;
  grams: number;
  contribution_g: number;
  contribution_g_effective?: number;
}

export interface ComputedRecipe {
  recipe: Recipe;

  tree: ExplainTree;

  metrics: {
    total_mass_g: number;
    total_flour_g: number;
    total_inclusions_g: number;
    total_water_g_nominal: number;
    total_water_g_effective: number;
    total_salt_g_equivalent: number;
    total_sugar_g_equivalent: number;
    total_fat_g_equivalent: number;
    total_alcohol_g: number;
    predicted_loaf_g: number;
  };

  hydration: {
    effective_pct: number | null;
    nominal_pct: number | null;
    total_liquid_pct: number | null;
    zone: HydrationZone | null;
  };

  bakers_percents: {
    by_uid: Record<string, number | null>;
    by_ingredient_id: Record<string, number[]>;
    salt_equivalent_pct: number | null;
    sugar_equivalent_pct: number | null;
    fat_equivalent_pct: number | null;
    yeast_pct: number | null;
  };

  ddt_water_absorption_pct: number | null;

  warnings: Warning[];

  breakdowns: {
    water: BreakdownEntry[];
    salt: BreakdownEntry[];
    sugar: BreakdownEntry[];
    fat: BreakdownEntry[];
  };
}

export class RecipeValidationError extends Error {
  readonly issues: Array<{ path: string; code: string; message: string }>;
  constructor(issues: Array<{ path: string; code: string; message: string }>) {
    super(`recipe validation failed: ${issues.length} issue(s)`);
    this.name = "RecipeValidationError";
    this.issues = issues;
  }
}

export interface RecipeValidationResult {
  valid: boolean;
  issues: Array<{ path: string; code: string; message: string }>;
}

// ----- Phase 2: derivation tree types -----

export type ExplainTree = ExplainNode;

export type ExplainNode =
  | ConstantNode
  | ProjectFieldNode
  | SumNode
  | WeightedSumNode
  | ProductNode
  | RatioNode
  | ScaleNode
  | ProjectFromTreeNode;

interface BaseNode { id: string; label: string; }

export interface ConstantNode extends BaseNode {
  type: "Constant";
  value: number;
  unit?: string;
}

export interface ProjectFieldNode extends BaseNode {
  type: "ProjectField";
  source_uid: string;
  field: string;        // e.g. "grams", "ingredient.water_pct"
  value: number;
}

export interface SumNode extends BaseNode {
  type: "Sum";
  terms: ExplainNode[];
  value: number | null;
}

export interface WeightedSumNode extends BaseNode {
  type: "WeightedSum";
  terms: Array<{ weight: ExplainNode; value: ExplainNode }>;
  value: number | null;
}

export interface ProductNode extends BaseNode {
  type: "Product";
  factors: ExplainNode[];
  value: number | null;
}

export interface RatioNode extends BaseNode {
  type: "Ratio";
  numerator: ExplainNode;
  denominator: ExplainNode;
  value: number | null;     // null when denominator is 0
}

export interface ScaleNode extends BaseNode {
  type: "Scale";
  input: ExplainNode;
  factor: number;
  value: number | null;
}

export interface ProjectFromTreeNode extends BaseNode {
  type: "ProjectFromTree";
  ref_id: string;           // id of another node in the same tree
  value: number | null;
}
