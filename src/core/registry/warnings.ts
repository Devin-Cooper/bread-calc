import { createRegistry, type Registry } from "./base.js";
import type { ComputedRecipe, Database, Fix, Ingredient, Machine, RecipeItem, WarningCode, IngredientFlag } from "../types.js";

export interface WarningCtx {
  computed: ComputedRecipe;
  db: Database;
  resolved: Array<{ item: RecipeItem; ingredient: Ingredient | null; role: string; grams: number }>;
  machine: Machine;
}

export interface WarningRule {
  code: WarningCode;
  severity_default: "info" | "warn" | "error";
  description: string;
  category: "math" | "machine" | "ingredient" | "structural";
  consumes: ReadonlyArray<string>;
  // Static "this rule can suggest fixes" flag, surfaced by describe(). Set to
  // false for purely informational/structural rules whose `fixes()` always
  // returns `[]`. This is a documentation hint — describe() reports it
  // verbatim; the runtime always calls `fixes()` to get the actual list.
  has_fixes: boolean;
  evaluate(ctx: WarningCtx):
    | { fired: true; severity?: "info" | "warn" | "error"; message: string; related_uids?: string[] }
    | { fired: false };
  fixes(ctx: WarningCtx, fired: { message: string; related_uids?: string[] }): readonly Fix[];
}

export const warningRules: Registry<WarningRule> = createRegistry<WarningRule>((r) => r.code);

// Helpers ---------------------------------------------------------------------
function uidsByFlag(ctx: WarningCtx, flag: IngredientFlag): string[] {
  return ctx.resolved.filter((r) => r.ingredient?.flags?.includes(flag)).map((r) => r.item.uid);
}
function hasFlag(ctx: WarningCtx, flag: IngredientFlag): boolean {
  return ctx.resolved.some((r) => r.ingredient?.flags?.includes(flag));
}
function gramsByFlag(ctx: WarningCtx, flag: IngredientFlag): number {
  return ctx.resolved.filter((r) => r.ingredient?.flags?.includes(flag)).reduce((s, r) => s + r.grams, 0);
}
function gramsByCategory(ctx: WarningCtx, cat: string): number {
  return ctx.resolved.filter((r) => r.ingredient?.category === cat).reduce((s, r) => s + r.grams, 0);
}

// Rules -----------------------------------------------------------------------

warningRules.register({
  code: "no_flour",
  severity_default: "error",
  description: "Recipe contains no flour items; hydration cannot be computed.",
  category: "structural",
  consumes: ["metrics.total_flour_g"],
  has_fixes: false,
  evaluate(ctx) {
    return ctx.computed.totals.total_flour_g === 0
      ? { fired: true, message: "Recipe has no flour; cannot compute hydration." }
      : { fired: false };
  },
  fixes() { return []; },  // structural; agent must add a flour item via the picker
});

warningRules.register({
  code: "pan_overflow_predicted",
  severity_default: "error",
  description: "Predicted loaf weight exceeds the pan overflow threshold.",
  category: "machine",
  consumes: ["metrics.predicted_loaf_g", "machine.pan_overflow_threshold_g"],
  has_fixes: true,
  evaluate({ computed, machine }) {
    if (computed.totals.predicted_loaf_g > machine.pan_overflow_threshold_g) {
      return { fired: true,
        message: `Predicted loaf weight ${computed.totals.predicted_loaf_g} g exceeds pan threshold ${machine.pan_overflow_threshold_g} g.` };
    }
    return { fired: false };
  },
  fixes(ctx) {
    const flourItem = ctx.resolved.find((r) => r.role === "flour");
    if (!flourItem) return [];
    const ratio = ctx.machine.pan_overflow_threshold_g / ctx.computed.totals.predicted_loaf_g;
    return [{
      kind: "decrease_grams",
      uid: flourItem.item.uid,
      delta_g: Math.round(flourItem.grams * (1 - ratio)),
      rationale: `Reduce flour to bring predicted loaf below ${ctx.machine.pan_overflow_threshold_g} g pan threshold.`,
    }];
  },
});

