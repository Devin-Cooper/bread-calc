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
  it("text mode prints the tree-predictor header", () => {
    const r = run(["recommend", "-", "--no-color"], sampleRecipe);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Recommended courses (tree-predictor engine):");
  });

  it("text mode prints at least the top eligible course with rank #1", () => {
    const r = run(["recommend", "-", "--no-color"], sampleRecipe);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/#1\./);
  });

  it("--json wraps in _meta/payload envelope with 14 recommendations", () => {
    const r = run(["recommend", "-", "--json"], sampleRecipe);
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed._meta?.subcommand).toBe("recommend");
    expect(parsed.payload?.recommendations).toBeDefined();
    expect(parsed.payload.recommendations.length).toBe(14);
  });

  it("--limit=3 truncates the eligible list to 3 entries in text mode", () => {
    const r = run(["recommend", "-", "--limit=3", "--no-color"], sampleRecipe);
    expect(r.code).toBe(0);
    const rankMatches = r.stdout.match(/#\d+\./g) ?? [];
    expect(rankMatches.length).toBe(3);
  });

  it("--intent=dough flips eligibility (Dough eligible, White ineligible)", () => {
    const r = run(["recommend", "-", "--json", "--intent=dough"], sampleRecipe);
    const parsed = JSON.parse(r.stdout);
    const dough = parsed.payload.recommendations.find((x: { course_id: string }) => x.course_id === "dough");
    const white = parsed.payload.recommendations.find((x: { course_id: string }) => x.course_id === "white");
    expect(dough.eligible).toBe(true);
    expect(white.eligible).toBe(false);
  });

  it("--dietary-intent=sugar_free routes a sweetenerless recipe to Sugar Free", () => {
    const sweetenerlessRecipe = JSON.stringify({
      schema_version: "2.0",
      items: [
        { uid: "u_a", ingredient_id: "bread_flour", grams: 500 },
        { uid: "u_b", ingredient_id: "yeast_instant", grams: 6 },
      ],
    });
    const r = run(["recommend", "-", "--json", "--dietary-intent=sugar_free"], sweetenerlessRecipe);
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);
    const top = parsed.payload.recommendations.find((x: { rank: number | null }) => x.rank === 1);
    expect(top?.course_id).toBe("sugar_free");
  });

  it("--time-intent=rapid routes a basic white recipe to Rapid White", () => {
    const r = run(["recommend", "-", "--json", "--time-intent=rapid"], sampleRecipe);
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);
    const top = parsed.payload.recommendations.find((x: { rank: number | null }) => x.rank === 1);
    expect(top?.course_id).toBe("rapid_white");
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
