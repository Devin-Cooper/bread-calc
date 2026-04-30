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
  it("rejects payloads with schema_version other than '2.0'", async () => {
    // Encode a v1.0-shaped recipe via the same codec — the test only cares about
    // the round-trip rejection at decode time. We bypass the producer-side
    // validator by passing the v1 blob through the public `encodeRecipeHash`
    // (which doesn't validate schema_version).
    const v1: any = { schema_version: "1.0", items: [{ ingredient_id: "bread_flour", grams: 553 }] };
    const encoded = await encodeRecipeHash(v1);
    await expect(decodeRecipeHash(encoded)).rejects.toThrow(/schema_version/);
  });
  it("round-trips all 5 sub-project-B metadata fields through encode/decode", async () => {
    const original: Recipe = {
      schema_version: "2.0",
      name: "URL-hash test",
      course: "whole_wheat",
      crust_shade: "medium",
      loaf_size: "2lb",
      extended_notes: "Long notes.\n\nMultiple paragraphs.",
      bake_hints: ["a", "b"],
      items: [{ uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 }],
    };
    const encoded = await encodeRecipeHash(original);
    const decoded = await decodeRecipeHash(encoded);
    expect(decoded).toEqual(original);
  });
});