warningRules.register({
  code: "pan_underfill_predicted",
  severity_default: "info",
  description: "Predicted loaf weight is below the pan-underfill threshold.",
  category: "machine",
  consumes: ["metrics.predicted_loaf_g", "machine.pan_underfill_threshold_g"],
  has_fixes: false,
  evaluate({ computed, machine }) {
    return computed.totals.predicted_loaf_g < machine.pan_underfill_threshold_g
      ? { fired: true,
          message: `Predicted loaf weight ${computed.totals.predicted_loaf_g} g may underfill the pan (typical minimum ${machine.pan_underfill_threshold_g} g).` }
      : { fired: false };
  },
  fixes() { return []; },  // info-only
});

warningRules.register({
  code: "under_developed_gluten",
  severity_default: "warn",
  description: "Effective hydration is below the flour's DDT water-absorption.",
  category: "math",
  consumes: ["hydration.effective_pct", "ddt_water_absorption_pct"],
  has_fixes: true,
  evaluate({ computed }) {
    const eff = computed.hydration.effective_pct;
    const ddt = computed.ddt_water_absorption_pct;
    if (eff != null && ddt != null && eff < ddt) {
      return { fired: true, message: `Effective hydration ${eff}% is below this flour's DDT-WA of ${ddt}%; gluten may not develop fully.` };
    }
    return { fired: false };
  },
  fixes(ctx) {
    const water = ctx.resolved.find((r) => r.ingredient?.id === "water_tap" || r.role === "wet");
    if (!water) return [];
    return [{
      kind: "increase_grams",
      uid: water.item.uid,
      delta_g: 20,
      rationale: "Increase water by ~20 g to lift hydration toward the flour's DDT-WA.",
    }];
  },
});

warningRules.register({
  code: "sugar_too_high",
  severity_default: "warn",
  description: "Sugar equivalent exceeds 12% baker's percentage.",
  category: "ingredient",
  consumes: ["bakers_percents.sugar_equivalent_pct"],
  has_fixes: true,
  evaluate({ computed }) {
    const s = computed.bakers_pcts.sugar_equivalent_pct ?? 0;
    return s > 12
      ? { fired: true, message: `Sugar equivalent ${s}% > 12% may inhibit yeast.` }
      : { fired: false };
  },
  fixes(ctx) {
    const sugar = ctx.resolved.find((r) => r.role === "sweetener");
    if (!sugar) return [];
    const flour = ctx.computed.totals.total_flour_g;
    const targetSugarG = flour * 0.12;
    return [{
      kind: "set_grams",
      uid: sugar.item.uid,
      grams: Math.max(0, Math.round(targetSugarG)),
      rationale: "Cap declared sugar so total equivalent is ≤ 12% of flour.",
    }];
  },
});

warningRules.register({
  code: "salt_too_high",
  severity_default: "warn",
  description: "Salt equivalent exceeds 2.5% baker's percentage.",
  category: "ingredient",
  consumes: ["bakers_percents.salt_equivalent_pct"],
  has_fixes: true,
  evaluate({ computed }) {
    const s = computed.bakers_pcts.salt_equivalent_pct ?? 0;
    return s > 2.5
      ? { fired: true, message: `Salt equivalent ${s}% > 2.5%.` }
      : { fired: false };
  },
  fixes(ctx) {
    const salt = ctx.resolved.find((r) => r.role === "salt");
    if (!salt) return [];
    const flour = ctx.computed.totals.total_flour_g;
    const targetSaltG = flour * 0.025;
    const out: Fix[] = [{
      kind: "set_grams",
      uid: salt.item.uid,
      grams: Math.max(0, Math.round(targetSaltG * 10) / 10),
      rationale: "Cap declared salt at 2.5% of flour.",
    }];
    const flourItem = ctx.resolved.find((r) => r.role === "flour");
    if (flourItem) {
      out.push({
        kind: "increase_grams",
        uid: flourItem.item.uid,
        delta_g: 50,
        rationale: "Alternative: dilute salt by adding 50 g flour.",
      });
    }
    return out;
  },
});

