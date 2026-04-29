import { describe, it, expect } from "vitest";
import { encodeRecipeHash, decodeRecipeHash } from "../../src/site/persistence/url-hash.js";
import type { Recipe } from "../../src/core/index.js";

const recipe: Recipe = {
  schema_version: "2.0", name: "Test loaf",
  items: [
    { uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 500 },
    { uid: "u_water001", ingredient_id: "water_tap", grams: 320 },
  ],
};

describe("URL hash codec", () => {
  it("roundtrips a recipe", async () => {
    const encoded = await encodeRecipeHash(recipe);
    const decoded = await decodeRecipeHash(encoded);
    expect(decoded).toEqual(recipe);
  });
  it("produces base64url-safe output (no '/', '+', '=')", async () => {
    const encoded = await encodeRecipeHash(recipe);
    expect(encoded).not.toMatch(/[/+=]/);
  });
  it("rejects payload exceeding 16 KB after decompression", async () => {
    const huge: Recipe = { schema_version: "2.0", items: [], name: "x".repeat(20_000) };
    const encoded = await encodeRecipeHash(huge);
    await expect(decodeRecipeHash(encoded)).rejects.toThrow(/16 KB/);
  });
});
