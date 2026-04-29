import { describe, it, expect } from "vitest";
import { getExamples } from "../../src/agent/examples.js";

describe("getExamples", () => {
  it("returns all 10 examples by default", () => {
    expect(getExamples().length).toBe(10);
  });

  it("filters by course", () => {
    const r = getExamples({ course: "Whole Wheat" });
    expect(r.length).toBe(2);
    expect(r.every((e) => e.course === "Whole Wheat")).toBe(true);
  });

  it("filters by zone", () => {
    const r = getExamples({ zone: "very_wet" });
    expect(r.length).toBe(1);
    expect(r[0]!.id).toBe("gluten_free_basic");
  });

  it("filter by id returns a single entry", () => {
    const r = getExamples({ id: "classic_white" });
    expect(r.length).toBe(1);
    expect(r[0]!.recipe.items.length).toBe(6);
  });

  it("each entry has expected_metrics that match recomputation", async () => {
    const { computeRecipe } = await import("../../src/core/index.js");
    // Use the same source-file db construction as other test files
    // (test/core/compute-hydration.test.ts, test/property/*.test.ts).
    // Importing from `dist/lib/data/index.js` would require a full
    // build:lib + transform:data run before vitest can resolve it; the
    // direct JSON imports work in cold `vitest`/`test:watch` cycles too.
    const ingredientsFile = (await import("../../src/data/ingredients.json", { with: { type: "json" } })).default;
    const floursFile      = (await import("../../src/data/flours.json",      { with: { type: "json" } })).default;
    const refsFile        = (await import("../../src/data/bb_pdc20_recipes.json", { with: { type: "json" } })).default;
    const machinesFile    = (await import("../../src/data/machines.json",    { with: { type: "json" } })).default;
    const defaultsRaw     = (await import("../../src/data/defaults.json",    { with: { type: "json" } })).default;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const db = {
      ingredients: (ingredientsFile as any).entries,
      flours:      (floursFile as any).entries,
      references:  (refsFile as any).entries,
      machines:    (machinesFile as any).entries,
      defaults:    defaultsRaw as any,
    };
    for (const e of getExamples()) {
      const c = computeRecipe(e.recipe, db as never);
      expect(c.hydration.effective_pct).toBeCloseTo(e.expected_metrics.hydration_effective_pct ?? 0, 1);
    }
  });
});