warningRules.register({
  code: "salt_inherent_dominant",
  severity_default: "info",
  description: "Most of the salt-equivalent comes from non-salt ingredients.",
  category: "ingredient",
  consumes: ["bakers_percents.salt_equivalent_pct", "resolved"],
  has_fixes: false,
  evaluate(ctx) {
    const salt = ctx.computed.bakers_pcts.salt_equivalent_pct ?? 0;
    if (salt <= 2.5) return { fired: false };
    const declared = ctx.resolved.filter((r) => r.role === "salt").reduce((s, r) => s + r.grams, 0);
    const inherent = ctx.computed.totals.total_salt_g_equivalent - declared;
    if (inherent > declared) {
      return { fired: true,
        message: `Most salt comes from ingredients (${inherent.toFixed(1)} g) rather than declared salt (${declared.toFixed(1)} g).` };
    }
    return { fired: false };
  },
  fixes() { return []; },
});

warningRules.register({
  code: "fat_too_high",
  severity_default: "warn",
  description: "Fat equivalent exceeds 12% baker's percentage.",
  category: "ingredient",
  consumes: ["bakers_percents.fat_equivalent_pct"],
  has_fixes: true,
  evaluate({ computed }) {
    const f = computed.bakers_pcts.fat_equivalent_pct ?? 0;
    return f > 12
      ? { fired: true, message: `Fat equivalent ${f}% > 12% may interfere with gluten.` }
      : { fired: false };
  },
  fixes(ctx) {
    const fat = ctx.resolved.find((r) => r.role === "fat");
    if (!fat) return [];
    const flour = ctx.computed.totals.total_flour_g;
    const targetFatG = flour * 0.12;
    return [{
      kind: "set_grams",
      uid: fat.item.uid,
      grams: Math.max(0, Math.round(targetFatG)),
      rationale: "Cap declared fat at 12% of flour.",
    }];
  },
});

warningRules.register({
  code: "enzymatic_gluten_degradation",
  severity_default: "warn",
  description: "Enzymatic ingredients may degrade gluten unless heat-treated.",
  category: "ingredient",
  consumes: ["resolved"],
  has_fixes: true,
  evaluate(ctx) {
    const offenders = uidsByFlag(ctx, "enzymatic_protease");
    const heatTreated = (ctx.computed.recipe.notes ?? "").toLowerCase().includes("heat-treated");
    if (offenders.length > 0 && !heatTreated) {
      return { fired: true,
        message: `Enzymatic ingredients may degrade gluten unless heat-treated.`,
        related_uids: offenders };
    }
    return { fired: false };
  },
  fixes(ctx, fired) {
    return (fired.related_uids ?? []).map((uid) => ({
      kind: "remove_ingredient" as const,
      uid,
      rationale: "Remove enzymatic ingredient, or heat-treat (note 'heat-treated' in recipe notes to silence).",
    }));
  },
});

warningRules.register({
  code: "inclusions_exceed_pan",
  severity_default: "warn",
  description: "Inclusions exceed the machine's recommended fraction of flour.",
  category: "machine",
  consumes: ["metrics.total_inclusions_g", "metrics.total_flour_g", "machine.inclusion_max_fraction_of_flour"],
  has_fixes: false,
  evaluate({ computed, machine }) {
    if (computed.totals.total_flour_g === 0) return { fired: false };
    const ratio = computed.totals.total_inclusions_g / computed.totals.total_flour_g;
    if (ratio > machine.inclusion_max_fraction_of_flour) {
      return { fired: true,
        message: `Inclusions are ${(ratio * 100).toFixed(0)}% of flour, above the ${machine.inclusion_max_fraction_of_flour * 100}% recommended maximum.` };
    }
    return { fired: false };
  },
  fixes() { return []; },  // multiple inclusions; agent picks
});

