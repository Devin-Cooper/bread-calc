import { describe, it, expect, vi } from "vitest";
import type { Database, Recipe } from "../../src/core/index.js";
import { createStore } from "../../src/site/state.js";
import { mount } from "../../src/site/components/recipe-meta.js";

vi.mock("../../src/core/uid.js", () => {
  let n = 0;
  return {
    generateUid: () => `u_test${(++n).toString().padStart(4, "0")}`,
    isValidUid: (s: unknown): boolean => typeof s === "string" && /^[A-Za-z0-9_-]{8,16}$/.test(s),
    UID_REGEX: /^[A-Za-z0-9_-]{8,16}$/,
  };
});

const minimalDb: Database = {
  ingredients: [], flours: [], references: [], machines: [],
  defaults: {} as never,
  courses: [
    { id: "white", course_number: 1, name: "White", crust_shades: ["light","medium","dark"], loaf_sizes: ["1.5lb","2lb"], total_minutes: 205, stages: [], bakes: true, inclusions_beep: true, dietary_modes: [], recommended_for: [], yeast_compatibility: ["instant"], confidence: "verified", sources: [] },
    { id: "whole_wheat", course_number: 2, name: "Whole Wheat", crust_shades: ["medium"], loaf_sizes: ["1.5lb","2lb"], total_minutes: 200, stages: [], bakes: true, inclusions_beep: true, dietary_modes: [], recommended_for: [], yeast_compatibility: ["instant"], confidence: "verified", sources: [] },
  ],
};

const baseRecipe: Recipe = {
  schema_version: "2.0",
  items: [{ uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 }],
};

