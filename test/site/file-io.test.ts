/// <reference types="happy-dom" />
import { describe, it, expect } from "vitest";
import { readRecipeFile } from "../../src/site/persistence/file-io.js";

describe("readRecipeFile", () => {
  it("parses a valid .bread.json blob", async () => {
    const recipe = { schema_version: "2.0", items: [{ uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 500 }] };
    const file = new File([JSON.stringify(recipe)], "test.bread.json", { type: "application/json" });
    const out = await readRecipeFile(file);
    expect(out).toEqual(recipe);
  });
  it("rejects malformed JSON", async () => {
    const file = new File(["not json"], "test.bread.json", { type: "application/json" });
    await expect(readRecipeFile(file)).rejects.toThrow();
  });
  it("round-trips all 5 sub-project-B metadata fields through save/load", async () => {
    const original = {
      schema_version: "2.0",
      course: "white",
      crust_shade: "medium",
      loaf_size: "2lb",
      extended_notes: "First paragraph.\n\nSecond paragraph.",
      bake_hints: ["watch at minute 50", "brush egg wash"],
      items: [{ uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 500 }],
    };
    const file = new File([JSON.stringify(original)], "test.bread.json", { type: "application/json" });
    const loaded = await readRecipeFile(file);
    expect(loaded).toEqual(original);
  });
});
