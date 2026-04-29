import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BIN = "./dist/cli/bin.js";

function run(args: string[], opts: { input?: string } = {}): { code: number; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    input: opts.input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

// A recipe that triggers the no_salt warning (no salt item)
const NO_SALT_RECIPE = {
  schema_version: "2.0",
  items: [
    { uid: "u_brdfl001", ingredient_id: "bread_flour", grams: 553 },
    { uid: "u_water001", ingredient_id: "water_tap", grams: 326 },
  ],
};

// A simple add_ingredient fix for salt
const SALT_FIX = {
  kind: "add_ingredient",
  ingredient_id: "salt_table",
  grams: 9,
  rationale: "Add salt.",
};

describe("bread-calc apply", () => {
  it("positional fix.json mode applies the fix", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "bread-calc-test-"));
    const recipePath = join(tmpDir, "recipe.json");
    const fixPath = join(tmpDir, "fix.json");
    writeFileSync(recipePath, JSON.stringify(NO_SALT_RECIPE));
    writeFileSync(fixPath, JSON.stringify(SALT_FIX));

    try {
      const out = execFileSync("node", [BIN, "apply", recipePath, fixPath], { encoding: "utf8" });
      const result = JSON.parse(out);
      // Should have added salt_table
      expect(result.items.some((i: { ingredient_id: string }) => i.ingredient_id === "salt_table")).toBe(true);
    } catch (e: unknown) {
      const err = e as { status?: number; stderr?: Buffer };
      throw new Error(`apply failed with code ${err.status}: ${err.stderr?.toString()}`);
    }
  });

  it("--fix=- stdin mode applies the fix", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "bread-calc-test-"));
    const recipePath = join(tmpDir, "recipe.json");
    writeFileSync(recipePath, JSON.stringify(NO_SALT_RECIPE));

    const r = run(["apply", recipePath, "--fix=-"], { input: JSON.stringify(SALT_FIX) });
    expect(r.code).toBe(0);
    const result = JSON.parse(r.stdout);
    expect(result.items.some((i: { ingredient_id: string }) => i.ingredient_id === "salt_table")).toBe(true);
  });

  it("--fix-id=no_salt.0 selector mode applies suggested fix", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "bread-calc-test-"));
    const recipePath = join(tmpDir, "recipe.json");
    writeFileSync(recipePath, JSON.stringify(NO_SALT_RECIPE));

    const r = run(["apply", recipePath, "--fix-id=no_salt.0"]);
    expect(r.code).toBe(0);
    const result = JSON.parse(r.stdout);
    // The fix should add salt_table
    expect(result.items.some((i: { ingredient_id: string }) => i.ingredient_id === "salt_table")).toBe(true);
  });

  it("exit 5 on bad --fix-id code (no matching warning)", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "bread-calc-test-"));
    const recipePath = join(tmpDir, "recipe.json");
    writeFileSync(recipePath, JSON.stringify(NO_SALT_RECIPE));

    const r = run(["apply", recipePath, "--fix-id=nonexistent_warning.0"]);
    expect(r.code).toBe(5);
  });

  it("exit 64 on malformed --fix-id (no dot)", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "bread-calc-test-"));
    const recipePath = join(tmpDir, "recipe.json");
    writeFileSync(recipePath, JSON.stringify(NO_SALT_RECIPE));

    const r = run(["apply", recipePath, "--fix-id=wrong_format_no_dot"]);
    expect(r.code).toBe(64);
  });

  it("exit 64 when no fix mode supplied", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "bread-calc-test-"));
    const recipePath = join(tmpDir, "recipe.json");
    writeFileSync(recipePath, JSON.stringify(NO_SALT_RECIPE));

    const r = run(["apply", recipePath]);
    expect(r.code).toBe(64);
  });

  it("exit 64 when multiple fix modes supplied", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "bread-calc-test-"));
    const recipePath = join(tmpDir, "recipe.json");
    const fixPath = join(tmpDir, "fix.json");
    writeFileSync(recipePath, JSON.stringify(NO_SALT_RECIPE));
    writeFileSync(fixPath, JSON.stringify(SALT_FIX));

    const r = run(["apply", recipePath, fixPath, "--fix-id=no_salt.0"]);
    expect(r.code).toBe(64);
  });
});