warningRules.register({
  code: "wet_zone_needs_gluten_support",
  severity_default: "warn",
  description: "Wet-zone hydration without a gluten strengthener.",
  category: "math",
  consumes: ["hydration.zone", "resolved"],
  has_fixes: true,
  evaluate(ctx) {
    if (ctx.computed.hydration.zone?.id !== "wet") return { fired: false };
    if (hasFlag(ctx, "gluten_strengthener")) return { fired: false };
    return { fired: true, message: "Hydration is in the 'Wet' zone (67–75%); add vital wheat gluten or a high-protein flour for structure." };
  },
  fixes() {
    return [{
      kind: "add_ingredient",
      ingredient_id: "vital_wheat_gluten",
      bakers_pct: 1.5,
      rationale: "Add ~1.5% vital wheat gluten for structural support in the wet zone.",
    }];
  },
});

warningRules.register({
  code: "very_wet_zone",
  severity_default: "warn",
  description: "Very-wet-zone hydration without a GF stabilizer or eggs.",
  category: "math",
  consumes: ["hydration.zone", "resolved"],
  has_fixes: true,
  evaluate(ctx) {
    if (ctx.computed.hydration.zone?.id !== "very_wet") return { fired: false };
    if (hasFlag(ctx, "gf_stabilizer")) return { fired: false };
    if (gramsByCategory(ctx, "eggs") > 0) return { fired: false };
    return { fired: true, message: "Hydration is in the 'Very wet' zone (≥75%); add a GF stabilizer (xanthan/psyllium) or eggs." };
  },
  fixes() {
    return [
      { kind: "add_ingredient", ingredient_id: "xanthan_gum",  bakers_pct: 0.5, rationale: "Add ~0.5% xanthan for very-wet zone stabilization." },
      { kind: "add_ingredient", ingredient_id: "egg_whole_large", grams: 50, rationale: "Alternative: add one whole egg." },
    ];
  },
});

warningRules.register({
  code: "alcohol_yeast_inhibition",
  severity_default: "warn",
  description: "Alcohol fraction of total mass exceeds 3%.",
  category: "ingredient",
  consumes: ["metrics.total_alcohol_g", "metrics.total_mass_g"],
  has_fixes: false,
  evaluate({ computed }) {
    if (computed.totals.total_mass_g === 0) return { fired: false };
    const ratio = computed.totals.total_alcohol_g / computed.totals.total_mass_g;
    return ratio > 0.03
      ? { fired: true, message: `Alcohol is ${(ratio * 100).toFixed(1)}% of total mass; >3% suppresses yeast.` }
      : { fired: false };
  },
  fixes() { return []; },
});

warningRules.register({
  code: "no_yeast_or_leavener",
  severity_default: "warn",
  description: "Recipe has no yeast or chemical leavener.",
  category: "structural",
  consumes: ["resolved"],
  has_fixes: true,
  evaluate({ resolved }) {
    const y = resolved.filter((r) => r.role === "yeast" || r.role === "leavener").reduce((s, r) => s + r.grams, 0);
    return y === 0
      ? { fired: true, message: "No yeast or leavener detected." }
      : { fired: false };
  },
  fixes() {
    return [{ kind: "add_ingredient", ingredient_id: "yeast_instant", grams: 5, rationale: "Add a small amount of instant yeast." }];
  },
});

warningRules.register({
  code: "late_water_release_present",
  severity_default: "info",
  description: "Recipe contains ingredients that release water late.",
  category: "ingredient",
  consumes: ["resolved"],
  has_fixes: false,
  evaluate(ctx) {
    return hasFlag(ctx, "late_water_release")
      ? { fired: true, message: "Recipe contains ingredients that release water late in the knead (frozen fruit, raw zucchini, etc.); pre-drain or pre-cook for better results.",
          related_uids: uidsByFlag(ctx, "late_water_release") }
      : { fired: false };
  },
  fixes() { return []; },  // info: human action, not a recipe edit
});

