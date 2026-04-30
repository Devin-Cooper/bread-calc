import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const BIN = "./dist/cli/bin.js";

describe("bread-calc describe", () => {
  it("emits a v2.0 manifest envelope on --json", () => {
    const out = execFileSync("node", [BIN, "describe", "--json"], { encoding: "utf8" });
    const env = JSON.parse(out);
    expect(env._meta.subcommand).toBe("describe");
    expect(env.payload.warnings.length).toBe(24);
    expect(env.payload.fix_kinds.length).toBe(8);
  });

  it("--section=warnings filters", () => {
    const out = execFileSync("node", [BIN, "describe", "--section=warnings", "--json"], { encoding: "utf8" });
    const env = JSON.parse(out);
    expect(Array.isArray(env.payload)).toBe(true);
  });
});
