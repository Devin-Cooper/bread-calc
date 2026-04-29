import { describe, it, expect } from "vitest";
import { HYDRATION_ZONES, classifyZone } from "../../src/core/zones.js";

describe("HYDRATION_ZONES", () => {
  it("has four zones in order dry → very_wet", () => {
    expect(HYDRATION_ZONES.map((z) => z.id)).toEqual(["dry", "sandwich", "wet", "very_wet"]);
  });
  it("zones tile [0, 100] without gaps or overlaps", () => {
    for (let i = 0; i < HYDRATION_ZONES.length - 1; i++) {
      expect(HYDRATION_ZONES[i]!.max).toBe(HYDRATION_ZONES[i + 1]!.min);
    }
    expect(HYDRATION_ZONES[0]!.min).toBe(0);
    expect(HYDRATION_ZONES.at(-1)!.max).toBe(100);
  });
});

describe("classifyZone", () => {
  it("returns dry for 0%", () => { expect(classifyZone(0)).toBe("dry"); });
  it("returns dry for 54.99%", () => { expect(classifyZone(54.99)).toBe("dry"); });
  it("returns sandwich for 55% (boundary inclusive on min)", () => { expect(classifyZone(55)).toBe("sandwich"); });
  it("returns sandwich for 60.8% (v4 just-ripe)", () => { expect(classifyZone(60.8)).toBe("sandwich"); });
  it("returns sandwich for 66.99%", () => { expect(classifyZone(66.99)).toBe("sandwich"); });
  it("returns wet for 67%", () => { expect(classifyZone(67)).toBe("wet"); });
  it("returns wet for 74.99%", () => { expect(classifyZone(74.99)).toBe("wet"); });
  it("returns very_wet for 75%", () => { expect(classifyZone(75)).toBe("very_wet"); });
  it("returns very_wet for 80.6% (v1 failed)", () => { expect(classifyZone(80.6)).toBe("very_wet"); });
  it("returns very_wet for 100%", () => { expect(classifyZone(100)).toBe("very_wet"); });
});
