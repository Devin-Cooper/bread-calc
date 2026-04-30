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
});
