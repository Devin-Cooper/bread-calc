import { describe, it, expect } from "vitest";
import { createRegistry } from "../../src/core/registry/base.js";

interface SampleEntry { id: string; description: string; }

describe("createRegistry", () => {
  it("starts empty", () => {
    const reg = createRegistry<SampleEntry>((e) => e.id);
    expect(reg.list()).toEqual([]);
    expect(reg.get("anything")).toBeUndefined();
  });

  it("register/get/list round-trip", () => {
    const reg = createRegistry<SampleEntry>((e) => e.id);
    const a = { id: "a", description: "first" };
    const b = { id: "b", description: "second" };
    reg.register(a);
    reg.register(b);
    expect(reg.get("a")).toBe(a);
    expect(reg.get("b")).toBe(b);
    expect(reg.list()).toEqual([a, b]);
  });

  it("rejects duplicate id by throwing", () => {
    const reg = createRegistry<SampleEntry>((e) => e.id);
    reg.register({ id: "x", description: "first" });
    expect(() => reg.register({ id: "x", description: "dup" })).toThrow(
      /duplicate registry entry: "x"/i,
    );
  });

  it("list() returns entries in insertion order", () => {
    const reg = createRegistry<SampleEntry>((e) => e.id);
    reg.register({ id: "c", description: "" });
    reg.register({ id: "a", description: "" });
    reg.register({ id: "b", description: "" });
    expect(reg.list().map((e) => e.id)).toEqual(["c", "a", "b"]);
  });
});
