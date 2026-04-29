import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const BIN = "./dist/cli/bin.js";

function run(args: string[], opts: { input?: string } = {}): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(BIN, args, { input: opts.input, stdio: ["pipe", "pipe", "pipe"] }).toString();
    return { code: 0, stdout, stderr: "" };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: Buffer; stderr?: Buffer };
    return { code: err.status ?? 1, stdout: err.stdout?.toString() ?? "", stderr: err.stderr?.toString() ?? "" };
  }
}

describe("bread-calc validate", () => {
  it("exits 0 on a valid recipe", () => {
    expect(run(["validate", "test/golden/fixtures/classic_white.bread.json"]).code).toBe(0);
  });
  it("exits 2 on an invalid recipe", () => {
    expect(run(["validate", "-"], { input: '{"items":[]}' }).code).toBe(2);
  });
  it("exits 2 on an invalid recipe with --json output", () => {
    const r = run(["validate", "-", "--json"], { input: '{"items":[]}' });
    expect(r.code).toBe(2);
    const out = JSON.parse(r.stdout);
    expect(out.valid).toBe(false);
    expect(out.issues.length).toBeGreaterThan(0);
  });
  it("exits 3 on unknown ingredient_id", () => {
    const r = run(["validate", "-"], {
      input: JSON.stringify({ schema_version: "2.0", items: [{ uid: "u_brdfl001", ingredient_id: "doesnotexist", grams: 500 }] }),
    });
    expect(r.code).toBe(3);
  });
});

describe("bread-calc solve", () => {
  it("solves a target-weight recipe and outputs JSON", () => {
    const r = run(["solve", "-", "--target-g=800"], {
      input: JSON.stringify({
        schema_version: "2.0",
        items: [
          { uid: "u_brdfl001", ingredient_id: "bread_flour", bakers_pct: 100 },
          { uid: "u_water001", ingredient_id: "water_tap", bakers_pct: 65 },
        ],
      }),
    });
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.items[0].grams).toBeGreaterThan(0);
  });
  it("exits 2 with solver error on ambiguous flour (fixed-grams flour + pct items)", () => {
    // Both fixed-grams flour AND pct items with a target → solver_ambiguous_flour
    const r = run(["solve", "-", "--target-g=800", "--json"], {
      input: JSON.stringify({
        schema_version: "2.0",
        items: [
          { uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 500 },
          { uid: "u_water001", ingredient_id: "water_tap", bakers_pct: 65 },
        ],
      }),
    });
    expect(r.code).toBe(2);
    const out = JSON.parse(r.stdout);
    expect(out.error).toBe("solver_ambiguous_flour");
  });
  it("exits 64 on invalid --target-g (non-numeric)", () => {
    const r = run(["solve", "-", "--target-g=abc"], {
      input: JSON.stringify({ schema_version: "2.0", items: [{ uid: "u_brdfl001", ingredient_id: "bread_flour", bakers_pct: 100 }] }),
    });
    expect(r.code).toBe(64);
  });
});

describe("bread-calc ingredients", () => {
  it("lists ingredients filtered by category as JSON", () => {
    const r = run(["ingredients", "--category=fats", "--json"]);
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((i: { category: string }) => i.category === "fats")).toBe(true);
  });
  it("searches by substring", () => {
    const r = run(["ingredients", "--search=banana", "--json"]);
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.some((i: { id: string }) => i.id.includes("banana"))).toBe(true);
  });
});

describe("bread-calc reference", () => {
  it("lists BB-PDC20 reference recipes filtered by zone", () => {
    const r = run(["reference", "--zone=very_wet", "--json"]);
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((x: { zone: string }) => x.zone === "very_wet")).toBe(true);
  });
});

describe("bread-calc schema", () => {
  it("dumps schema JSON", () => {
    const r = run(["schema"]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).$id).toContain("breadmachine.io/schema");
  });
});
