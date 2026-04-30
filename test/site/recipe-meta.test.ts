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
});
