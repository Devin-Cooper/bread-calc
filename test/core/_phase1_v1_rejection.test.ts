import { describe, it, expect } from "vitest";
import { validateRecipe } from "../../src/core/validate.js";

describe("v1.0 input rejection", () => {
  it("rejects schema_version 1.0", () => {
    const v1 = { schema_version: "1.0", items: [{ ingredient_id: "bread_flour", grams: 553 }] };
    const r = validateRecipe(v1 as never);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.path.includes("schema_version"))).toBe(true);
  });
  it("rejects v2.0 recipe with no uids", () => {
    const r = validateRecipe({
      schema_version: "2.0",
      items: [{ ingredient_id: "bread_flour", grams: 553 }],
    } as never);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.message.toLowerCase().includes("uid"))).toBe(true);
  });
});
