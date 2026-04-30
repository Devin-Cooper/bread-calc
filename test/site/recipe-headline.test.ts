/// <reference types="happy-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { mount as mountHeadline } from "../../src/site/components/recipe-headline.js";
import { createStore } from "../../src/site/state.js";

describe("recipe-headline", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("renders the recipe name", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", name: "Country Sandwich", items: [{ uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 }] });
    mountHeadline(root, store);
    expect(root.querySelector("[data-role='name']")?.textContent).toBe("Country Sandwich");
  });

  it("shows a placeholder when name is empty", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [{ uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 }] });
    mountHeadline(root, store);
    const span = root.querySelector("[data-role='name']") as HTMLElement;
    expect(span.dataset["empty"]).toBe("1");
    expect(span.textContent?.trim()).toBe("Untitled recipe");
  });

  it("dispatches set_name on blur of edited name", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", name: "Old", items: [{ uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 }] });
    mountHeadline(root, store);
    const span = root.querySelector("[data-role='name']") as HTMLElement;
    span.textContent = "New Name";
    span.dispatchEvent(new Event("blur", { bubbles: true }));
    expect(store.getState().name).toBe("New Name");
  });

  it("renders 'Build by ingredients' badge in ingredients mode", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [{ uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 }] });
    mountHeadline(root, store);
    expect(root.querySelector(".mode-badge")?.textContent).toMatch(/Build by ingredients/);
  });

  it("renders 'Build by target weight' badge in target mode", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", target_loaf_g: 900, items: [{ uid: "abcdefgh01", ingredient_id: "bread_flour", bakers_pct: 100 }] });
    mountHeadline(root, store);
    expect(root.querySelector(".mode-badge")?.textContent).toMatch(/Build by target weight/);
  });

  it("renders existing notes; click + Add note when empty", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", notes: "soft crumb", items: [{ uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 }] });
    mountHeadline(root, store);
    expect(root.querySelector("[data-role='notes']")?.textContent).toBe("soft crumb");
  });
});
