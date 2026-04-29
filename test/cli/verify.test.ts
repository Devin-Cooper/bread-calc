import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const BIN = "./dist/cli/bin.js";

function run(args: string[], input?: string): { code: number; stdout: string } {
  try { return { code: 0, stdout: execFileSync(BIN, args, { input, stdio: ["pipe", "pipe", "pipe"] }).toString() }; }
  catch (e: unknown) { const err = e as { status?: number; stdout?: Buffer }; return { code: err.status ?? 1, stdout: err.stdout?.toString() ?? "" }; }
}

describe("bread-calc verify", () => {
  const recipe = {
    schema_version: "2.0",
    items: [
      { uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 553 },
      { uid: "u_water001", ingredient_id: "water_tap",   grams: 326 },
    ],
  };
  it("exits 0 when all claims match", () => {
    const claim = { recipe, claims: { "metrics.total_flour_g": 553 } };
    expect(run(["verify", "-"], JSON.stringify(claim)).code).toBe(0);
  });
  it("exits 6 when at least one claim diverges", () => {
    const claim = { recipe, claims: { "metrics.total_flour_g": 999 } };
    expect(run(["verify", "-"], JSON.stringify(claim)).code).toBe(6);
  });
});
