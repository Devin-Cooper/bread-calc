/// <reference types="happy-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { mount as mountPicker } from "../../src/site/components/template-picker.js";
import { _resetCache } from "../../src/site/templates.js";
import { createStore } from "../../src/site/state.js";
import type { Database } from "../../src/core/index.js";
import ingredientsFile from "../../src/data/ingredients.json" with { type: "json" };
import floursFile from "../../src/data/flours.json" with { type: "json" };
import recipesFile from "../../src/data/bb_pdc20_recipes.json" with { type: "json" };
import machinesFile from "../../src/data/machines.json" with { type: "json" };
import defaultsRaw from "../../src/data/defaults.json" with { type: "json" };

/* eslint-disable @typescript-eslint/no-explicit-any */
const db: Database = {
  ingredients: (ingredientsFile as any).entries,
  flours:      (floursFile as any).entries,
  references:  (recipesFile as any).entries,
  machines:    (machinesFile as any).entries,
  defaults:    defaultsRaw as any,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const STARTER = { schema_version: "2.0" as const, name: "Initial", items: [
  { uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 },
] };

describe("template-picker", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    _resetCache();
  });

  // ===== Task 3.2: skeleton =====
  it("renders the trigger button collapsed by default", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore(STARTER);
    mountPicker(root, store, db);
    const trigger = root.querySelector(".template-trigger") as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(root.querySelector(".template-popover")).toBeNull();
  });

  it("opens the popover on trigger click and renders all 5+ templates", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore(STARTER);
    mountPicker(root, store, db);
    const trigger = root.querySelector(".template-trigger") as HTMLButtonElement;
    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(root.querySelector(".template-popover")).not.toBeNull();
    const options = root.querySelectorAll("[role='option']");
    expect(options.length).toBeGreaterThanOrEqual(5);
  });

  it("closes the popover on close-button click", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore(STARTER);
    mountPicker(root, store, db);
    (root.querySelector(".template-trigger") as HTMLButtonElement).click();
    (root.querySelector(".template-close") as HTMLButtonElement).click();
    expect(root.querySelector(".template-popover")).toBeNull();
  });

  // ===== Task 3.3: filter =====
  it("filters templates by name (case-insensitive substring)", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore(STARTER);
    mountPicker(root, store, db);
    (root.querySelector(".template-trigger") as HTMLButtonElement).click();
    const filter = root.querySelector(".template-filter") as HTMLInputElement;
    filter.value = "white";
    filter.dispatchEvent(new Event("input", { bubbles: true }));
    const visibleNames = Array.from(root.querySelectorAll("[role='option']"))
      .map((opt) => opt.querySelector(".template-name")!.textContent!);
    expect(visibleNames.length).toBeGreaterThan(0);
    expect(visibleNames.every((n) => n.toLowerCase().includes("white"))).toBe(true);
  });

  it("filter matches the course name as well", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore(STARTER);
    mountPicker(root, store, db);
    (root.querySelector(".template-trigger") as HTMLButtonElement).click();
    const filter = root.querySelector(".template-filter") as HTMLInputElement;
    filter.value = "european";
    filter.dispatchEvent(new Event("input", { bubbles: true }));
    const visibleNames = Array.from(root.querySelectorAll("[role='option']"))
      .map((opt) => opt.querySelector(".template-name")!.textContent!);
    expect(visibleNames).toContain("French Bread");
  });

  // ===== Task 3.4: option-select =====
  it("clicking an option dispatches load with a fresh-uid recipe", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore(STARTER);
    mountPicker(root, store, db);
    (root.querySelector(".template-trigger") as HTMLButtonElement).click();
    const firstOption = root.querySelector("[role='option']") as HTMLElement;
    firstOption.click();
    expect(store.getState().name).toBe("Basic White Bread");
    expect(store.getState().items.length).toBeGreaterThan(0);
    // Picker auto-closes after select
    expect(root.querySelector(".template-popover")).toBeNull();
  });

  // ===== Task 3.5: unsaved-edits guard =====
  it("shows confirm dialog when current state differs from baseline", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore(STARTER);
    mountPicker(root, store, db);
    store.dispatch({ type: "set_grams", index: 0, grams: 600 });
    (root.querySelector(".template-trigger") as HTMLButtonElement).click();
    const firstOption = root.querySelector("[role='option']") as HTMLElement;
    firstOption.click();
    expect(document.querySelector("#template-confirm")).not.toBeNull();
    expect(store.getState().name).toBe("Initial");
  });

  it("Cancel preserves the edited state, Replace dispatches the load", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore(STARTER);
    mountPicker(root, store, db);
    store.dispatch({ type: "set_grams", index: 0, grams: 600 });
    (root.querySelector(".template-trigger") as HTMLButtonElement).click();
    (root.querySelector("[role='option']") as HTMLElement).click();
    const cancel = document.querySelector("#template-confirm [data-action='cancel']") as HTMLButtonElement;
    cancel.click();
    expect(store.getState().name).toBe("Initial");
    expect(store.getState().items[0]!.grams).toBe(600);
    expect(document.querySelector("#template-confirm")).toBeNull();
    // Try again, choose Replace
    (root.querySelector("[role='option']") as HTMLElement).click();
    const replace = document.querySelector("#template-confirm [data-action='replace']") as HTMLButtonElement;
    replace.click();
    expect(store.getState().name).toBe("Basic White Bread");
  });

  it("does NOT show confirm dialog after a clean template load", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore(STARTER);
    mountPicker(root, store, db);
    (root.querySelector(".template-trigger") as HTMLButtonElement).click();
    (root.querySelector("[role='option']") as HTMLElement).click();
    expect(document.querySelector("#template-confirm")).toBeNull();
    // Open again and select another — still no edits since the load reset the baseline
    (root.querySelector(".template-trigger") as HTMLButtonElement).click();
    (root.querySelectorAll("[role='option']")[1] as HTMLElement).click();
    expect(document.querySelector("#template-confirm")).toBeNull();
  });

  // ===== Task 3.6: keyboard nav =====
  it("ArrowDown moves active descendant; Enter selects the active option", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore(STARTER);
    mountPicker(root, store, db);
    (root.querySelector(".template-trigger") as HTMLButtonElement).click();
    const filter = root.querySelector(".template-filter") as HTMLInputElement;
    filter.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    const list = root.querySelector(".template-list") as HTMLElement;
    expect(list.getAttribute("aria-activedescendant")).toBe("tpl-basic_white_bread");
    filter.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(list.getAttribute("aria-activedescendant")).toBe("tpl-french_bread");
    filter.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(store.getState().name).toBe("French Bread");
  });

  it("Escape closes the picker", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore(STARTER);
    mountPicker(root, store, db);
    (root.querySelector(".template-trigger") as HTMLButtonElement).click();
    const filter = root.querySelector(".template-filter") as HTMLInputElement;
    filter.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(root.querySelector(".template-popover")).toBeNull();
  });
});
