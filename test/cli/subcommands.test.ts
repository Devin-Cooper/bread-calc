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
});

describe("bread-calc solve", () => {
  it("solves a target-weight recipe and outputs JSON", () => {
    const r = run(["solve", "-", "--target-g=800"], {
      input: JSON.stringify({
        schema_version: "1.0",
        items: [
          { ingredient_id: "bread_flour", bakers_pct: 100 },
          { ingredient_id: "water_tap", bakers_pct: 65 },
        ],
      }),
    });
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.items[0].grams).toBeGreaterThan(0);
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
