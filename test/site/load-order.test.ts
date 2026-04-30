import { describe, it, expect } from "vitest";
import type { Database, Recipe } from "../../src/core/index.js";
import { sortItemsForPrint } from "../../src/site/pdf/load-order.js";

const db: Database = {
  ingredients: [
    { id: "water_tap", name: "Water (tap)", category: "liquids", is_liquid: true } as never,
    { id: "milk_whole", name: "Milk (whole)", category: "liquids", is_liquid: true } as never,
    { id: "sugar_granulated", name: "Sugar", category: "sweeteners" } as never,
    { id: "salt_table", name: "Salt", category: "salt" } as never,
    { id: "butter_unsalted", name: "Butter", category: "fats" } as never,
    { id: "yeast_instant", name: "Yeast", category: "yeast" } as never,
  ] as never,
  flours: [
    { id: "bread_flour", name: "Bread flour" } as never,
  ] as never,
  references: [], machines: [], defaults: { default_machine_id: "m" } as never,
};

const items: Recipe["items"] = [
  { uid: "a01", ingredient_id: "yeast_instant",     grams: 5 },
  { uid: "a02", ingredient_id: "bread_flour",       grams: 500 },
  { uid: "a03", ingredient_id: "salt_table",        grams: 9 },
  { uid: "a04", ingredient_id: "water_tap",         grams: 350 },
  { uid: "a05", ingredient_id: "sugar_granulated",  grams: 25 },
  { uid: "a06", ingredient_id: "butter_unsalted",   grams: 25 },
];

describe("sortItemsForPrint", () => {
  it("orders items: liquids → sweeteners → salt → fats → flour → yeast", () => {
    const out = sortItemsForPrint(items, db);
    const ids = out.map((i) => i.ingredient_id);
    expect(ids).toEqual([
      "water_tap",        // liquid (wet)
      "sugar_granulated", // sweetener
      "salt_table",       // salt
      "butter_unsalted",  // fat
      "bread_flour",      // flour
      "yeast_instant",    // yeast
    ]);
  });

  it("preserves user order within a tier (stable sort)", () => {
    const itemsTwoLiquids: Recipe["items"] = [
      { uid: "x01", ingredient_id: "milk_whole",   grams: 100 },
      { uid: "x02", ingredient_id: "water_tap",    grams: 200 },
      { uid: "x03", ingredient_id: "bread_flour",  grams: 500 },
    ];
    const out = sortItemsForPrint(itemsTwoLiquids, db);
    expect(out[0]!.ingredient_id).toBe("milk_whole");
    expect(out[1]!.ingredient_id).toBe("water_tap");
  });

  it("places unknown ingredients in the flour/dry tier", () => {
    const items2: Recipe["items"] = [
      { uid: "y01", ingredient_id: "unknown_thing", grams: 10 },
      { uid: "y02", ingredient_id: "yeast_instant", grams: 5 },
      { uid: "y03", ingredient_id: "bread_flour",   grams: 500 },
    ];
    const out = sortItemsForPrint(items2, db);
    // unknown -> dry tier (5); yeast -> tier 6 (last)
    expect(out[out.length - 1]!.ingredient_id).toBe("yeast_instant");
  });
});
