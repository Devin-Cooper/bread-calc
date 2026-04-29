import { describe, it, expect } from "vitest";
import { generateUid, isValidUid, UID_REGEX } from "../../src/core/uid.js";

describe("uid", () => {
  it("UID_REGEX matches the spec format ^[A-Za-z0-9_-]{8,16}$", () => {
    expect(UID_REGEX.test("k7n3xl42")).toBe(true);
    expect(UID_REGEX.test("a-b_c1234567890_")).toBe(true);
    expect(UID_REGEX.test("short")).toBe(false);
    expect(UID_REGEX.test("way_too_long_for_a_uid")).toBe(false);
    expect(UID_REGEX.test("has space")).toBe(false);
    expect(UID_REGEX.test("")).toBe(false);
  });

  it("generateUid produces a uid that satisfies isValidUid", () => {
    for (let i = 0; i < 100; i++) {
      const u = generateUid();
      expect(isValidUid(u)).toBe(true);
    }
  });

  it("generateUid produces unique values across many invocations", () => {
    const set = new Set<string>();
    for (let i = 0; i < 10_000; i++) set.add(generateUid());
    // 10k draws from a ≥2^60 keyspace must be collision-free in practice.
    expect(set.size).toBe(10_000);
  });

  it("isValidUid rejects non-string inputs gracefully", () => {
    expect(isValidUid(undefined as unknown as string)).toBe(false);
    expect(isValidUid(null as unknown as string)).toBe(false);
    expect(isValidUid(42 as unknown as string)).toBe(false);
  });
});
