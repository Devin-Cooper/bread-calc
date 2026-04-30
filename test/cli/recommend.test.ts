import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";

const CLI_PATH = "dist/cli/bin.js";

function run(args: string[], stdin?: string): { stdout: string; stderr: string; code: number } {
  const r = spawnSync("node", [CLI_PATH, ...args], stdin !== undefined ? { input: stdin, encoding: "utf8" } : { encoding: "utf8" });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status ?? -1 };
}

const sampleRecipe = JSON.stringify({
  schema_version: "2.0",
  items: [{ uid: "u_test_a01b", ingredient_id: "bread_flour", grams: 500 }],
});

describe("cli recommend", () => {
  it("text mode prints a table with at least 16 lines (header + rule + 14 rows)", () => {
    const r = run(["recommend", "-", "--no-color"], sampleRecipe);
    expect(r.code).toBe(0);
    const lines = r.stdout.split("\n").filter((l) => l.trim().length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(16);
  });

  it("--json wraps in _meta/payload envelope", () => {
    const r = run(["recommend", "-", "--json"], sampleRecipe);
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed._meta?.subcommand).toBe("recommend");
    expect(parsed.payload?.recommendations).toBeDefined();
    expect(parsed.payload.recommendations.length).toBe(14);
  });

  it("--limit=3 truncates to 3 rows", () => {
    const r = run(["recommend", "-", "--limit=3", "--no-color"], sampleRecipe);
    expect(r.code).toBe(0);
    const lines = r.stdout.split("\n").filter((l) => l.trim().length > 0);
    // header + rule + 3 = 5
    expect(lines.length).toBe(5);
  });

  it("--intent=dough flips eligibility (Dough eligible, White ineligible)", () => {
    const r = run(["recommend", "-", "--json", "--intent=dough"], sampleRecipe);
    const parsed = JSON.parse(r.stdout);
    const dough = parsed.payload.recommendations.find((x: { course_id: string }) => x.course_id === "dough");
    const white = parsed.payload.recommendations.find((x: { course_id: string }) => x.course_id === "white");
    expect(dough.eligible).toBe(true);
    expect(white.eligible).toBe(false);
  });

  it("exit code 0 when at least one course is eligible", () => {
    const r = run(["recommend", "-"], sampleRecipe);
    expect(r.code).toBe(0);
  });

  it("missing positional argument exits with code 64", () => {
    const r = run(["recommend"]);
    expect(r.code).toBe(64);
  });
});
