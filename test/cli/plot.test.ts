import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, unlinkSync } from "node:fs";

const BIN = "./dist/cli/bin.js";

function run(args: string[], opts: { input?: string } = {}): { code: number; stdout: string } {
  try {
    return {
      code: 0,
      stdout: execFileSync(BIN, args, { input: opts.input, stdio: ["pipe", "pipe", "pipe"] }).toString(),
    };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: Buffer };
    return { code: err.status ?? 1, stdout: err.stdout?.toString() ?? "" };
  }
}

describe("bread-calc plot", () => {
  it("emits SVG to stdout", () => {
    const r = run(["plot", "test/golden/fixtures/classic_white.bread.json"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^<svg /);
  });

  it("writes SVG to --out file", () => {
    const out = "/tmp/bread-calc-plot.svg";
    if (existsSync(out)) unlinkSync(out);
    const r = run(["plot", "test/golden/fixtures/classic_white.bread.json", `--out=${out}`]);
    expect(r.code).toBe(0);
    expect(readFileSync(out, "utf8")).toMatch(/^<svg /);
  });
});
