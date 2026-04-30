import { describe, it, expect, vi } from "vitest";
import { createStore } from "../../src/site/state.js";

vi.mock("../../src/core/uid.js", () => {
  let _n = 0;
  return {
    // 10-char uid: "u_test" + 4-digit counter, e.g. "u_test0001".
    generateUid: () => `u_test${(++_n).toString().padStart(4, "0")}`,
    isValidUid: (s: unknown): boolean => typeof s === "string" && /^[A-Za-z0-9_-]{8,16}$/.test(s),
    UID_REGEX: /^[A-Za-z0-9_-]{8,16}$/,
  };
});

describe("createStore", () => {
  it("starts with the given initial recipe", () => {
    const s = createStore({ schema_version: "2.0", items: [] });
    expect(s.getState().items).toEqual([]);
  });
  it("dispatches add_item and creates a row with a uid", () => {
    const s = createStore({ schema_version: "2.0", items: [] });
    s.dispatch({ type: "add_item", ingredient_id: "bread_flour" });
    expect(s.getState().items).toEqual([
      expect.objectContaining({ ingredient_id: "bread_flour", grams: 0, uid: expect.stringMatching(/^u_test\d{4}$/) }),
    ]);
  });
  it("dispatches set_grams", () => {
    const s = createStore({ schema_version: "2.0", items: [{ uid: "u_test_seed1", ingredient_id: "bread_flour", grams: 0 }] });
    s.dispatch({ type: "set_grams", index: 0, grams: 500 });
    expect(s.getState().items[0]!.grams).toBe(500);
  });
  it("dispatches remove_item", () => {
    const s = createStore({ schema_version: "2.0", items: [{ uid: "u_test_seed1", ingredient_id: "bread_flour", grams: 500 }, { uid: "u_test_seed2", ingredient_id: "water_tap", grams: 320 }] });
    s.dispatch({ type: "remove_item", index: 0 });
    expect(s.getState().items.length).toBe(1);
    expect(s.getState().items[0]!.ingredient_id).toBe("water_tap");
  });
  it("notifies subscribers on change", () => {
    const s = createStore({ schema_version: "2.0", items: [] });
    let calls = 0;
    s.subscribe(() => calls++);
    s.dispatch({ type: "add_item", ingredient_id: "bread_flour" });
    s.dispatch({ type: "set_grams", index: 0, grams: 500 });
    expect(calls).toBe(2);
  });
  it("set_target_loaf_g(undefined) deletes the key", () => {
    const s = createStore({ schema_version: "2.0", items: [], target_loaf_g: 900 });
    s.dispatch({ type: "set_target_loaf_g", grams: undefined });
    expect("target_loaf_g" in s.getState()).toBe(false);
  });
  it("set_role(undefined) deletes the key from the targeted item", () => {
    const s = createStore({ schema_version: "2.0", items: [{ uid: "u_test_seed1", ingredient_id: "bread_flour", grams: 500, role: "flour" }] });
    s.dispatch({ type: "set_role", index: 0, role: undefined });
    expect("role" in s.getState().items[0]!).toBe(false);
  });
  it("set_free_water_factor_override sets and clears entries", () => {
    const s = createStore({ schema_version: "2.0", items: [] });
    s.dispatch({ type: "set_free_water_factor_override", ingredient_id: "honey", factor: 0.85 });
    expect(s.getState().free_water_factor_overrides).toEqual({ honey: 0.85 });
    s.dispatch({ type: "set_free_water_factor_override", ingredient_id: "honey", factor: undefined });
    expect(s.getState().free_water_factor_overrides).toEqual({});
  });
  it("load replaces the entire recipe", () => {
    const s = createStore({ schema_version: "2.0", items: [{ uid: "u_test_seed1", ingredient_id: "bread_flour", grams: 500 }] });
    s.dispatch({ type: "load", recipe: { schema_version: "2.0", name: "fresh", items: [] } });
    expect(s.getState()).toEqual({ schema_version: "2.0", name: "fresh", items: [] });
  });
  it("dispatches set_notes", () => {
    const s = createStore({ schema_version: "2.0", items: [{ uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 }] });
    s.dispatch({ type: "set_notes", notes: "soft sandwich crumb" });
    expect(s.getState().notes).toBe("soft sandwich crumb");
  });
  it("set_notes('') clears notes", () => {
    const s = createStore({ schema_version: "2.0", notes: "old", items: [{ uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 }] });
    s.dispatch({ type: "set_notes", notes: "" });
    expect("notes" in s.getState()).toBe(false);
  });
  it("dispatches set_course and sets the field", () => {
    const s = createStore({ schema_version: "2.0", items: [{ uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 }] });
    s.dispatch({ type: "set_course", course: "white" });
    expect(s.getState().course).toBe("white");
  });
  it("set_course(undefined) clears the field", () => {
    const s = createStore({ schema_version: "2.0", course: "white", items: [{ uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 }] });
    s.dispatch({ type: "set_course", course: undefined });
    expect("course" in s.getState()).toBe(false);
  });
  it("dispatches set_crust_shade and sets the field", () => {
    const s = createStore({ schema_version: "2.0", items: [{ uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 }] });
    s.dispatch({ type: "set_crust_shade", crust_shade: "dark" });
    expect(s.getState().crust_shade).toBe("dark");
  });
  it("set_crust_shade(undefined) clears the field", () => {
    const s = createStore({ schema_version: "2.0", crust_shade: "dark", items: [{ uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 }] });
    s.dispatch({ type: "set_crust_shade", crust_shade: undefined });
    expect("crust_shade" in s.getState()).toBe(false);
  });
});
