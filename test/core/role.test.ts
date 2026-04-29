import { describe, it, expect } from "vitest";
import { inferRole, CATEGORY_ROLE_MAP } from "../../src/core/role.js";
import type { Category } from "../../src/core/types.js";

describe("inferRole", () => {
  const cases: Array<[Category, boolean, string]> = [
    ["flour", false, "flour"],
    ["salt", false, "salt"],
    ["yeast", false, "yeast"],
    ["leavener", false, "leavener"],
    ["liquids", true, "wet"],
    ["acids_alcohols", true, "wet"],
    ["eggs", false, "wet"],
    ["fats", false, "fat"],
    ["sweeteners", false, "sweetener"],
    ["fresh_fruit", true, "wet"],
    ["fresh_fruit", false, "inclusion"],
    ["dried_fruit", false, "inclusion"],
    ["nuts_seeds", false, "inclusion"],
    ["cheese", false, "enrichment"],
    ["vegetables", false, "inclusion"],
    ["herbs_spices", false, "inclusion"],
    ["specialty", false, "inclusion"],
  ];
  for (const [cat, isLiquid, expected] of cases) {
    it(`category ${cat} (is_liquid=${isLiquid}) → ${expected}`, () => {
      expect(inferRole(cat, isLiquid)).toBe(expected);
    });
  }
});

describe("CATEGORY_ROLE_MAP", () => {
  it("covers every Category", () => {
    const cats: Category[] = ["liquids", "sweeteners", "fats", "fresh_fruit", "dried_fruit",
      "nuts_seeds", "eggs", "cheese", "vegetables", "herbs_spices", "acids_alcohols",
      "specialty", "flour", "salt", "yeast", "leavener"];
    for (const c of cats) expect(CATEGORY_ROLE_MAP[c]).toBeDefined();
  });
});
