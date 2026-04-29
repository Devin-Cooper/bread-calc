import { describe, it, expect } from "vitest";
import { buildTree, evaluateTree, projectByLabel } from "../../src/core/explain-tree.js";
import type { Recipe, Database } from "../../src/core/types.js";
// Reuse the established db-construction pattern from existing core tests
// (see test/core/compute-hydration.test.ts). There is no
// `src/data/index-fixture.ts` — that module name was a typo in an earlier
// plan draft. Keep the direct-JSON-import pattern here.
import ingredientsFile from "../../src/data/ingredients.json" with { type: "json" };
import floursFile      from "../../src/data/flours.json"      with { type: "json" };
import refsFile        from "../../src/data/bb_pdc20_recipes.json" with { type: "json" };
import machinesFile    from "../../src/data/machines.json"    with { type: "json" };
import defaultsRaw     from "../../src/data/defaults.json"    with { type: "json" };

/* eslint-disable @typescript-eslint/no-explicit-any */
const db: Database = {
  ingredients: (ingredientsFile as any).entries,
  flours:      (floursFile as any).entries,
  references:  (refsFile as any).entries,
  machines:    (machinesFile as any).entries,
  defaults:    defaultsRaw as any,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const r: Recipe = {
  schema_version: "2.0",
  items: [
    { uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 553 },
    { uid: "u_water001", ingredient_id: "water_tap",   grams: 326 },
  ],
};

describe("buildTree", () => {
  it("returns a tree whose root has memoized values consistent with re-evaluation", () => {
    const tree = buildTree(r, db);
    const result = evaluateTree(tree);
    expect(result.ok).toBe(true);
    expect(result.mismatches).toEqual([]);
  });

  it("projects total_flour_g via projectByLabel", () => {
    const tree = buildTree(r, db);
    const flour = projectByLabel(tree, "total_flour_g");
    expect(flour).toBe(553);
  });

  it("projects total_water_g_nominal", () => {
    const tree = buildTree(r, db);
    const water = projectByLabel(tree, "total_water_g_nominal");
    expect(water).toBeCloseTo(326, 5);
  });
});

describe("evaluateTree", () => {
  it("returns ok=true when no mismatches", () => {
    const tree = buildTree(r, db);
    const result = evaluateTree(tree);
    expect(result.ok).toBe(true);
  });

  it("detects tampering with stored values", () => {
    const tree = buildTree(r, db);
    // Walk to find any node with a value, mutate, re-evaluate, expect mismatch.
    function tamper(node: any): boolean {
      if (typeof node.value === "number") { node.value = node.value + 999; return true; }
      const subs = ("terms" in node ? node.terms.flatMap((t: any) => t.weight ? [t.weight, t.value] : [t]) :
                    "factors" in node ? node.factors :
                    "numerator" in node ? [node.numerator, node.denominator] :
                    "input" in node ? [node.input] : []);
      for (const s of subs) if (tamper(s)) return true;
      return false;
    }
    tamper(tree);
    const result = evaluateTree(tree);
    expect(result.ok).toBe(false);
    expect(result.mismatches.length).toBeGreaterThan(0);
  });

  it("detects cycles via ProjectFromTree (cap traversal at 10000)", () => {
    // Construct a deliberately cyclic tree.
    const a: any = { type: "ProjectFromTree", id: "a", label: "a", ref_id: "b", value: 0 };
    const b: any = { type: "ProjectFromTree", id: "b", label: "b", ref_id: "a", value: 0 };
    // We need an env with a lookup that returns these — evaluateTree builds the env from the root,
    // so wrap them in a Sum that contains both.
    const root: any = { type: "Sum", id: "root", label: "r", terms: [a, b], value: 0 };
    expect(() => evaluateTree(root)).toThrow(/cycle|max depth/i);
  });
});
