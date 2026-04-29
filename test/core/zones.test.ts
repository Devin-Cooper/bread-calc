import { describe, it, expect } from "vitest";
import { classifyZone, classifyZoneId, HYDRATION_ZONES } from "../../src/core/zones.js";

describe("classifyZoneId", () => {
  it("classifies all zone boundaries correctly", () => {
    expect(classifyZoneId(0)).toBe("dry");
    expect(classifyZoneId(54.99)).toBe("dry");
    expect(classifyZoneId(55)).toBe("sandwich");
    expect(classifyZoneId(66.99)).toBe("sandwich");
    expect(classifyZoneId(67)).toBe("wet");
    expect(classifyZoneId(74.99)).toBe("wet");
    expect(classifyZoneId(75)).toBe("very_wet");
    expect(classifyZoneId(100)).toBe("very_wet");
    expect(classifyZoneId(150)).toBe("very_wet");
  });
  it("defaults to dry on NaN/negative", () => {
    expect(classifyZoneId(NaN)).toBe("dry");
    expect(classifyZoneId(-1)).toBe("dry");
  });
});

describe("classifyZone (object form)", () => {
  it("returns rich HydrationZone with id/label/range/note", () => {
    const z = classifyZone(60);
    expect(z.id).toBe("sandwich");
    expect(z.label).toBe("Sandwich-loaf comfort");
    expect(z.range).toEqual([55, 67]);
    expect(z.note).toBe("BB-PDC20 sweet spot");
  });
});

describe("HYDRATION_ZONES", () => {
  it("has exactly 4 zones in id-order", () => {
    expect(HYDRATION_ZONES.map((z) => z.id)).toEqual(["dry", "sandwich", "wet", "very_wet"]);
  });
});
