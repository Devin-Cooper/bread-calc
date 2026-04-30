/// <reference types="happy-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { mount as mountBand } from "../../src/site/components/zone-band.js";
import { createStore } from "../../src/site/state.js";
import type { Database } from "../../src/core/index.js";

// Use a minimal db with a couple of reference recipes for tick rendering.
const db = {
  ingredients: [], flours: [],
  references: [
    { id: "r1", name: "Classic White", course: "Basic", total_flour_g: 500, total_water_g: 300, hydration_pct_nominal: 60, zone: "sandwich" },
    { id: "r2", name: "Whole Wheat",  course: "Basic", total_flour_g: 500, total_water_g: 380, hydration_pct_nominal: 76, zone: "wet" },
  ],
  machines: [], defaults: { default_machine_id: "m" },
} as unknown as Database;

describe("zone-band", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("renders four zone segments", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [] });
    mountBand(root, store, db);
    const segs = root.querySelectorAll(".zone-segment");
    expect(segs.length).toBe(4);
    const ids = Array.from(segs).map((s) => s.getAttribute("data-zone-id"));
    expect(ids).toEqual(["dry", "sandwich", "wet", "very_wet"]);
  });

  it("renders one tick per non-excluded reference recipe", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [] });
    mountBand(root, store, db);
    expect(root.querySelectorAll(".zone-tick").length).toBe(2);
  });

  it("does not crash when hydration is uncomputable", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [
      { uid: "abcdefgh01", ingredient_id: "bread_flour", grams: 500 },
      { uid: "ijklmnopqr", ingredient_id: "water_tap",   grams: 350 },
    ]});
    mountBand(root, store, db);
    // The empty db (no flours/ingredients lookups) makes computeRecipe throw — band renders without marker.
    expect(root.querySelector(".zone-band")).not.toBeNull();
  });
});
