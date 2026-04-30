/// <reference types="happy-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { mount as mountTable } from "../../src/site/components/recipe-table.js";
import { createStore } from "../../src/site/state.js";
import type { Database } from "../../src/core/index.js";

// Minimal db stub: the recipe-table only consults effectiveRecipe, which only
// dereferences the db when target_loaf_g is set. None of the existing tests
// use target mode, so an empty stub is sufficient.
const db = { ingredients: [], flours: [], references: [], machines: [], defaults: {} } as unknown as Database;

describe("recipe-table", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("renders one row per item", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [
      { uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 500 },
      { uid: "u_water001", ingredient_id: "water_tap", grams: 320 },
    ]});
    mountTable(root, store, db);
    expect(root.querySelectorAll('[role="row"]:not(.row-header)').length).toBe(2);
  });

  it("dispatches set_grams on input change", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [{ uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 500 }] });
    mountTable(root, store, db);
    const input = root.querySelector('input[data-field="grams"]') as HTMLInputElement;
    input.value = "600";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(store.getState().items[0]!.grams).toBe(600);
  });

  it("re-renders on store changes", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [{ uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 500 }] });
    mountTable(root, store, db);
    store.dispatch({ type: "add_item", ingredient_id: "water_tap" });
    expect(root.querySelectorAll('[role="row"]:not(.row-header)').length).toBe(2);
  });

  it("renders empty-state placeholder when items list is empty", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [] });
    mountTable(root, store, db);
    expect(root.querySelectorAll('[role="row"]:not(.row-header)').length).toBe(0);
    expect(root.querySelector(".placeholder")?.textContent).toMatch(/No ingredients/);
  });

  it("dispatches set_bakers_pct on bakers-pct input change", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [{ uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 500 }] });
    mountTable(root, store, db);
    const input = root.querySelector('input[data-field="bakers_pct"]') as HTMLInputElement;
    input.value = "100";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(store.getState().items[0]!.bakers_pct).toBe(100);
  });

  it("dispatches remove_item on click of remove button", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [
      { uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 500 },
      { uid: "u_water001", ingredient_id: "water_tap", grams: 320 },
    ]});
    mountTable(root, store, db);
    const button = root.querySelector('button[data-action="remove"][data-index="0"]') as HTMLButtonElement;
    button.click();
    expect(store.getState().items.length).toBe(1);
    expect(store.getState().items[0]!.ingredient_id).toBe("water_tap");
  });

  it("renders a role-pill per row", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [
      { uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 },
    ]});
    mountTable(root, store, db);
    expect(root.querySelector("[data-role-trigger]")).not.toBeNull();
  });

  it("emits data-uid on each row", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [
      { uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 },
      { uid: "ijklmnop02", ingredient_id: "water_tap",   grams: 320 },
    ]});
    mountTable(root, store, db);
    const rows = root.querySelectorAll<HTMLElement>('[role="row"]:not(.row-header)');
    expect(rows[0]?.dataset["uid"]).toBe("abcdefgh01");
    expect(rows[1]?.dataset["uid"]).toBe("ijklmnop02");
  });

  it("dispatches set_role when a role-pill option is clicked", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [
      { uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 },
    ]});
    mountTable(root, store, db);
    const trigger = root.querySelector("[data-role-trigger]") as HTMLButtonElement;
    trigger.click();
    const wet = root.querySelector('[role="option"][data-role="wet"]') as HTMLElement;
    wet.click();
    expect(store.getState().items[0]!.role).toBe("wet");
  });
});
