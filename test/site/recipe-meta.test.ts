import { describe, it, expect, vi } from "vitest";
import type { Database, Recipe } from "../../src/core/index.js";
import { createStore } from "../../src/site/state.js";
import { mount } from "../../src/site/components/recipe-meta.js";
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

const minimalDb: Database = {
  ingredients: [], flours: [], references: [], machines: [],
  defaults: {} as never,
  courses: [
    { id: "white", course_number: 1, name: "White", crust_shades: ["light","medium","dark"], loaf_sizes: ["1.5lb","2lb"], total_minutes: 205, stages: [], bakes: true, inclusions_beep: true, dietary_modes: [], yeast_compatibility: ["instant"], confidence: "verified", sources: [] },
    { id: "whole_wheat", course_number: 2, name: "Whole Wheat", crust_shades: ["medium"], loaf_sizes: ["1.5lb","2lb"], total_minutes: 200, stages: [], bakes: true, inclusions_beep: true, dietary_modes: [], yeast_compatibility: ["instant"], confidence: "verified", sources: [] },
  ],
};

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
});

describe("recipe-meta — intent disclosure", () => {
  it("renders the intent disclosure collapsed when no intent is set", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    const details = parent.querySelector(".recipe-meta-intent") as HTMLDetailsElement | null;
    expect(details).not.toBeNull();
    expect(details!.dataset.state).toBe("unset");
    expect(details!.open).toBe(false);
  });

  it("auto-opens the intent disclosure when recipe.intent has any key set", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, intent: { dietary: "vegan" } });
    mount(parent, store, db);
    const details = parent.querySelector(".recipe-meta-intent") as HTMLDetailsElement;
    expect(details.dataset.state).toBe("set");
    expect(details.open).toBe(true);
  });

  it("intent chip text reflects current intent (vegan + rapid → '· vegan, rapid')", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, intent: { dietary: "vegan", time: "rapid" } });
    mount(parent, store, db);
    const chip = parent.querySelector(".intent-chip") as HTMLSpanElement;
    expect(chip.textContent).toBe("· vegan, rapid");
  });

  it("clicking dietary='sugar_free' button dispatches set_intent_dietary action", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    const btn = parent.querySelector('[data-dietary="sugar_free"]') as HTMLButtonElement;
    btn.click();
    expect(store.getState().intent?.dietary).toBe("sugar_free");
  });

  it("clicking 'None' on dietary clears intent.dietary", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, intent: { dietary: "vegan" } });
    mount(parent, store, db);
    const btn = parent.querySelector('[data-clear="intent_dietary"]') as HTMLButtonElement;
    btn.click();
    expect(store.getState().intent?.dietary).toBeUndefined();
  });

  it("setting intent.dietary='sugar_free' on a sweetenerless recipe flips top-1 to Sugar Free", () => {
    const parent = document.createElement("div");
    // butter at 3% of flour pushes past the European structural threshold (>2%) so the
    // tree routes to White (default) rather than European. No sweeteners means
    // is_sugar_free_structural=true, so setting intent.dietary='sugar_free' flips top-1.
    const sweetenerlessRecipe = {
      schema_version: "2.0" as const,
      items: [
        { uid: "u_sl_a", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_sl_b", ingredient_id: "yeast_instant", grams: 6 },
        { uid: "u_sl_c", ingredient_id: "butter_unsalted", grams: 15 },
      ],
    };
    const store = createStore(sweetenerlessRecipe);
    mount(parent, store, db);
    const beforeTop = parent.querySelector(".rec-row-1 .rec-name")?.textContent;
    expect(beforeTop).toBe("White");
    store.dispatch({ type: "set_intent_dietary", dietary: "sugar_free" });
    const afterTop = parent.querySelector(".rec-row-1 .rec-name")?.textContent;
    expect(afterTop).toBe("Sugar Free");
  });
});

