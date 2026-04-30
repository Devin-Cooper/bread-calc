import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function makeMemStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
  } as Storage;
}
import type { Database, Recipe } from "../../src/core/index.js";
import { createStore } from "../../src/site/state.js";
import { mount } from "../../src/site/pdf/kitchen-card.js";
import ingredientsFile from "../../src/data/ingredients.json" with { type: "json" };
import floursFile from "../../src/data/flours.json" with { type: "json" };
import coursesFile from "../../src/data/bb_pdc20_courses.json" with { type: "json" };
import machinesFile from "../../src/data/machines.json" with { type: "json" };
import defaultsRaw from "../../src/data/defaults.json" with { type: "json" };

vi.mock("../../src/core/uid.js", () => {
  let n = 0;
  return {
    generateUid: () => `u_test${(++n).toString().padStart(4, "0")}`,
    isValidUid: (s: unknown): boolean => typeof s === "string" && /^[A-Za-z0-9_-]{8,16}$/.test(s),
    UID_REGEX: /^[A-Za-z0-9_-]{8,16}$/,
  };
});

/* eslint-disable @typescript-eslint/no-explicit-any */
const db: Database = {
  ingredients: (ingredientsFile as any).entries,
  flours:      (floursFile as any).entries,
  references:  [],
  machines:    (machinesFile as any).entries,
  courses:     (coursesFile as any).entries,
  defaults:    defaultsRaw as any,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// Canonical white-bread recipe with butter + sugar — matches Course 1 White's
// enrichment profile and falls outside the European structural predicate's
// lean-bread thresholds (sugar/flour > 4%, butter/flour > 2%). This ensures
// the tree-predictor engine surfaces White as the top recommendation in the
// recommendation-fallback test, which is the typical case a user printing
// this recipe expects.
const baseRecipe: Recipe = {
  schema_version: "2.0",
  name: "Test Recipe",
  notes: "one-line notes",
  items: [
    { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
    { uid: "u_test_a01c", ingredient_id: "water_tap", grams: 290 },
    { uid: "u_test_a01d", ingredient_id: "sugar_granulated", grams: 30 },
    { uid: "u_test_a01e", ingredient_id: "butter_unsalted", grams: 30 },
    { uid: "u_test_a01f", ingredient_id: "salt_table", grams: 9 },
    { uid: "u_test_a01g", ingredient_id: "yeast_instant", grams: 6 },
  ],
};

const PRINT_ROLE_KEY = "bread-calc:print-show-role";

beforeEach(() => {
  try { localStorage.removeItem(PRINT_ROLE_KEY); } catch { /* ignore */ }
});
afterEach(() => {
  try { localStorage.removeItem(PRINT_ROLE_KEY); } catch { /* ignore */ }
});

describe("kitchen-card component", () => {
  it("renders recipe name, one-line notes, and the metric strip in the header", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    expect(parent.querySelector(".kc-name")?.textContent).toContain("Test Recipe");
    expect(parent.querySelector(".kc-notes")?.textContent).toContain("one-line notes");
    expect(parent.querySelectorAll(".kc-metric").length).toBe(3);
  });

  it("course block: shows user pick '<n> — <name>' when recipe.course is set + valid", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, course: "white" });
    mount(parent, store, db);
    const courseBlock = parent.querySelector(".kc-course-block");
    expect(courseBlock).not.toBeNull();
    expect(courseBlock!.textContent).toContain("1 — White");
    expect(courseBlock!.textContent).not.toContain("Recommended:");
  });

  it("course block: shows 'Recommended:' prefix when recipe.course is unset", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    const courseBlock = parent.querySelector(".kc-course-block");
    expect(courseBlock).not.toBeNull();
    // baseRecipe carries sugar + butter that exceed the European structural
    // thresholds, so the tree-predictor falls through to White as the default
    // for an enriched bread-flour recipe.
    expect(courseBlock!.textContent).toContain("Recommended:");
    expect(courseBlock!.textContent).toContain("1 — White");
  });

  it("course block: omitted when recipe.course is set to unknown id", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, course: "made_up_course" });
    mount(parent, store, db);
    expect(parent.querySelector(".kc-course-block")).toBeNull();
  });

  it("crust/size sub-line: shows user picks when recipe.crust_shade and recipe.loaf_size are set", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, course: "white", crust_shade: "dark", loaf_size: "2lb" });
    mount(parent, store, db);
    const subline = parent.querySelector(".kc-course-subline");
    expect(subline).not.toBeNull();
    expect(subline!.textContent).toContain("Crust:");
    expect(subline!.textContent).toContain("Dark");
    expect(subline!.textContent).toContain("Size:");
    expect(subline!.textContent).toContain("2");
    expect(subline!.textContent).toContain("lb");
  });

  it("crust/size sub-line: falls back to course defaults when recipe fields are unset", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, course: "white" });
    mount(parent, store, db);
    const subline = parent.querySelector(".kc-course-subline");
    expect(subline).not.toBeNull();
    expect(subline!.textContent).toContain("Medium");
    expect(subline!.textContent).toContain("2");
    expect(subline!.textContent).toContain("lb");
  });

  it("crust/size sub-line: omitted when course is non-baking (Dough)", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, course: "dough" });
    mount(parent, store, db);
    const courseBlock = parent.querySelector(".kc-course-block");
    expect(courseBlock).not.toBeNull();
    expect(courseBlock!.textContent).toContain("11 — Dough");
    expect(parent.querySelector(".kc-course-subline")).toBeNull();
  });

  it("notes block: extended_notes renders multi-paragraph as separate <p> elements", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, extended_notes: "First paragraph.\n\nSecond paragraph." });
    mount(parent, store, db);
    const notesBlock = parent.querySelector(".kc-notes-block");
    expect(notesBlock).not.toBeNull();
    const paragraphs = notesBlock!.querySelectorAll("p");
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0]!.textContent).toBe("First paragraph.");
    expect(paragraphs[1]!.textContent).toBe("Second paragraph.");
  });

  it("notes block: omitted when extended_notes is undefined", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    expect(parent.querySelector(".kc-notes-block")).toBeNull();
  });

  it("bake hints block: bake_hints renders as <ul> with one <li> per hint", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, bake_hints: ["Watch crust at minute 50", "Brush with egg wash"] });
    mount(parent, store, db);
    const hintsBlock = parent.querySelector(".kc-hints-block");
    expect(hintsBlock).not.toBeNull();
    const lis = hintsBlock!.querySelectorAll("li");
    expect(lis.length).toBe(2);
    expect(lis[0]!.textContent).toBe("Watch crust at minute 50");
    expect(lis[1]!.textContent).toBe("Brush with egg wash");
  });

  it("bake hints block: omitted when bake_hints is undefined or empty", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    expect(parent.querySelector(".kc-hints-block")).toBeNull();
  });

  it("brand footer: renders the literal text 'breadmachine.io'", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    expect(parent.querySelector(".kc-footer")?.textContent?.trim()).toBe("breadmachine.io");
  });

  it("course block: omitted when recommendCourse returns no eligible course (empty courses)", () => {
    const stubDb: Database = { ...db, courses: [] };
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, stubDb);
    expect(parent.querySelector(".kc-course-block")).toBeNull();
  });

  it("course block: non-baking course wins as recommendation → heading renders, sub-line omits", () => {
    const nonBakingCourse = db.courses.find((c) => c.id === "dough")!;
    const stubDb: Database = { ...db, courses: [nonBakingCourse] };
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, stubDb);
    const courseBlock = parent.querySelector(".kc-course-block");
    expect(courseBlock).not.toBeNull();
    expect(courseBlock!.textContent).toContain("Recommended: 11 — Dough");
    expect(parent.querySelector(".kc-course-subline")).toBeNull();
  });

  it("course block: non-baking course as user pick → heading renders, sub-line omits", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, course: "dough" });
    mount(parent, store, db);
    const courseBlock = parent.querySelector(".kc-course-block");
    expect(courseBlock).not.toBeNull();
    expect(courseBlock!.textContent).toContain("11 — Dough");
    expect(parent.querySelector(".kc-course-subline")).toBeNull();
  });

  it("role column: appears in ingredients table when localStorage PRINT_ROLE_KEY is '1'", () => {
    const mem = makeMemStorage();
    mem.setItem(PRINT_ROLE_KEY, "1");
    vi.stubGlobal("localStorage", mem);
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    vi.unstubAllGlobals();
    expect(parent.querySelector(".kc-th-role")).not.toBeNull();
    expect(parent.querySelectorAll(".kc-td-role").length).toBeGreaterThan(0);
  });

  it("role column: absent when PRINT_ROLE_KEY is unset", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    expect(parent.querySelector(".kc-th-role")).toBeNull();
  });
});