warningRules.register({
  code: "humectant_overestimate_risk",
  severity_default: "info",
  description: "Humectant ingredients may cause hydration overestimate.",
  category: "ingredient",
  consumes: ["resolved", "metrics.total_flour_g", "recipe.free_water_factor_overrides"],
  has_fixes: false,
  evaluate(ctx) {
    const hum = gramsByFlag(ctx, "humectant_bound_water");
    const flour = ctx.computed.totals.total_flour_g;
    if (flour === 0 || hum / flour <= 0.10) return { fired: false };
    const overrides = ctx.computed.recipe.free_water_factor_overrides ?? {};
    const ids = ctx.resolved.filter((r) => r.ingredient?.flags?.includes("humectant_bound_water")).map((r) => r.item.ingredient_id);
    if (ids.every((id) => id in overrides)) return { fired: false };
    return { fired: true, message: "Humectant ingredients (honey, syrups, dried fruit) hold water tightly; the calculator may overestimate effective hydration. Consider a per-ingredient free_water_factor override." };
  },
  fixes() { return []; },  // override is a recipe-level field, not item-level fix
});

warningRules.register({
  code: "flour_quantity_atypical",
  severity_default: "info",
  description: "Flour weight is outside the machine's typical range.",
  category: "machine",
  consumes: ["metrics.total_flour_g", "machine.flour_quantity_typical_min_g", "machine.flour_quantity_typical_max_g"],
  has_fixes: false,
  evaluate({ computed, machine }) {
    const f = computed.totals.total_flour_g;
    if (f === 0) return { fired: false };
    if (f < machine.flour_quantity_typical_min_g || f > machine.flour_quantity_typical_max_g) {
      return { fired: true,
        message: `Flour weight ${f} g is outside the typical BB-PDC20 range ${machine.flour_quantity_typical_min_g}–${machine.flour_quantity_typical_max_g} g.` };
    }
    return { fired: false };
  },
  fixes() { return []; },
});

warningRules.register({
  code: "no_salt",
  severity_default: "info",
  description: "Salt equivalent below 0.5%; bread may taste flat.",
  category: "ingredient",
  consumes: ["bakers_percents.salt_equivalent_pct"],
  has_fixes: true,
  evaluate({ computed }) {
    return (computed.bakers_pcts.salt_equivalent_pct ?? 0) < 0.5
      ? { fired: true, message: "Salt equivalent is below 0.5%; bread may taste flat unless intentional." }
      : { fired: false };
  },
  fixes(ctx) {
    const salt = ctx.resolved.find((r) => r.role === "salt");
    const flour = ctx.computed.totals.total_flour_g;
    const targetGrams = Math.round(flour * 0.018 * 10) / 10;  // 1.8% — common target
    if (salt) {
      return [{ kind: "set_grams", uid: salt.item.uid, grams: targetGrams, rationale: "Set salt to ~1.8% of flour for balanced flavor." }];
    }
    return [{ kind: "add_ingredient", ingredient_id: "salt_table", grams: targetGrams, rationale: "Add salt at ~1.8% of flour." }];
  },
});

// Solver-error warnings (emitted by computeRecipe based on solveWithError result).

