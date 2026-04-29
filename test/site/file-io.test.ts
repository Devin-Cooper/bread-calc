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
});
