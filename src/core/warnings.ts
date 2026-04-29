// src/core/warnings.ts
import type { ComputedRecipe, Database, Warning, IngredientFlag, RecipeItem, Ingredient, Machine } from "./types.js";

interface RuleCtx {
  computed: ComputedRecipe;
  db: Database;
  resolved: Array<{ item: RecipeItem; ingredient: Ingredient | null; role: string; grams: number }>;
  machine: Machine;
}

type Rule = (ctx: RuleCtx) => Warning | null;

function hasFlag(ctx: RuleCtx, flag: IngredientFlag): boolean {
  return ctx.resolved.some((r) => r.ingredient?.flags?.includes(flag));
}
function gramsByFlag(ctx: RuleCtx, flag: IngredientFlag): number {
  return ctx.resolved.filter((r) => r.ingredient?.flags?.includes(flag)).reduce((s, r) => s + r.grams, 0);
}
function gramsByCategory(ctx: RuleCtx, cat: string): number {
  return ctx.resolved.filter((r) => r.ingredient?.category === cat).reduce((s, r) => s + r.grams, 0);
}

const rules: Rule[] = [
  // pan_overflow
  ({ computed, machine }) =>
    computed.totals.predicted_loaf_g > machine.pan_overflow_threshold_g
      ? { code: "pan_overflow_predicted", severity: "error", message: `Predicted loaf weight ${computed.totals.predicted_loaf_g} g exceeds pan threshold ${machine.pan_overflow_threshold_g} g.` }
      : null,
  // pan_underfill
  ({ computed, machine }) =>
    computed.totals.predicted_loaf_g < machine.pan_underfill_threshold_g
      ? { code: "pan_underfill_predicted", severity: "info", message: `Predicted loaf weight ${computed.totals.predicted_loaf_g} g may underfill the pan (typical minimum ${machine.pan_underfill_threshold_g} g).` }
      : null,
  // under-developed gluten
  ({ computed }) => {
    const eff = computed.hydration.effective_pct;
    const ddt = computed.ddt_water_absorption_pct;
    if (eff != null && ddt != null && eff < ddt) {
      return { code: "under_developed_gluten", severity: "warn", message: `Effective hydration ${eff}% is below this flour's DDT-WA of ${ddt}%; gluten may not develop fully.` };
    }
    return null;
  },
  // sugar
  ({ computed }) =>
    (computed.bakers_pcts.sugar_equivalent_pct ?? 0) > 12
      ? { code: "sugar_too_high", severity: "warn", message: `Sugar equivalent ${computed.bakers_pcts.sugar_equivalent_pct}% > 12% may inhibit yeast.` }
      : null,
  // salt
  ({ computed }) =>
    (computed.bakers_pcts.salt_equivalent_pct ?? 0) > 2.5
      ? { code: "salt_too_high", severity: "warn", message: `Salt equivalent ${computed.bakers_pcts.salt_equivalent_pct}% > 2.5%.` }
      : null,
  // salt_inherent_dominant — paired with salt_too_high
  ({ computed, resolved }) => {
    const salt = (computed.bakers_pcts.salt_equivalent_pct ?? 0);
    if (salt <= 2.5) return null;
    const declaredSaltGrams = resolved.filter((r) => r.role === "salt").reduce((s, r) => s + r.grams, 0);
    const inherentSaltGrams = computed.totals.total_salt_g_equivalent - declaredSaltGrams;
    return inherentSaltGrams > declaredSaltGrams
      ? { code: "salt_inherent_dominant", severity: "info", message: `Most salt comes from ingredients (${inherentSaltGrams.toFixed(1)} g) rather than declared salt (${declaredSaltGrams.toFixed(1)} g).` }
      : null;
  },
  // fat
  ({ computed }) =>
    (computed.bakers_pcts.fat_equivalent_pct ?? 0) > 12
      ? { code: "fat_too_high", severity: "warn", message: `Fat equivalent ${computed.bakers_pcts.fat_equivalent_pct}% > 12% may interfere with gluten.` }
      : null,
  // enzymatic
  ({ computed }) => {
    const has = computed.water_breakdown.length > 0; // proxy
    if (!has) return null;
    return null;
  },
  // (real enzymatic check uses resolved/flags)
  (ctx) => {
    const offenders = ctx.resolved
      .filter((r) => r.ingredient?.flags?.includes("enzymatic_protease"))
      .map((r) => r.item.ingredient_id);
    const heatTreated = (ctx.computed.recipe.notes ?? "").toLowerCase().includes("heat-treated");
    return offenders.length > 0 && !heatTreated
      ? { code: "enzymatic_gluten_degradation", severity: "warn", message: `Enzymatic ingredients (${offenders.join(", ")}) may degrade gluten unless heat-treated.`, related_ingredient_ids: offenders }
      : null;
  },
  // inclusions
  ({ computed, machine }) => {
    if (computed.totals.total_flour_g === 0) return null;
    const ratio = computed.totals.total_inclusions_g / computed.totals.total_flour_g;
    return ratio > machine.inclusion_max_fraction_of_flour
      ? { code: "inclusions_exceed_pan", severity: "warn", message: `Inclusions are ${(ratio * 100).toFixed(0)}% of flour, above the ${machine.inclusion_max_fraction_of_flour * 100}% recommended maximum.` }
      : null;
  },
  // wet zone
  (ctx) => {
    if (ctx.computed.hydration.zone !== "wet") return null;
    if (hasFlag(ctx, "gluten_strengthener")) return null;
    return { code: "wet_zone_needs_gluten_support", severity: "warn", message: "Hydration is in the 'Wet' zone (67–75%); add vital wheat gluten or a high-protein flour for structure." };
  },
  // very wet zone
  (ctx) => {
    if (ctx.computed.hydration.zone !== "very_wet") return null;
    if (hasFlag(ctx, "gf_stabilizer")) return null;
    if (gramsByCategory(ctx, "eggs") > 0) return null;
    return { code: "very_wet_zone", severity: "warn", message: "Hydration is in the 'Very wet' zone (≥75%); add a GF stabilizer (xanthan/psyllium) or eggs." };
  },
  // alcohol
  ({ computed }) => {
    if (computed.totals.total_mass_g === 0) return null;
    const ratio = computed.totals.total_alcohol_g / computed.totals.total_mass_g;
    return ratio > 0.03
      ? { code: "alcohol_yeast_inhibition", severity: "warn", message: `Alcohol is ${(ratio * 100).toFixed(1)}% of total mass; >3% suppresses yeast.` }
      : null;
  },
  // no yeast
  ({ resolved }) => {
    const y = resolved.filter((r) => r.role === "yeast" || r.role === "leavener").reduce((s, r) => s + r.grams, 0);
    return y === 0 ? { code: "no_yeast_or_leavener", severity: "warn", message: "No yeast or leavener detected." } : null;
  },
  // late water release
  (ctx) => hasFlag(ctx, "late_water_release")
    ? { code: "late_water_release_present", severity: "info", message: "Recipe contains ingredients that release water late in the knead (frozen fruit, raw zucchini, etc.); pre-drain or pre-cook for better results." }
    : null,
  // humectant
  (ctx) => {
    const hum = gramsByFlag(ctx, "humectant_bound_water");
    const flour = ctx.computed.totals.total_flour_g;
    if (flour === 0 || hum / flour <= 0.10) return null;
    const overrides = ctx.computed.recipe.free_water_factor_overrides ?? {};
    const ids = ctx.resolved.filter((r) => r.ingredient?.flags?.includes("humectant_bound_water")).map((r) => r.item.ingredient_id);
    if (ids.every((id) => id in overrides)) return null;
    return { code: "humectant_overestimate_risk", severity: "info", message: "Humectant ingredients (honey, syrups, dried fruit) hold water tightly; the calculator may overestimate effective hydration. Consider a per-ingredient free_water_factor override." };
  },
  // flour atypical
  ({ computed, machine }) => {
    const f = computed.totals.total_flour_g;
    if (f === 0) return null;
    return f < machine.flour_quantity_typical_min_g || f > machine.flour_quantity_typical_max_g
      ? { code: "flour_quantity_atypical", severity: "info", message: `Flour weight ${f} g is outside the typical BB-PDC20 range ${machine.flour_quantity_typical_min_g}–${machine.flour_quantity_typical_max_g} g.` }
      : null;
  },
  // no salt
  ({ computed }) => (computed.bakers_pcts.salt_equivalent_pct ?? 0) < 0.5
    ? { code: "no_salt", severity: "info", message: "Salt equivalent is below 0.5%; bread may taste flat unless intentional." }
    : null,
];

export function runWarnings(ctx: RuleCtx): Warning[] {
  if (ctx.computed.totals.total_flour_g === 0) {
    return [{ code: "no_flour", severity: "error", message: "Recipe has no flour; cannot compute hydration." }];
  }
  const out: Warning[] = [];
  for (const rule of rules) {
    const w = rule(ctx);
    if (w) out.push(w);
  }
  return out;
}
