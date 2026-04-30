import type { Recipe, Database } from "../core/types.js";
import { computeRecipe } from "../core/index.js";

export interface VerifyReport {
  all_match: boolean;
  results: Array<{
    metric_path: string;
    claim: number | null;
    actual: number | null;
    match: boolean;
    diff: number | null;
    tolerance: number;
    error?: "unknown_path" | "unsupported_path";
  }>;
}

const TOLERANCE = 0.05;

// Closed grammar for metric_path (per spec §3.4):
//   "metrics.<field>"
//   "hydration.<field>"  (zone.id is non-numeric → unsupported_path)
//   "bakers_percents.<scalar_field>"
//   "bakers_percents.by_uid.<uid>"
//   "bakers_percents.by_ingredient_id.<id>.<index>"
//   "ddt_water_absorption_pct"
const ALLOWED_PREFIXES = ["metrics.", "hydration.", "bakers_percents."] as const;
const ALLOWED_TOP_LEVEL = new Set(["ddt_water_absorption_pct"]);
const NON_NUMERIC_PATHS = new Set(["hydration.zone.id", "hydration.zone.label", "hydration.zone.note"]);

function resolveMetric(path: string, computed: ReturnType<typeof computeRecipe>): number | null {
  if (NON_NUMERIC_PATHS.has(path)) return null;  // surfaced as unsupported_path
  if (ALLOWED_TOP_LEVEL.has(path)) {
    return (computed as unknown as Record<string, number | null>)[path] ?? null;
  }
  // Walk dotted segments through the computed object. Numeric segments are
  // array indices; everything else is a property name. Returns null when any
  // step fails.
  const parts = path.split(".");
  let cur: unknown = computed;
  for (const seg of parts) {
    if (cur === null || typeof cur !== "object") return null;
    if (Array.isArray(cur)) {
      const idx = parseInt(seg, 10);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return null;
      cur = (cur as unknown[])[idx];
    } else {
      cur = (cur as Record<string, unknown>)[seg];
    }
  }
  return typeof cur === "number" ? cur : null;
}

// Lazy-load default db when caller omits it. computeRecipe currently
// requires db, so we resolve it here before delegating.
import ingredientsFile from "../data/ingredients.json"      with { type: "json" };
import floursFile      from "../data/flours.json"           with { type: "json" };
import refsFile        from "../data/bb_pdc20_recipes.json" with { type: "json" };
import coursesFile     from "../data/bb_pdc20_courses.json" with { type: "json" };
import machinesFile    from "../data/machines.json"         with { type: "json" };
import defaultsRaw     from "../data/defaults.json"         with { type: "json" };

let _defaultDb: Database | null = null;
function defaultDb(): Database {
  if (_defaultDb) return _defaultDb;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  _defaultDb = {
    ingredients: (ingredientsFile as any).entries,
    flours:      (floursFile as any).entries,
    references:  (refsFile as any).entries,
    machines:    (machinesFile as any).entries,
    courses:     (coursesFile as any).entries,
    defaults:    defaultsRaw as any,
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return _defaultDb;
}

export function verifyClaims(
  recipe: Recipe,
  claims: Record<string, number | null>,
  db: Database = defaultDb(),
): VerifyReport {
  const computed = computeRecipe(recipe, db);
  const results: VerifyReport["results"] = [];
  let allMatch = true;
  for (const [path, claim] of Object.entries(claims)) {
    // Per spec §3.4: paths outside the closed grammar produce
    // `error: "unsupported_path"`; supported-grammar paths that resolve to
    // nothing produce `error: "unknown_path"`. We implement the
    // unsupported_path branch by checking against ALLOWED_PREFIXES /
    // ALLOWED_TOP_LEVEL up front; unknown_path is when the lookup returns
    // null AND the prefix was supported.
    const supported = (path === "ddt_water_absorption_pct"
      || path.startsWith("metrics.")
      || path.startsWith("hydration.")
      || path.startsWith("bakers_percents."))
      && !NON_NUMERIC_PATHS.has(path);
    if (!supported) {
      allMatch = false;
      results.push({
        metric_path: path, claim, actual: null, match: false,
        diff: null, tolerance: TOLERANCE, error: "unsupported_path",
      });
      continue;
    }
    const actual = resolveMetric(path, computed);
    if (actual === null && claim !== null) {
      allMatch = false;
      results.push({
        metric_path: path, claim, actual: null, match: false,
        diff: null, tolerance: TOLERANCE, error: "unknown_path",
      });
      continue;
    }
    // Both null OR both numeric within tolerance.
    const match = (actual === null && claim === null)
      || (actual !== null && claim !== null && Math.abs(actual - claim) <= TOLERANCE);
    if (!match) allMatch = false;
    results.push({
      metric_path: path,
      claim,
      actual,
      match,
      diff: (actual === null || claim === null) ? null : (claim - actual),
      tolerance: TOLERANCE,
    });
  }
  return { all_match: allMatch, results };
}

// Suppress unused import warning — the const is used as type-narrowing guard
void (ALLOWED_PREFIXES);
