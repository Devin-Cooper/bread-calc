import { describe, it, expect } from "vitest";
import { warningRules } from "../../src/core/registry/warnings.js";
import type { WarningCode } from "../../src/core/types.js";

const EXPECTED_CODES: WarningCode[] = [
  "no_flour", "solver_overconstrained", "solver_ambiguous_flour",
  "pan_overflow_predicted", "under_developed_gluten",
  "sugar_too_high", "salt_too_high", "fat_too_high",
  "enzymatic_gluten_degradation", "inclusions_exceed_pan",
  "wet_zone_needs_gluten_support", "very_wet_zone",
  "alcohol_yeast_inhibition", "no_yeast_or_leavener",
  "pan_underfill_predicted", "late_water_release_present",
  "humectant_overestimate_risk", "flour_quantity_atypical",
  "no_salt", "salt_inherent_dominant",
  "target_loaf_g_ignored_no_pcts",
];

describe("warningRules registry", () => {
  it("has exactly one entry per WarningCode", () => {
    const got = warningRules.list().map((r) => r.code).sort();
    const want = [...EXPECTED_CODES].sort();
    expect(got).toEqual(want);
  });

  it("each entry has all required fields", () => {
    for (const r of warningRules.list()) {
      expect(typeof r.code).toBe("string");
      expect(["info", "warn", "error"]).toContain(r.severity_default);
      expect(typeof r.description).toBe("string");
      expect(["math", "machine", "ingredient", "structural"]).toContain(r.category);
      expect(Array.isArray(r.consumes)).toBe(true);
      expect(typeof r.has_fixes).toBe("boolean");
      expect(typeof r.evaluate).toBe("function");
      expect(typeof r.fixes).toBe("function");
    }
  });

  it("has_fixes is consistent with rule.fixes() returning a fixed empty array", () => {
    // For rules whose `fixes` body is literally `return []`, has_fixes must
    // be false. We can't safely call `fixes()` with a real ctx here (rules
    // depend on ctx.computed.metrics.*), so we use a structural source check:
    // any rule whose `fixes.toString()` reduces to "return []" must have
    // has_fixes === false. The reverse direction (a body that returns []
    // because of a guard, but COULD return Fixes for other inputs) is
    // intentionally allowed: those rules declare has_fixes: true.
    const empty = /^[^{]*\{\s*return\s*\[\]\s*;?\s*\}$/;
    for (const r of warningRules.list()) {
      const trivial = empty.test(r.fixes.toString().replace(/\s+/g, " "));
      if (trivial) expect(r.has_fixes).toBe(false);
    }
  });
});
