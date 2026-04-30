import type { Database, Recipe, Role } from "../../core/index.js";
import { inferRole } from "../../core/index.js";

// Machine-load tier ordering for the BB-PDC20:
//   1. Liquids (wet)
//   2. Sweeteners (sugar, honey)
//   3. Salt
//   4. Fats (butter, oil)
//   5. Flour + dry mix-ins (inclusion, enrichment)
//   6. Yeast / leaven (last)
const TIER_ORDER: Record<Role, number> = {
  wet:         1,
  sweetener:   2,
  salt:        3,
  fat:         4,
  flour:       5,
  inclusion:   5,
  enrichment:  5,
  yeast:       6,
  leavener:    6,
};
const DEFAULT_TIER = 5;

function tierOf(item: Recipe["items"][number], db: Database): number {
  // Honor the explicit role if present.
  if (item.role) {
    return TIER_ORDER[item.role] ?? DEFAULT_TIER;
  }
  // Otherwise infer from db lookup.
  const flour = db.flours.find((f) => f.id === item.ingredient_id);
  if (flour) return TIER_ORDER.flour;
  const ing = db.ingredients.find((i) => i.id === item.ingredient_id);
  if (ing) {
    const role = inferRole(ing.category, ing.is_liquid ?? false);
    return TIER_ORDER[role] ?? DEFAULT_TIER;
  }
  return DEFAULT_TIER; // unknown → dry tier
}

export function sortItemsForPrint(items: Recipe["items"], db: Database): Recipe["items"] {
  // Decorate-sort-undecorate to keep the sort stable on tied tiers.
  return items
    .map((item, index) => ({ item, index, tier: tierOf(item, db) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map((d) => d.item);
}
