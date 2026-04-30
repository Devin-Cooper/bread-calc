import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

const baseRecipe: Recipe = {
  schema_version: "2.0",
  name: "Test Recipe",
  notes: "one-line notes",
  items: [
    { uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 },
    { uid: "u_test_a01c", ingredient_id: "water_tap", grams: 320 },
    { uid: "u_test_a01d", ingredient_id: "salt_table", grams: 9 },
    { uid: "u_test_a01e", ingredient_id: "yeast_instant", grams: 6 },
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
});