describe("recipe-meta component", () => {
  it("renders a course <select> populated from db.courses with course-number-prefixed labels", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, minimalDb);
    const select = parent.querySelector("select.recipe-meta-course") as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    const options = Array.from(select!.options).map((o) => o.textContent?.trim());
    expect(options).toContain("— none —");
    expect(options).toContain("1 — White");
    expect(options).toContain("2 — Whole Wheat");
  });
  it("dispatches set_course when user picks a course", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, minimalDb);
    const select = parent.querySelector("select.recipe-meta-course") as HTMLSelectElement;
    select.value = "white";
    select.dispatchEvent(new Event("change"));
    expect(store.getState().course).toBe("white");
  });
  it("dispatches set_course(undefined) when '— none —' is picked", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, course: "white" });
    mount(parent, store, minimalDb);
    const select = parent.querySelector("select.recipe-meta-course") as HTMLSelectElement;
    select.value = "";
    select.dispatchEvent(new Event("change"));
    expect("course" in store.getState()).toBe(false);
  });
  it("renders crust shade buttons (light/medium/dark)", () => {
    const parent = document.createElement("div");
    mount(parent, createStore({ ...baseRecipe }), minimalDb);
    const buttons = parent.querySelectorAll("[data-shade]");
    expect(buttons.length).toBe(3);
  });
  it("dispatches set_crust_shade when a button is clicked", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, minimalDb);
    (parent.querySelector('[data-shade="dark"]') as HTMLButtonElement).click();
    expect(store.getState().crust_shade).toBe("dark");
  });
  it("clear button resets crust_shade to undefined", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, crust_shade: "dark" });
    mount(parent, store, minimalDb);
    (parent.querySelector('[data-clear="crust_shade"]') as HTMLButtonElement).click();
    expect("crust_shade" in store.getState()).toBe(false);
  });
  it("renders loaf size buttons (1lb/1.5lb/2lb)", () => {
    const parent = document.createElement("div");
    mount(parent, createStore({ ...baseRecipe }), minimalDb);
    expect(parent.querySelectorAll("[data-size]").length).toBe(3);
  });
  it("dispatches set_loaf_size when a button is clicked", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, minimalDb);
    (parent.querySelector('[data-size="2lb"]') as HTMLButtonElement).click();
    expect(store.getState().loaf_size).toBe("2lb");
  });
  it("clear button resets loaf_size to undefined", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, loaf_size: "2lb" });
    mount(parent, store, minimalDb);
    (parent.querySelector('[data-clear="loaf_size"]') as HTMLButtonElement).click();
    expect("loaf_size" in store.getState()).toBe(false);
  });
  it("renders 'More details' disclosure (closed by default when fields are empty)", () => {
    const parent = document.createElement("div");
    mount(parent, createStore({ ...baseRecipe }), minimalDb);
    const details = parent.querySelector("details.recipe-meta-details") as HTMLDetailsElement | null;
    expect(details).not.toBeNull();
    expect(details!.hasAttribute("open")).toBe(false);
  });
  it("disclosure starts open when extended_notes is set", () => {
    const parent = document.createElement("div");
    mount(parent, createStore({ ...baseRecipe, extended_notes: "x" }), minimalDb);
    const details = parent.querySelector("details.recipe-meta-details") as HTMLDetailsElement;
    expect(details.hasAttribute("open")).toBe(true);
  });
  it("dispatches set_extended_notes on textarea input", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, minimalDb);
    const ta = parent.querySelector("textarea.recipe-meta-extended-notes") as HTMLTextAreaElement;
    ta.value = "new content";
    ta.dispatchEvent(new Event("input"));
    expect(store.getState().extended_notes).toBe("new content");
  });
  it("clearing the textarea (empty string) deletes the field", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, extended_notes: "old" });
    mount(parent, store, minimalDb);
    const ta = parent.querySelector("textarea.recipe-meta-extended-notes") as HTMLTextAreaElement;
    ta.value = "";
    ta.dispatchEvent(new Event("input"));
    expect("extended_notes" in store.getState()).toBe(false);
  });
  it("renders one input per bake hint", () => {
    const parent = document.createElement("div");
    mount(parent, createStore({ ...baseRecipe, bake_hints: ["a", "b", "c"] }), minimalDb);
    expect(parent.querySelectorAll(".bake-hints-list input[type='text']").length).toBe(3);
  });
  it("'+ Add hint' button appends a new empty hint", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, minimalDb);
    (parent.querySelector(".bake-hint-add") as HTMLButtonElement).click();
    expect(store.getState().bake_hints).toEqual([""]);
  });
  it("trash button removes a hint and dispatches the new array", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, bake_hints: ["a", "b"] });
    mount(parent, store, minimalDb);
    const trashBtns = parent.querySelectorAll(".bake-hint-remove");
    (trashBtns[0] as HTMLButtonElement).click();
    expect(store.getState().bake_hints).toEqual(["b"]);
  });
  it("removing the last hint clears the field (empty array → undefined)", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, bake_hints: ["only"] });
    mount(parent, store, minimalDb);
    (parent.querySelector(".bake-hint-remove") as HTMLButtonElement).click();
    expect("bake_hints" in store.getState()).toBe(false);
  });
  it("editing a hint input dispatches the updated array", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, bake_hints: ["a", "b"] });
    mount(parent, store, minimalDb);
    const inputs = parent.querySelectorAll(".bake-hints-list input[type='text']") as NodeListOf<HTMLInputElement>;
    inputs[1]!.value = "B-edited";
    inputs[1]!.dispatchEvent(new Event("input"));
    expect(store.getState().bake_hints).toEqual(["a", "B-edited"]);
  });
  it("preserves focus + caret on extended_notes textarea across rerender", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const store = createStore({ ...baseRecipe, extended_notes: "hello" });
    mount(parent, store, minimalDb);
    const ta = parent.querySelector("textarea.recipe-meta-extended-notes") as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(3, 3);
    // Trigger a rerender by dispatching a non-related action
    store.dispatch({ type: "set_course", course: "white" });
    const active = document.activeElement as HTMLTextAreaElement | null;
    expect(active?.classList.contains("recipe-meta-extended-notes")).toBe(true);
    expect(active?.selectionStart).toBe(3);
    document.body.removeChild(parent);
  });
  it("preserves focus + caret on a bake-hint input across rerender", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const store = createStore({ ...baseRecipe, bake_hints: ["alpha", "beta"] });
    mount(parent, store, minimalDb);
    const inputs = parent.querySelectorAll(".bake-hints-list input[type='text']") as NodeListOf<HTMLInputElement>;
    const target = inputs[1]!;
    target.focus();
    target.setSelectionRange(2, 2);
    // Trigger a rerender
    store.dispatch({ type: "set_course", course: "white" });
    const active = document.activeElement as HTMLInputElement | null;
    expect(active?.dataset.hintIdx).toBe("1");
    expect(active?.selectionStart).toBe(2);
    document.body.removeChild(parent);
  });

  describe("recommendation strip", () => {
    it("State A: no course set — renders 'Recommended: <top course>' with [Use this] button", () => {
      const parent = document.createElement("div");
      const store = createStore({ ...baseRecipe });
      mount(parent, store, minimalDb);
      const strip = parent.querySelector(".recommendation-strip") as HTMLElement | null;
      expect(strip).not.toBeNull();
      expect(strip!.textContent).toContain("Recommended: White");
      const useBtn = parent.querySelector(".rec-use-this") as HTMLButtonElement | null;
      expect(useBtn).not.toBeNull();
    });

    it("[Use this] dispatches set_course with the top recommendation's id", () => {
      const parent = document.createElement("div");
      const store = createStore({ ...baseRecipe });
      mount(parent, store, minimalDb);
      (parent.querySelector(".rec-use-this") as HTMLButtonElement).click();
      expect(store.getState().course).toBe("white");
    });

    it("State B: recipe.course matches top — shows ✓ badge, no swap button", () => {
      const parent = document.createElement("div");
      const store = createStore({ ...baseRecipe, course: "white" });
      mount(parent, store, minimalDb);
      const strip = parent.querySelector(".recommendation-strip") as HTMLElement;
      expect(strip.textContent).toContain("Top match");
      expect(parent.querySelector(".rec-use-top")).toBeNull();
      expect(parent.querySelector(".rec-use-this")).toBeNull();
    });
  });
});
