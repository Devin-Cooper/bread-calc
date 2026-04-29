/// <reference types="happy-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { mount as mountTable } from "../../src/site/components/recipe-table.js";
import { createStore } from "../../src/site/state.js";

describe("recipe-table", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("renders one row per item", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "1.0", items: [
      { ingredient_id: "bread_flour", grams: 500 },
      { ingredient_id: "water_tap", grams: 320 },
    ]});
    mountTable(root, store);
    expect(root.querySelectorAll('[role="row"]').length).toBe(2);
  });

  it("dispatches set_grams on input change", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "1.0", items: [{ ingredient_id: "bread_flour", grams: 500 }] });
    mountTable(root, store);
    const input = root.querySelector('input[data-field="grams"]') as HTMLInputElement;
    input.value = "600";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(store.getState().items[0]!.grams).toBe(600);
  });

  it("re-renders on store changes", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "1.0", items: [{ ingredient_id: "bread_flour", grams: 500 }] });
    mountTable(root, store);
    store.dispatch({ type: "add_item", ingredient_id: "water_tap" });
    expect(root.querySelectorAll('[role="row"]').length).toBe(2);
  });
});
