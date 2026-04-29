import type { Recipe, RecipeItem, Database, Ingredient, Flour, ExplainNode, ExplainTree } from "./types.js";
import { inferRole } from "./role.js";
import { solveWithError } from "./solve.js";

let _idCounter = 0;
function freshId(prefix: string): string { return `${prefix}_${(++_idCounter).toString(36)}`; }

// resolveItem mirrors compute.ts's resolveItem but returns only what we need
// for tree construction. Kept in this module so explain-tree is self-contained.
interface Resolved {
  item: RecipeItem;
  ingredient: Ingredient | null;
  flour: Flour | null;
  grams: number;
  role: string;
  freeWaterFactor: number;
  water_pct: number;
  salt_pct: number;
  sugar_pct: number;
  fat_pct: number;
  alcohol_pct: number;
}

function resolve(item: RecipeItem, db: Database, recipe: Recipe): Resolved {
  const ingredient = db.ingredients.find((i) => i.id === item.ingredient_id) ?? null;
  const flour = db.flours.find((f) => f.id === item.ingredient_id) ?? null;
  const grams = item.grams ?? 0;
  const isLiquid = ingredient?.is_liquid ?? false;
  const categoryForDefaults = ingredient?.category ?? "flour";
  const role = item.role ?? (flour ? "flour" : inferRole(categoryForDefaults as never, isLiquid));
  const overrideFwf = recipe.free_water_factor_overrides?.[item.ingredient_id];
  const baseFwf = ingredient?.free_water_factor ?? db.defaults.default_free_water_factors_by_category[categoryForDefaults as never] ?? 0;
  return {
    item, ingredient, flour, grams, role,
    freeWaterFactor: overrideFwf ?? baseFwf,
    water_pct:   ingredient?.water_pct   ?? 0,
    salt_pct:    ingredient?.salt_pct    ?? 0,
    sugar_pct:   ingredient?.sugar_pct   ?? 0,
    fat_pct:     ingredient?.fat_pct     ?? 0,
    alcohol_pct: ingredient?.alcohol_pct ?? 0,
  };
}

function constNode(label: string, value: number, unit?: string): ExplainNode {
  return { type: "Constant", id: freshId("c"), label, value, ...(unit ? { unit } : {}) } as ExplainNode;
}

function projectField(label: string, uid: string, field: string, value: number): ExplainNode {
  return { type: "ProjectField", id: freshId("pf"), label, source_uid: uid, field, value } as ExplainNode;
}

function sumOf(label: string, terms: ExplainNode[]): ExplainNode {
  let v: number | null = 0;
  for (const t of terms) {
    if (t.value === null) { v = null; break; }
    v += t.value as number;
  }
  return { type: "Sum", id: freshId("s"), label, terms, value: v } as ExplainNode;
}

function productOf(label: string, factors: ExplainNode[]): ExplainNode {
  let v: number | null = 1;
  for (const f of factors) {
    if (f.value === null) { v = null; break; }
    v *= f.value as number;
  }
  return { type: "Product", id: freshId("p"), label, factors, value: v } as ExplainNode;
}

function ratioOf(label: string, numerator: ExplainNode, denominator: ExplainNode): ExplainNode {
  const n = numerator.value, d = denominator.value;
  const v = (n === null || d === null || d === 0) ? null : (n as number) / (d as number);
  return { type: "Ratio", id: freshId("r"), label, numerator, denominator, value: v } as ExplainNode;
}

function scaleOf(label: string, input: ExplainNode, factor: number): ExplainNode {
  const v = input.value === null ? null : (input.value as number) * factor;
  return { type: "Scale", id: freshId("sc"), label, input, factor, value: v } as ExplainNode;
}

function refTree(label: string, refId: string, value: number | null): ExplainNode {
  return { type: "ProjectFromTree", id: freshId("rf"), label, ref_id: refId, value } as ExplainNode;
}

