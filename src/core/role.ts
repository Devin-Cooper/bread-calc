import type { Category, Role } from "./types.js";

type RoleSpec = Role | ((isLiquid: boolean) => Role);

export const CATEGORY_ROLE_MAP: Readonly<Record<Category, RoleSpec>> = {
  flour: "flour",
  salt: "salt",
  yeast: "yeast",
  leavener: "leavener",
  liquids: "wet",
  acids_alcohols: "wet",
  eggs: "wet",
  fats: "fat",
  sweeteners: "sweetener",
  fresh_fruit: (isLiquid) => (isLiquid ? "wet" : "inclusion"),
  dried_fruit: "inclusion",
  nuts_seeds: "inclusion",
  cheese: "enrichment",
  vegetables: "inclusion",
  herbs_spices: "inclusion",
  specialty: "inclusion",
};

export function inferRole(category: Category, isLiquid: boolean): Role {
  const spec = CATEGORY_ROLE_MAP[category];
  return typeof spec === "function" ? spec(isLiquid) : spec;
}
