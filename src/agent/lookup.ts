import type { Database, Category } from "../core/types.js";

export interface LookupResult {
  ingredient_id: string;
  name: string;
  category: Category;
  score: number;
  match_reason: "id_exact" | "id_prefix" | "name_exact" | "name_substring" | "form_variant" | "fuzzy";
}

interface Candidate {
  id: string;
  name: string;
  category: Category;
  form_variants: string[];
}

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[\s,]+/).filter((t) => t.length > 0);
}

// Lazy-load the bundled database when caller omits `options.db`. Same pattern
// as src/agent/convert.ts; see that file for the side-effect note.
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

export function lookupIngredient(
  query: string,
  options?: { db?: Database; limit?: number },
): LookupResult[] {
  const db = options?.db ?? defaultDb();
  const limit = options?.limit ?? 12;

  const q = query.trim();
  if (q.length === 0) return [];

  const candidates: Candidate[] = [
    ...db.ingredients.map((i) => ({
      id: i.id, name: i.name, category: i.category,
      form_variants: i.form_variants ?? [],
    })),
    ...db.flours.map((f) => ({
      id: f.id, name: f.name, category: "flour" as Category,
      form_variants: [] as string[],
    })),
  ];

  const qLower = q.toLowerCase();
  const qNormalized = qLower.replaceAll(" ", "_");
  const qTokens = new Set(tokens(qLower));

  const scored: LookupResult[] = [];
  for (const c of candidates) {
    let best: { score: number; reason: LookupResult["match_reason"] } | null = null;

    if (q === c.id) best = { score: 1.0, reason: "id_exact" };
    else if (qLower === c.name.toLowerCase()) best = { score: 0.95, reason: "name_exact" };
    else if (c.id.startsWith(qNormalized)) best = { score: 0.85, reason: "id_prefix" };
    else if (c.name.toLowerCase().includes(qLower)) best = { score: 0.7, reason: "name_substring" };
    else if (c.form_variants.some((v) => v.toLowerCase() === qLower)) best = { score: 0.65, reason: "form_variant" };
    else {
      // Fuzzy: token-set intersection.
      const candTokens = new Set([...tokens(c.name), ...c.form_variants.flatMap(tokens)]);
      let hits = 0;
      for (const t of qTokens) if (candTokens.has(t)) hits++;
      if (hits > 0 && qTokens.size > 0) {
        const ratio = hits / qTokens.size;
        const score = 0.1 + ratio * 0.5;  // 0.1..0.6
        best = { score, reason: "fuzzy" };
      }
    }

    if (best) {
      scored.push({
        ingredient_id: c.id,
        name: c.name,
        category: c.category,
        score: best.score,
        match_reason: best.reason,
      });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.ingredient_id < b.ingredient_id ? -1 : a.ingredient_id > b.ingredient_id ? 1 : 0;
  });
  return scored.slice(0, limit);
}
