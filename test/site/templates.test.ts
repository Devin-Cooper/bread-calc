/// <reference types="happy-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "../../src/core/index.js";
import { buildTemplates, loadTemplate, _resetCache } from "../../src/site/templates.js";
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
  courses:     [],
  defaults:    defaultsRaw as any,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("site templates module", () => {
  beforeEach(() => { _resetCache(); });

  it("buildTemplates returns one TemplateEntry per JSON entry", () => {
    const templates = buildTemplates(db);
    expect(templates.length).toBeGreaterThanOrEqual(5);
    expect(templates[0]?.name).toBe("Basic White Bread");
    expect(templates[0]?.recipe.schema_version).toBe("2.0");
    expect(templates[0]?.totals.zone).toBeDefined();
  });

  it("buildTemplates is idempotent (returns same array reference)", () => {
    const a = buildTemplates(db);
    const b = buildTemplates(db);
    expect(a).toBe(b); // same reference, not just equal
  });

  it("loadTemplate returns a copy with fresh uids on every call", () => {
    const templates = buildTemplates(db);
    const r1 = loadTemplate(templates[0]!);
    const r2 = loadTemplate(templates[0]!);
    expect(r1.items[0]!.uid).not.toBe(r2.items[0]!.uid);
    expect(templates[0]!.recipe.items[0]!.uid).not.toBe(r1.items[0]!.uid);
  });

  it("every shipped template computes without throwing", () => {
    expect(() => buildTemplates(db)).not.toThrow();
  });
});
