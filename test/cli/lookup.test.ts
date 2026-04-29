import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const BIN = "./dist/cli/bin.js";

describe("bread-calc lookup", () => {
  it("exact id match scores 1.0", () => {
    const out = execFileSync("node", [BIN, "lookup", "bread_flour", "--json"], { encoding: "utf8" });
    const env = JSON.parse(out);
    expect(env.payload[0].ingredient_id).toBe("bread_flour");
    expect(env.payload[0].score).toBe(1.0);
  });
  it("respects --limit", () => {
    const out = execFileSync("node", [BIN, "lookup", "a", "--limit=3", "--json"], { encoding: "utf8" });
    const env = JSON.parse(out);
    expect(env.payload.length).toBeLessThanOrEqual(3);
  });
});
