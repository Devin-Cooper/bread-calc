import { describe, it, expect } from "vitest";
import { createStore } from "../../src/site/state.js";

describe("createStore", () => {
  it("starts with the given initial recipe", () => {
    const s = createStore({ schema_version: "1.0", items: [] });
    expect(s.getState().items).toEqual([]);
  });
  it("dispatches add_item and creates a row", () => {
    const s = createStore({ schema_version: "1.0", items: [] });
    s.dispatch({ type: "add_item", ingredient_id: "bread_flour" });
    expect(s.getState().items).toEqual([{ ingredient_id: "bread_flour", grams: 0 }]);
  });
  it("dispatches set_grams", () => {
    const s = createStore({ schema_version: "1.0", items: [{ ingredient_id: "bread_flour", grams: 0 }] });
    s.dispatch({ type: "set_grams", index: 0, grams: 500 });
    expect(s.getState().items[0]!.grams).toBe(500);
  });
  it("dispatches remove_item", () => {
    const s = createStore({ schema_version: "1.0", items: [{ ingredient_id: "bread_flour", grams: 500 }, { ingredient_id: "water_tap", grams: 320 }] });
    s.dispatch({ type: "remove_item", index: 0 });
    expect(s.getState().items.length).toBe(1);
    expect(s.getState().items[0]!.ingredient_id).toBe("water_tap");
  });
  it("notifies subscribers on change", () => {
    const s = createStore({ schema_version: "1.0", items: [] });
    let calls = 0;
    s.subscribe(() => calls++);
    s.dispatch({ type: "add_item", ingredient_id: "bread_flour" });
    s.dispatch({ type: "set_grams", index: 0, grams: 500 });
    expect(calls).toBe(2);
  });
});
