import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const BIN = "./dist/cli/bin.js";

function run(args: string[]): { code: number; stdout: string } {
  try { return { code: 0, stdout: execFileSync(BIN, args, { stdio: ["pipe", "pipe", "pipe"] }).toString() }; }
  catch (e: unknown) { const err = e as { status?: number; stdout?: Buffer }; return { code: err.status ?? 1, stdout: err.stdout?.toString() ?? "" }; }
}

describe("bread-calc convert", () => {
  it("converts 100 g bread_flour to 100 (passthrough)", () => {
    const r = run(["convert", "100", "g", "bread_flour", "--json"]);
    expect(r.code).toBe(0);
    const env = JSON.parse(r.stdout);
    expect(env._meta.subcommand).toBe("convert");
    expect(env.payload.ok).toBe(true);
    expect(env.payload.grams).toBe(100);
  });
  it("exit 64 on bad qty", () => expect(run(["convert", "abc", "g", "bread_flour"]).code).toBe(64));
  it("exit 64 on missing args", () => expect(run(["convert", "1"]).code).toBe(64));
});