export function buildTree(recipe: Recipe, db: Database): ExplainTree {
  _idCounter = 0;  // Deterministic ids per call (essential for byte-identical output).
  const { recipe: solved } = solveWithError(recipe, db);
  const resolved = solved.items.map((it) => resolve(it, db, solved));

  // Per-item nominal water Product: grams × water_pct/100
  const nominalWaterTerms = resolved.map((r) => productOf(
    `nominal_water[${r.item.uid}]`,
    [
      projectField(`grams[${r.item.uid}]`, r.item.uid, "grams", r.grams),
      scaleOf(`water_frac[${r.item.uid}]`, projectField(`water_pct[${r.item.uid}]`, r.item.uid, "ingredient.water_pct", r.water_pct), 0.01),
    ],
  ));
  const totalNominalWater = sumOf("total_water_g_nominal", nominalWaterTerms);

  // Effective water = nominal × free_water_factor
  const effectiveWaterTerms = resolved.map((r, i) => productOf(
    `effective_water[${r.item.uid}]`,
    [nominalWaterTerms[i]!, constNode(`fwf[${r.item.uid}]`, r.freeWaterFactor)],
  ));
  const totalEffectiveWater = sumOf("total_water_g_effective", effectiveWaterTerms);

  // total_flour_g
  const flourTerms = resolved.filter((r) => r.role === "flour").map((r) =>
    projectField(`flour_grams[${r.item.uid}]`, r.item.uid, "grams", r.grams),
  );
  const totalFlour = sumOf("total_flour_g", flourTerms);

  // total_mass_g
  const massTerms = resolved.map((r) => projectField(`mass[${r.item.uid}]`, r.item.uid, "grams", r.grams));
  const totalMass = sumOf("total_mass_g", massTerms);

  // total_inclusions_g
  const inclusionTerms = resolved.filter((r) => r.role === "inclusion").map((r) =>
    projectField(`incl[${r.item.uid}]`, r.item.uid, "grams", r.grams),
  );
  const totalInclusions = sumOf("total_inclusions_g", inclusionTerms);

  // Per-item salt/sugar/fat/alcohol products and totals (same shape as nominal water).
  const saltTerms = resolved.map((r) => productOf(
    `salt[${r.item.uid}]`,
    [projectField(`grams[${r.item.uid}]`, r.item.uid, "grams", r.grams),
     scaleOf(`salt_frac[${r.item.uid}]`, projectField(`salt_pct[${r.item.uid}]`, r.item.uid, "ingredient.salt_pct", r.salt_pct), 0.01)],
  ));
  const totalSalt = sumOf("total_salt_g_equivalent", saltTerms);

  const sugarTerms = resolved.map((r) => productOf(
    `sugar[${r.item.uid}]`,
    [projectField(`grams[${r.item.uid}]`, r.item.uid, "grams", r.grams),
     scaleOf(`sugar_frac[${r.item.uid}]`, projectField(`sugar_pct[${r.item.uid}]`, r.item.uid, "ingredient.sugar_pct", r.sugar_pct), 0.01)],
  ));
  const totalSugar = sumOf("total_sugar_g_equivalent", sugarTerms);

  const fatTerms = resolved.map((r) => productOf(
    `fat[${r.item.uid}]`,
    [projectField(`grams[${r.item.uid}]`, r.item.uid, "grams", r.grams),
     scaleOf(`fat_frac[${r.item.uid}]`, projectField(`fat_pct[${r.item.uid}]`, r.item.uid, "ingredient.fat_pct", r.fat_pct), 0.01)],
  ));
  const totalFat = sumOf("total_fat_g_equivalent", fatTerms);

  const alcoholTerms = resolved.map((r) => productOf(
    `alcohol[${r.item.uid}]`,
    [projectField(`grams[${r.item.uid}]`, r.item.uid, "grams", r.grams),
     scaleOf(`alcohol_frac[${r.item.uid}]`, projectField(`alcohol_pct[${r.item.uid}]`, r.item.uid, "ingredient.alcohol_pct", r.alcohol_pct), 0.01)],
  ));
  const totalAlcohol = sumOf("total_alcohol_g", alcoholTerms);

  // Hydration ratios
  const effectivePct = scaleOf("effective_pct",  ratioOf("effective_ratio",  totalEffectiveWater, totalFlour), 100);
  const nominalPct   = scaleOf("nominal_pct",    ratioOf("nominal_ratio",    totalNominalWater,   totalFlour), 100);

  // Bake loss → predicted loaf
  const bakeLossPct = recipe.bake_loss_pct ?? db.defaults.default_bake_loss_pct;
  const lossFactor = 1 - bakeLossPct / 100;
  const predictedLoaf = scaleOf("predicted_loaf_g", refTree("total_mass_ref", totalMass.id, totalMass.value), lossFactor);

  // Root: Sum of named projections so consumers can find each by label.
  const root = sumOf("computed_recipe_root", [
    totalMass, totalFlour, totalInclusions,
    totalNominalWater, totalEffectiveWater,
    totalSalt, totalSugar, totalFat, totalAlcohol,
    effectivePct, nominalPct,
    predictedLoaf,
  ]);
  return root;
}

