import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const BIN = "./dist/cli/bin.js";

function run(args: string[], opts: { input?: string } = {}): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(BIN, args, { input: opts.input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 10 * 1024 * 1024 }).toString();
    return { code: 0, stdout, stderr: "" };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: Buffer; stderr?: Buffer };
    return { code: err.status ?? 1, stdout: err.stdout?.toString() ?? "", stderr: err.stderr?.toString() ?? "" };
  }
}

describe("bread-calc compute", () => {
  it("computes a fixture and exits 0 with --json", () => {
    // --slim omits the ingredient tree, keeping output well under pipe-buffer limits
    const r = run(["compute", "test/golden/fixtures/classic_white.bread.json", "--json", "--slim"]);
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out._meta.subcommand).toBe("compute");
    expect(out.payload.hydration.effective_pct).toBeGreaterThan(0);
  });
  it("exits 1 when result has an error-severity warning (pan_overflow)", () => {
    // Create a temp recipe inline via stdin
    const recipe = JSON.stringify({
      schema_version: "2.0", machine: "zojirushi_bb_pdc20",
      items: [
        { uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 800 },
        { uid: "u_water001", ingredient_id: "water_tap", grams: 500 },
      ],
    });
    const r = run(["compute", "-", "--json"], { input: recipe });
    expect(r.code).toBe(1);
  });
  it("exits 2 on schema error", () => {
    const r = run(["compute", "-", "--json"], { input: '{"items":[]}' });
    expect(r.code).toBe(2);
  });
  it("exits 3 on unknown ingredient_id", () => {
    const r = run(["compute", "-", "--json"], {
      input: JSON.stringify({ schema_version: "2.0", items: [{ uid: "u_brdfl001", ingredient_id: "doesnotexist", grams: 500 }] }),
    });
    expect(r.code).toBe(3);
  });
  it("exits 64 on missing argument", () => {
    const r = run(["compute"]);
    expect(r.code).toBe(64);
  });
  it("emits output (human or JSON) when --json is omitted", () => {
    // execFileSync pipes stdout, so process.stdout.isTTY is undefined and the handler
    // auto-falls back to JSON. Once Task 2.5 wires up the human formatter, the assertion
    // can tighten to check for human-format markers ("Effective hydration") specifically.
    const r = run(["compute", "test/golden/fixtures/classic_white.bread.json"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Effective hydration|"hydration"/);
  });
});
