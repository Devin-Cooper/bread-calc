import { describe, it, expect } from "vitest";
import coursesFile from "../../src/data/bb_pdc20_courses.json" with { type: "json" };
import schemaFile from "../../src/data/schema.json" with { type: "json" };
import Ajv from "ajv/dist/2020.js";

interface CourseEntry {
  id: string;
  course_number: number;
  name: string;
  total_minutes: number;
  stages: ReadonlyArray<{
    name: string;
    duration_minutes: number;
    target_temp_c: number | null;
    notes?: string;
  }>;
  bakes: boolean;
  loaf_sizes: readonly string[];
  crust_shades: readonly string[];
  inclusions_beep: boolean;
  dietary_modes: readonly string[];
  recommended_for: readonly string[];
  recommended_for_notes?: string;
  hydration_range?: { min_pct: number; max_pct: number; ideal_pct?: number };
  whole_wheat_max_pct?: number;
  yeast_compatibility: readonly string[];
  confidence: string;
  sources: readonly string[];
  notes?: string;
}

const STAGE_CANONICAL_ORDER = [
  "preheat", "knead_1", "rest", "knead_2",
  "rise_1", "add_ins_beep", "punch", "rise_2",
  "preheat_bake", "bake", "cool", "keep_warm",
];
const VALID_CONFIDENCE = new Set(["verified", "inferred", "community"]);

const entries = (coursesFile as { entries: CourseEntry[] }).entries;

describe("bb_pdc20_courses.json shape invariants", () => {
  it("every entry validates against the schema", () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const ajv = new (Ajv as any)({ strict: false });
    const validate = ajv.compile(schemaFile);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const ok = validate(coursesFile);
    expect(ok).toBe(true);
  });

  it("course_number is unique across entries", () => {
    const numbers = entries.map((e) => e.course_number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("id is unique across entries", () => {
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("course_number is positive for every row", () => {
    for (const e of entries) {
      expect(e.course_number).toBeGreaterThan(0);
    }
  });

  it("confidence is verified | inferred | community", () => {
    for (const e of entries) {
      expect(VALID_CONFIDENCE.has(e.confidence)).toBe(true);
    }
  });

  it("populated inferred-bucket fields have at least 2 sources", () => {
    for (const e of entries) {
      const hasInferredField =
        e.hydration_range !== undefined ||
        e.whole_wheat_max_pct !== undefined;
      if (hasInferredField) {
        expect(e.sources.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("total_minutes matches sum of stage durations within ±2 min", () => {
    for (const e of entries) {
      const sum = e.stages.reduce((s, st) => s + st.duration_minutes, 0);
      expect(Math.abs(e.total_minutes - sum)).toBeLessThanOrEqual(2);
    }
  });

  it("inclusions_beep===true implies an add_ins_beep stage", () => {
    for (const e of entries) {
      if (e.inclusions_beep) {
        const hasBeep = e.stages.some((s) => s.name === "add_ins_beep");
        expect(hasBeep).toBe(true);
      }
    }
  });

  it("bakes===true implies a bake stage", () => {
    for (const e of entries) {
      if (e.bakes) {
        const hasBake = e.stages.some((s) => s.name === "bake");
        expect(hasBake).toBe(true);
      }
    }
  });

  it("bakes===false implies no bake stage", () => {
    for (const e of entries) {
      if (!e.bakes) {
        const hasBake = e.stages.some((s) => s.name === "bake");
        expect(hasBake).toBe(false);
      }
    }
  });

  it("array fields are never null", () => {
    for (const e of entries) {
      expect(Array.isArray(e.loaf_sizes)).toBe(true);
      expect(Array.isArray(e.crust_shades)).toBe(true);
      expect(Array.isArray(e.dietary_modes)).toBe(true);
      expect(Array.isArray(e.yeast_compatibility)).toBe(true);
      expect(Array.isArray(e.recommended_for)).toBe(true);
      expect(Array.isArray(e.sources)).toBe(true);
    }
  });

  it("hydration_range bounds are sensible when present", () => {
    for (const e of entries) {
      if (e.hydration_range) {
        const { min_pct, max_pct, ideal_pct } = e.hydration_range;
        expect(min_pct).toBeGreaterThanOrEqual(0);
        expect(max_pct).toBeLessThanOrEqual(100);
        expect(min_pct).toBeLessThan(max_pct);
        if (ideal_pct !== undefined) {
          expect(ideal_pct).toBeGreaterThanOrEqual(min_pct);
          expect(ideal_pct).toBeLessThanOrEqual(max_pct);
        }
      }
    }
  });

  it("whole_wheat_max_pct is in [0, 100] when present", () => {
    for (const e of entries) {
      if (e.whole_wheat_max_pct !== undefined) {
        expect(e.whole_wheat_max_pct).toBeGreaterThanOrEqual(0);
        expect(e.whole_wheat_max_pct).toBeLessThanOrEqual(100);
      }
    }
  });

  it("non-negative durations", () => {
    for (const e of entries) {
      expect(e.total_minutes).toBeGreaterThanOrEqual(0);
      for (const s of e.stages) {
        expect(s.duration_minutes).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("stages are in canonical cycle order", () => {
    for (const e of entries) {
      const indexOfStage = (n: string) => STAGE_CANONICAL_ORDER.indexOf(n);
      const indices = e.stages.map((s) => indexOfStage(s.name));
      for (const idx of indices) expect(idx).toBeGreaterThanOrEqual(0);
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]!).toBeGreaterThanOrEqual(indices[i - 1]!);
      }
    }
  });
});
