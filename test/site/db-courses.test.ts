/// <reference types="happy-dom" />
import { describe, it, expect } from "vitest";
import type { Database } from "../../src/core/index.js";
import ingredientsFile from "../../src/data/ingredients.json" with { type: "json" };
import floursFile from "../../src/data/flours.json" with { type: "json" };
import recipesFile from "../../src/data/bb_pdc20_recipes.json" with { type: "json" };
import coursesFile from "../../src/data/bb_pdc20_courses.json" with { type: "json" };
import machinesFile from "../../src/data/machines.json" with { type: "json" };
import defaultsRaw from "../../src/data/defaults.json" with { type: "json" };

/* eslint-disable @typescript-eslint/no-explicit-any */
const db: Database = {
  ingredients: (ingredientsFile as any).entries,
  flours:      (floursFile as any).entries,
  references:  (recipesFile as any).entries,
  machines:    (machinesFile as any).entries,
  courses:     (coursesFile as any).entries,
  defaults:    defaultsRaw as any,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("Database.courses wiring", () => {
  it("db.courses is an array", () => {
    expect(Array.isArray(db.courses)).toBe(true);
  });

  // Conditional: meaningful only after Phase 6 populates entries.
  it("when populated, contains the canonical Basic White course as id='white'", () => {
    if (db.courses.length === 0) return;
    const white = db.courses.find((c) => c.id === "white");
    expect(white).toBeDefined();
    expect(white?.course_number).toBe(1);
    expect(white?.name).toMatch(/white/i);
  });
});
