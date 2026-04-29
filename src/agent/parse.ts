import type { Recipe, RecipeItem, Database } from "../core/types.js";
import { generateUid } from "../core/uid.js";
import { lookupIngredient } from "./lookup.js";
import { convert } from "./convert.js";

export interface ParseFailure {
  line: number;
  raw: string;
  reason: "no_quantity" | "no_unit" | "no_ingredient" | "ambiguous_ingredient" | "unsupported_form";
  detail?: string;
}

const UNIT_TOKENS = new Set([
  "g", "kg", "oz", "lb",
  "cup", "cups",
  "tbsp", "tablespoon", "tablespoons",
  "tsp", "teaspoon", "teaspoons",
  "ml", "l", "liter", "liters",
  "floz", "fl",  // "fl" prefix; we look for "fl oz" combined below
]);

function stripComments(line: string): string {
  // Remove from `#` or `//` to end-of-line. Order matters: detect `//` first
  // since it would otherwise be eaten by `#` not present.
  const dblSlash = line.indexOf("//");
  if (dblSlash >= 0) line = line.slice(0, dblSlash);
  const hash = line.indexOf("#");
  if (hash >= 0) line = line.slice(0, hash);
  return line.trim();
}

function parseQuantity(tokens: string[]): { qty: number; consumed: number } | null {
  // QUANTITY := NUMBER | FRACTION | NUMBER WS FRACTION
  const numRe = /^\d+(\.\d+)?$/;
  const fracRe = /^\d+\/\d+$/;
  const t0 = tokens[0]!;
  const t1 = tokens[1];
  if (t0 && numRe.test(t0) && t1 && fracRe.test(t1)) {
    const [num, den] = t1.split("/").map(Number);
    return { qty: parseFloat(t0) + (num! / den!), consumed: 2 };
  }
  if (t0 && fracRe.test(t0)) {
    const [num, den] = t0.split("/").map(Number);
    return { qty: num! / den!, consumed: 1 };
  }
  if (t0 && numRe.test(t0)) {
    return { qty: parseFloat(t0), consumed: 1 };
  }
  return null;
}

function parseUnit(tokens: string[]): { unit: string; consumed: number } | null {
  const t0 = tokens[0];
  if (!t0) return null;
  const lower = t0.toLowerCase();
  if (lower === "fl" && tokens[1]?.toLowerCase() === "oz") {
    return { unit: "floz", consumed: 2 };
  }
  if (UNIT_TOKENS.has(lower)) {
    return { unit: lower, consumed: 1 };
  }
  return null;
}

export function parseText(text: string, db?: Database): { recipe: Recipe; unparseable: ParseFailure[] } {
  // `db` is optional per spec §3.4. lookupIngredient and convert both fall
  // back to the bundled database when unset, so we can pass through directly.
  // No need to lazy-load again here.
  const items: RecipeItem[] = [];
  const unparseable: ParseFailure[] = [];
  let extractedName: string | undefined;

  const rawLines = text.split(/\r?\n/);
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]!;
    const titleMatch = raw.match(/^\s*#\s*title:\s*(.+?)\s*$/i);
    if (titleMatch && extractedName === undefined) extractedName = titleMatch[1]!.trim();
    const stripped = stripComments(raw);
    if (stripped.length === 0) continue;

    const tokens = stripped.split(/[\s,]+/).filter((t) => t.length > 0);
    const qty = parseQuantity(tokens);
    if (!qty) { unparseable.push({ line: i + 1, raw, reason: "no_quantity" }); continue; }
    const remainingAfterQty = tokens.slice(qty.consumed);
    const unit = parseUnit(remainingAfterQty);
    if (!unit) { unparseable.push({ line: i + 1, raw, reason: "no_unit" }); continue; }
    const remainingAfterUnit = remainingAfterQty.slice(unit.consumed);
    if (remainingAfterUnit.length === 0) {
      unparseable.push({ line: i + 1, raw, reason: "no_ingredient" }); continue;
    }
    const phrase = remainingAfterUnit.join(" ");
    const lookupOpts: { db?: Database; limit: number } = { limit: 5 };
    if (db !== undefined) lookupOpts.db = db;
    const matches = lookupIngredient(phrase, lookupOpts);
    if (matches.length === 0 || matches[0]!.score < 0.7) {
      unparseable.push({ line: i + 1, raw, reason: "no_ingredient", detail: phrase });
      continue;
    }
    if (matches.length >= 2 && (matches[0]!.score - matches[1]!.score) < 0.05) {
      unparseable.push({ line: i + 1, raw, reason: "ambiguous_ingredient", detail: `top matches: ${matches[0]!.ingredient_id} (${matches[0]!.score.toFixed(2)}), ${matches[1]!.ingredient_id} (${matches[1]!.score.toFixed(2)})` });
      continue;
    }
    const ingredient_id = matches[0]!.ingredient_id;
    const conv = convert({ qty: qty.qty, unit: unit.unit, ingredient_id }, db ?? undefined);
    if (!conv.ok) {
      unparseable.push({ line: i + 1, raw, reason: "unsupported_form", detail: conv.warnings.map((w) => w.code).join(",") });
      continue;
    }
    items.push({ uid: generateUid(), ingredient_id, grams: conv.grams });
  }

  const recipe: Recipe = { schema_version: "2.0", items };
  if (extractedName) recipe.name = extractedName;
  return { recipe, unparseable };
}
