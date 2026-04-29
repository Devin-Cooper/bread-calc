import type {
  Recipe, RecipeItem, Database, Ingredient, Flour, ComputedRecipe, Role, Warning,
} from "./types.js";
import { inferRole } from "./role.js";
import { computeWeightedDdtWa, type FlourComponent } from "./flour.js";
import { classifyZone } from "./zones.js";
import { solveWithError } from "./solve.js";
import { runWarnings, emitSolverWarning } from "./warnings.js";
import { buildTree, projectByLabel } from "./explain-tree.js";

interface ResolvedItem {
  item: RecipeItem;
  ingredient: Ingredient | null;
  flour: Flour | null;
  grams: number;
  role: Role;
  freeWaterFactor: number;
  is_liquid: boolean;
  water_pct: number;
  salt_pct: number;
  sugar_pct: number;
  fat_pct: number;
  alcohol_pct: number;
}

function resolveItem(item: RecipeItem, db: Database, recipe: Recipe): ResolvedItem {
  const ingredient = db.ingredients.find((i) => i.id === item.ingredient_id) ?? null;
  const flour = db.flours.find((f) => f.id === item.ingredient_id) ?? null;
  if (!ingredient && !flour) {
    throw new Error(`unknown_ingredient_id: ${item.ingredient_id}`);
  }
  const grams = item.grams ?? 0;
  const isLiquid = ingredient?.is_liquid ?? false;
  // Only used to look up the per-category default free_water_factor when an ingredient row
  // omits its own factor. Flour items hit the "flour" branch above and never reach this fallback.
  const categoryForDefaultsLookup = ingredient?.category ?? "flour";
  const role = item.role ?? (flour ? "flour" : inferRole(categoryForDefaultsLookup, isLiquid));
  const overrideFwf = recipe.free_water_factor_overrides?.[item.ingredient_id];
  const baseFwf = ingredient?.free_water_factor ?? db.defaults.default_free_water_factors_by_category[categoryForDefaultsLookup] ?? 0;
  return {
    item,
    ingredient,
    flour,
    grams,
    role,
    freeWaterFactor: overrideFwf ?? baseFwf,
    is_liquid: isLiquid,
    water_pct: ingredient?.water_pct ?? 0,
    salt_pct: ingredient?.salt_pct ?? 0,
    sugar_pct: ingredient?.sugar_pct ?? 0,
    fat_pct: ingredient?.fat_pct ?? 0,
    alcohol_pct: ingredient?.alcohol_pct ?? 0,
  };
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeRecipe(recipe: Recipe, db: Database): ComputedRecipe {
  // 1. Solve and resolve; collect solverError but don't emit warnings yet.
  const { recipe: solvedRecipe, error: solverError } = solveWithError(recipe, db);
  const resolved = solvedRecipe.items.map((it) => resolveItem(it, db, solvedRecipe));

  const tree = buildTree(solvedRecipe, db);
  const total_mass_g            = projectByLabel(tree, "total_mass_g")            ?? 0;
  const total_flour_g           = projectByLabel(tree, "total_flour_g")           ?? 0;
  const total_inclusions_g      = projectByLabel(tree, "total_inclusions_g")      ?? 0;
  const total_water_g_nominal   = projectByLabel(tree, "total_water_g_nominal")   ?? 0;
  const total_water_g_effective = projectByLabel(tree, "total_water_g_effective") ?? 0;
  const total_salt_g_equivalent = projectByLabel(tree, "total_salt_g_equivalent") ?? 0;
  const total_sugar_g_equivalent= projectByLabel(tree, "total_sugar_g_equivalent")?? 0;
  const total_fat_g_equivalent  = projectByLabel(tree, "total_fat_g_equivalent")  ?? 0;
  const total_alcohol_g         = projectByLabel(tree, "total_alcohol_g")         ?? 0;
  const predicted_loaf_g        = projectByLabel(tree, "predicted_loaf_g")        ?? 0;
  // total_liquid_g is not in the tree yet (added in Phase 4); compute locally from resolved.
  const total_liquid_g = resolved.filter((r) => r.is_liquid).reduce((s, r) => s + r.grams, 0);

  const flourComponents: FlourComponent[] = resolved
    .filter((r) => r.role === "flour" && r.flour)
    .map((r) => ({ flour: r.flour as Flour, grams: r.grams }));
  const ddt_water_absorption_pct = computeWeightedDdtWa(flourComponents);

  const hasFlour = total_flour_g > 0;
  const effective_pct = projectByLabel(tree, "effective_pct");
  const nominal_pct   = projectByLabel(tree, "nominal_pct");
  const total_liquid_pct = hasFlour ? (total_liquid_g / total_flour_g) * 100 : null;
  const zone = effective_pct === null ? null : classifyZone(effective_pct);

  const yeast_grams = resolved.filter((r) => r.role === "yeast").reduce((s, r) => s + r.grams, 0);

  // Build by_uid and by_ingredient_id
  const by_uid: Record<string, number | null> = {};
  const by_ingredient_id: Record<string, number[]> = {};
  for (const r of resolved) {
    const pct = hasFlour ? r2((r.grams / total_flour_g) * 100) : null;
    by_uid[r.item.uid] = pct;
    if (pct !== null) {
      if (!by_ingredient_id[r.item.ingredient_id]) by_ingredient_id[r.item.ingredient_id] = [];
      by_ingredient_id[r.item.ingredient_id]!.push(pct);
    }
  }

  // Build breakdowns from resolved (each entry uses uid + ingredient_id + grams + contribution_g)
  const breakdowns = {
    water: resolved.map((r) => ({
      uid: r.item.uid, ingredient_id: r.item.ingredient_id, grams: r.grams,
      contribution_g:           r2((r.grams * r.water_pct) / 100),
      contribution_g_effective: r2((r.grams * r.water_pct * r.freeWaterFactor) / 100),
    })),
    salt: resolved.map((r) => ({
      uid: r.item.uid, ingredient_id: r.item.ingredient_id, grams: r.grams,
      contribution_g: r2((r.grams * r.salt_pct) / 100),
    })),
    sugar: resolved.map((r) => ({
      uid: r.item.uid, ingredient_id: r.item.ingredient_id, grams: r.grams,
      contribution_g: r2((r.grams * r.sugar_pct) / 100),
    })),
    fat: resolved.map((r) => ({
      uid: r.item.uid, ingredient_id: r.item.ingredient_id, grams: r.grams,
      contribution_g: r2((r.grams * r.fat_pct) / 100),
    })),
  };

  const machine = db.machines.find((m) => m.id === (solvedRecipe.machine ?? db.defaults.default_machine_id))
                ?? db.machines[0]!;

  // 2. Build partial WITHOUT solver warnings (warnings: []).
  const partial: ComputedRecipe = {
    recipe: solvedRecipe,
    tree,
    metrics: {
      total_mass_g: r2(total_mass_g), total_flour_g: r2(total_flour_g), total_inclusions_g: r2(total_inclusions_g),
      total_water_g_nominal: r2(total_water_g_nominal), total_water_g_effective: r2(total_water_g_effective),
      total_salt_g_equivalent: r2(total_salt_g_equivalent), total_sugar_g_equivalent: r2(total_sugar_g_equivalent),
      total_fat_g_equivalent: r2(total_fat_g_equivalent), total_alcohol_g: r2(total_alcohol_g),
      predicted_loaf_g: r2(predicted_loaf_g),
    },
    hydration: {
      effective_pct: effective_pct === null ? null : r2(effective_pct),
      nominal_pct: nominal_pct === null ? null : r2(nominal_pct),
      total_liquid_pct: total_liquid_pct === null ? null : r2(total_liquid_pct),
      zone,
    },
    bakers_percents: {
      by_uid, by_ingredient_id,
      salt_equivalent_pct:  hasFlour ? r2((total_salt_g_equivalent  / total_flour_g) * 100) : null,
      sugar_equivalent_pct: hasFlour ? r2((total_sugar_g_equivalent / total_flour_g) * 100) : null,
      fat_equivalent_pct:   hasFlour ? r2((total_fat_g_equivalent   / total_flour_g) * 100) : null,
      yeast_pct:            hasFlour ? r2((yeast_grams / total_flour_g) * 100) : null,
    },
    ddt_water_absorption_pct: ddt_water_absorption_pct === null ? null : r2(ddt_water_absorption_pct),
    warnings: [],
    breakdowns,
  };

  // 3. Construct ctx and emit solver warnings (now that partial is available for fixes()).
  const ctxForRules = {
    computed: partial,
    db,
    resolved: resolved.map((r) => ({ item: r.item, ingredient: r.ingredient, role: r.role, grams: r.grams })),
    machine,
  };
  const allWarnings: Warning[] = [];
  if (solverError) {
    const messages: Record<string, string> = {
      solver_overconstrained: "Fixed-gram items already exceed the target dough mass.",
      solver_ambiguous_flour: "Cannot mix fixed flour grams with bakers' percentages on other items.",
      target_loaf_g_ignored_no_pcts: "target_loaf_g set but no items use bakers_pct; using your gram values directly.",
    };
    allWarnings.push(emitSolverWarning(ctxForRules, solverError, messages[solverError]!));
  }

  // 4. Run the rule registry (solver-error rules' evaluate() returns { fired: false }).
  const ruleWarnings = runWarnings(ctxForRules);
  allWarnings.push(...ruleWarnings);

  return { ...partial, warnings: allWarnings };
}
