import { describe, it, expect } from "vitest";
import { applyFix } from "../../src/agent/fix.js";
import type { Recipe, Fix } from "../../src/core/types.js";

const r: Recipe = {
  schema_version: "2.0",
  items: [
    { uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 553 },
    { uid: "u_water001", ingredient_id: "water_tap",   grams: 326 },
  ],
};

describe("applyFix", () => {
  it("set_grams replaces grams", () => {
    const fix: Fix = { kind: "set_grams", uid: "u_brdfl001", grams: 600, rationale: "test" };
    const out = applyFix(r, fix);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.recipe.items[0]!.grams).toBe(600);
  });

  it("returns ok=false / unknown_uid for missing uid", () => {
    const fix: Fix = { kind: "set_grams", uid: "u_missing0", grams: 100, rationale: "x" };
    const out = applyFix(r, fix);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("unknown_uid");
  });

  it("returns ok=false / negative_grams for excessive decrease", () => {
    const fix: Fix = { kind: "decrease_grams", uid: "u_water001", delta_g: 9999, rationale: "x" };
    const out = applyFix(r, fix);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("negative_grams");
  });

  it("add_ingredient with explicit uid succeeds; with collision returns invalid_payload", () => {
    const ok: Fix = { kind: "add_ingredient", uid: "u_yeast001", ingredient_id: "yeast_instant", grams: 5, rationale: "x" };
    const ok1 = applyFix(r, ok);
    expect(ok1.ok).toBe(true);

    const bad: Fix = { kind: "add_ingredient", uid: "u_brdfl001", ingredient_id: "yeast_instant", grams: 5, rationale: "x" };
    const bad1 = applyFix(r, bad);
    expect(bad1.ok).toBe(false);
    if (!bad1.ok) expect(bad1.error.code).toBe("invalid_payload");
  });

  it("set_field bake_loss_pct works", () => {
    const fix: Fix = { kind: "set_field", field: "bake_loss_pct", value: 9.5, rationale: "x" };
    const out = applyFix(r, fix);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.recipe.bake_loss_pct).toBe(9.5);
  });

  it("set_field target_loaf_g null removes the field", () => {
    const r2 = { ...r, target_loaf_g: 900 };
    const fix: Fix = { kind: "set_field", field: "target_loaf_g", value: null, rationale: "x" };
    const out = applyFix(r2 as Recipe, fix);
    expect(out.ok).toBe(true);
    if (out.ok) expect("target_loaf_g" in out.recipe).toBe(false);
  });

  it("set_field machine wrong-type → value_type_mismatch", () => {
    const fix: Fix = { kind: "set_field", field: "machine", value: 42 as unknown as null, rationale: "x" };
    const out = applyFix(r, fix);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("value_type_mismatch");
  });

  it("unknown kind → unknown_kind", () => {
    const fix = { kind: "weird_kind", uid: "u_brdfl001", rationale: "x" } as unknown as Fix;
    const out = applyFix(r, fix);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("unknown_kind");
  });

  // Spec audit risk #4: applyFix is purely structural — never re-runs solver
  // or compute. set_field("target_loaf_g", ...) on an UNSOLVED recipe (items
  // declared with bakers_pct but no grams) MUST return a recipe whose items
  // still lack grams. Callers chain compute themselves.
  it("set_field target_loaf_g does not re-run the solver (purely structural)", () => {
    const unsolved: Recipe = {
      schema_version: "2.0",
      items: [
        { uid: "u_brdfl001", ingredient_id: "bread_flour", bakers_pct: 100 },
        { uid: "u_water001", ingredient_id: "water_tap",   bakers_pct: 60  },
      ],
    };
    const fix: Fix = { kind: "set_field", field: "target_loaf_g", value: 800, rationale: "x" };
    const out = applyFix(unsolved, fix);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.recipe.target_loaf_g).toBe(800);
      // Items remain bakers_pct-only — solver was NOT invoked.
      expect(out.recipe.items[0]!.grams).toBeUndefined();
      expect(out.recipe.items[1]!.grams).toBeUndefined();
    }
  });

  it("set_grams on a flour item in target mode does not propagate (purely structural)", () => {
    const targetMode: Recipe = {
      schema_version: "2.0",
      target_loaf_g: 900,
      items: [
        { uid: "u_brdfl001", ingredient_id: "bread_flour", bakers_pct: 100 },
        { uid: "u_water001", ingredient_id: "water_tap",   bakers_pct: 60  },
      ],
    };
    const fix: Fix = { kind: "set_grams", uid: "u_brdfl001", grams: 553, rationale: "x" };
    const out = applyFix(targetMode, fix);
    expect(out.ok).toBe(true);
    if (out.ok) {
      // bread_flour has fixed grams now; water_tap MUST still be bakers_pct-only
      // (no implicit recompute proportionally raising water grams).
      expect(out.recipe.items[0]!.grams).toBe(553);
      expect(out.recipe.items[1]!.grams).toBeUndefined();
      expect(out.recipe.items[1]!.bakers_pct).toBe(60);
    }
  });
});