warningRules.register({
  code: "solver_overconstrained",
  severity_default: "error",
  description: "Fixed-gram items already exceed target dough mass.",
  category: "structural",
  consumes: ["recipe.target_loaf_g", "resolved"],
  has_fixes: true,
  evaluate() { return { fired: false }; },  // not auto-evaluated; emitted from compute on solver error
  fixes(ctx) {
    const target = ctx.computed.recipe.target_loaf_g;
    if (target == null) return [];
    const fixedItems = ctx.resolved.filter((r) => r.item.grams != null && r.item.grams > 0);
    const fixedSum = fixedItems.reduce((s, r) => s + r.grams, 0);
    if (fixedSum <= target) return [];  // shouldn't have fired
    // Compute the dough mass that fits target_loaf_g (account for bake loss)
    const bakeLossPct = ctx.computed.recipe.bake_loss_pct ?? ctx.db.defaults.default_bake_loss_pct;
    const targetDoughMass = target / (1 - bakeLossPct / 100);
    const k = targetDoughMass / fixedSum;  // 0 < k < 1
    // For each fixed item, propose decrease_grams of (1 - k) * grams
    return fixedItems.map((r) => ({
      kind: "decrease_grams" as const,
      uid: r.item.uid,
      delta_g: Math.max(0.1, Math.round((1 - k) * r.grams * 10) / 10),  // round to 0.1g
      rationale: `Reduce by ${((1 - k) * 100).toFixed(0)}% to fit ${target} g target loaf weight.`,
    }));
  },
});

warningRules.register({
  code: "solver_ambiguous_flour",
  severity_default: "error",
  description: "Fixed-gram flour mixed with bakers_pct on other items.",
  category: "structural",
  consumes: ["resolved"],
  has_fixes: true,
  evaluate() { return { fired: false }; },  // emitted from compute
  fixes(ctx) {
    const flourFixed = ctx.resolved.find((r) => r.role === "flour" && r.item.grams != null);
    const out: Fix[] = [];
    if (flourFixed) {
      // Alternative 1: clear flour grams. The solver will derive flour from the
      // bakers_pct of other items targeting target_loaf_g.
      out.push({
        kind: "set_grams",
        uid: flourFixed.item.uid,
        grams: 0,
        rationale: "Clear fixed grams on flour and let the solver derive it from bakers_pct on other items.",
      });
    }
    // Alternative 2 ("remove bakers_pct from non-flour items") would require a
    // FixKind that deletes the bakers_pct field. v2.0's closed 8-kind enum has
    // set_bakers_pct (number, ≥0) but no clear_bakers_pct. Setting bakers_pct=0
    // does not match the intent — the solver still treats the item as
    // percent-mode (since bakers_pct is not null). A future minor version may
    // add clear_bakers_pct; for now, alternative 1 is the only structured fix.
    // Agents that prefer the second alternative can manually edit the recipe.
    return out;
  },
});

warningRules.register({
  code: "target_loaf_g_ignored_no_pcts",
  severity_default: "info",
  description: "target_loaf_g is set but no items use bakers_pct.",
  category: "structural",
  consumes: ["recipe.target_loaf_g", "resolved"],
  has_fixes: false,
  evaluate() { return { fired: false }; },  // emitted from compute
  fixes() { return []; },
});

export function runWarnings(ctx: WarningCtx): { warnings: import("../types.js").Warning[] } {
  const out: import("../types.js").Warning[] = [];
  for (const rule of warningRules.list()) {
    const r = rule.evaluate(ctx);
    if (!r.fired) continue;
    const fired = { message: r.message, ...(r.related_uids ? { related_uids: r.related_uids } : {}) };
    out.push({
      code: rule.code,
      severity: r.severity ?? rule.severity_default,
      message: r.message,
      ...(r.related_uids ? { related_uids: r.related_uids } : {}),
      suggested_fixes: [...rule.fixes(ctx, fired)],
    });
  }
  return { warnings: out };
}

export function emitSolverWarning(
  ctx: WarningCtx,
  code: "solver_overconstrained" | "solver_ambiguous_flour" | "target_loaf_g_ignored_no_pcts",
  message: string,
): import("../types.js").Warning {
  const rule = warningRules.get(code)!;
  return {
    code,
    severity: rule.severity_default,
    message,
    suggested_fixes: [...rule.fixes(ctx, { message })],
  };
}