describe("recipe-meta — top-3 recommendation list", () => {
  it("renders three eligible courses with rank, name, branch label", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    const rows = parent.querySelectorAll(".rec-top3 .rec-row");
    expect(rows.length).toBe(3);
    rows.forEach((row, i) => {
      const rankText = row.querySelector(".rec-rank")?.textContent;
      expect(rankText).toBe(`#${i + 1}`);
      expect(row.querySelector(".rec-name")?.textContent).toBeTruthy();
      expect(row.querySelector(".rec-branch")?.textContent).toMatch(/^via /);
    });
  });

  it("each top-3 row has a [Use] button when the row is not the user's already-set course", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    parent.querySelectorAll(".rec-top3 .rec-row").forEach((row) => {
      expect(row.querySelector(".rec-use")).not.toBeNull();
    });
  });

  it("user's already-set course (when in top-3) shows '✓ your pick' marker, not [Use] button", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe, course: "white" });
    mount(parent, store, db);
    const userRow = parent.querySelector('.rec-top3 .rec-row[data-course-id="white"]');
    expect(userRow).not.toBeNull();
    expect(userRow!.querySelector(".rec-use")).toBeNull();
    expect(userRow!.querySelector(".rec-user-marker")?.textContent).toContain("your pick");
  });

  it("when user.course is outside top-3, footer shows 'Your pick: X (rank #N of M)'", () => {
    const parent = document.createElement("div");
    // jam is non-baking; for a typical bread recipe it's eligible (no intent.output set) but won't be in top-3
    const store = createStore({ ...baseRecipe, course: "jam" });
    mount(parent, store, db);
    const top3Ids = Array.from(parent.querySelectorAll(".rec-top3 .rec-row"))
      .map((r) => (r as HTMLElement).dataset.courseId);
    expect(top3Ids).not.toContain("jam");
    const footer = parent.querySelector(".rec-user-pick");
    expect(footer).not.toBeNull();
    expect(footer!.textContent).toContain("Jam");
  });

  it("clicking [Use] button dispatches set_course with that course id", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    const useBtn = parent.querySelector('.rec-top3 .rec-row-2 .rec-use') as HTMLButtonElement;
    expect(useBtn).not.toBeNull();
    const targetId = (useBtn.closest(".rec-row") as HTMLElement).dataset.courseId;
    useBtn.click();
    expect(store.getState().course).toBe(targetId);
  });
});

describe("recipe-meta — See-all per-row expander", () => {
  it("clicking a row expander toggles aria-expanded and reveals the detail row", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    (parent.querySelector(".rec-see-all") as HTMLButtonElement).click();
    const expandBtn = parent.querySelector(".rec-row-expand") as HTMLButtonElement;
    expect(expandBtn.getAttribute("aria-expanded")).toBe("false");
    const detailId = expandBtn.getAttribute("aria-controls")!;
    const detail = parent.querySelector(`#${detailId}`) as HTMLElement;
    expect(detail.hasAttribute("hidden")).toBe(true);
    expandBtn.click();
    expect(expandBtn.getAttribute("aria-expanded")).toBe("true");
    expect(detail.hasAttribute("hidden")).toBe(false);
  });

  it("per-course detail contains recommended_for_notes and the fingerprint list", () => {
    const parent = document.createElement("div");
    const store = createStore({ ...baseRecipe });
    mount(parent, store, db);
    (parent.querySelector(".rec-see-all") as HTMLButtonElement).click();
    const detail = parent.querySelector("#rec-row-detail-white") as HTMLElement;
    expect(detail).not.toBeNull();
    expect(detail.querySelector(".rec-row-notes")?.textContent).toBeTruthy();
    const fingerprintItems = detail.querySelectorAll(".rec-row-fingerprint li");
    expect(fingerprintItems.length).toBeGreaterThan(0);
    const fingerprintText = Array.from(fingerprintItems).map((li) => li.textContent ?? "").join(" ");
    expect(fingerprintText).toMatch(/Hydration: \d+/);
    expect(fingerprintText).toMatch(/Yeast:/);
    expect(fingerprintText).toMatch(/Loaf sizes:/);
    expect(fingerprintText).toMatch(/Total time: \d+:\d{2}/);
  });
});