export function projectByLabel(tree: ExplainTree, label: string): number | null {
  // BFS over Sum/WeightedSum/Product/Ratio/Scale children to find first node with matching label.
  const stack: ExplainNode[] = [tree];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (n.label === label) return n.value;
    switch (n.type) {
      case "Sum":         stack.push(...n.terms); break;
      case "WeightedSum": for (const p of n.terms) { stack.push(p.weight, p.value); } break;
      case "Product":     stack.push(...n.factors); break;
      case "Ratio":       stack.push(n.numerator, n.denominator); break;
      case "Scale":       stack.push(n.input); break;
      default: break;
    }
  }
  return null;
}

export interface EvaluateResult {
  ok: boolean;
  mismatches: Array<{ node_id: string; stored: number | null; recomputed: number | null }>;
}

const MAX_DEPTH = 10_000;

export function evaluateTree(tree: ExplainTree): EvaluateResult {
  // Build a flat id → node map for ProjectFromTree resolution.
  const byId = new Map<string, ExplainNode>();
  function indexAll(n: ExplainNode): void {
    byId.set(n.id, n);
    switch (n.type) {
      case "Sum":         for (const t of n.terms) indexAll(t); break;
      case "WeightedSum": for (const p of n.terms) { indexAll(p.weight); indexAll(p.value); } break;
      case "Product":     for (const f of n.factors) indexAll(f); break;
      case "Ratio":       indexAll(n.numerator); indexAll(n.denominator); break;
      case "Scale":       indexAll(n.input); break;
      default: break;
    }
  }
  indexAll(tree);

  // recompute(n): locally re-derives the value for node n, including cycle detection for
  // ProjectFromTree ref chains. This deliberately does NOT use the registry's evaluate
  // dispatch (which would lose cycle tracking in recursive calls).
  const inProgress = new Set<string>(); // node ids currently open in recompute call stack

  function recompute(n: ExplainNode): number | null {
    switch (n.type) {
      case "Constant":     return n.value;
      case "ProjectField": return n.value;
      case "Sum": {
        let s = 0;
        for (const t of n.terms) {
          const v = recompute(t);
          if (v === null) return null;
          s += v;
        }
        return s;
      }
      case "WeightedSum": {
        let s = 0;
        for (const { weight, value } of n.terms) {
          const w = recompute(weight);
          const v = recompute(value);
          if (w === null || v === null) return null;
          s += w * v;
        }
        return s;
      }
      case "Product": {
        let p = 1;
        for (const f of n.factors) {
          const v = recompute(f);
          if (v === null) return null;
          p *= v;
        }
        return p;
      }
      case "Ratio": {
        const num = recompute(n.numerator);
        const den = recompute(n.denominator);
        if (num === null || den === null || den === 0) return null;
        return num / den;
      }
      case "Scale": {
        const v = recompute(n.input);
        return v === null ? null : v * n.factor;
      }
      case "ProjectFromTree": {
        const target = byId.get(n.ref_id) ?? null;
        if (!target) return null;
        if (inProgress.has(target.id)) {
          throw new Error(`evaluateTree: cycle detected — node "${target.id}" is already being evaluated`);
        }
        inProgress.add(target.id);
        try {
          return recompute(target);
        } finally {
          inProgress.delete(target.id);
        }
      }
    }
  }

  let depth = 0;
  const mismatches: EvaluateResult["mismatches"] = [];

  function walk(n: ExplainNode): void {
    if (++depth > MAX_DEPTH) throw new Error(`evaluateTree: max depth ${MAX_DEPTH} exceeded — cycle?`);

    const recomputed = recompute(n);

    if (recomputed !== n.value && !(Number.isNaN(recomputed as number) && Number.isNaN(n.value as number))) {
      // Allow tiny float drift (≤1e-9) before flagging.
      if (recomputed === null || n.value === null || Math.abs(recomputed - (n.value as number)) > 1e-9) {
        mismatches.push({ node_id: n.id, stored: n.value, recomputed });
      }
    }
    switch (n.type) {
      case "Sum":         for (const c of n.terms) walk(c); break;
      case "WeightedSum": for (const p of n.terms) { walk(p.weight); walk(p.value); } break;
      case "Product":     for (const c of n.factors) walk(c); break;
      case "Ratio":       walk(n.numerator); walk(n.denominator); break;
      case "Scale":       walk(n.input); break;
      // ProjectFromTree: follow the ref via env.lookup so cycles in the walk are detectable.
      case "ProjectFromTree": {
        const target = byId.get(n.ref_id) ?? null;
        if (target) walk(target);
        break;
      }
      default: break;
    }
    depth--;
  }
  walk(tree);
  return { ok: mismatches.length === 0, mismatches };
}
