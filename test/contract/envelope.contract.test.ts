import { describe, it, expect } from "vitest";
import { wrap } from "../../src/core/envelope.js";
import { assertContract } from "./_helper.js";

describe("envelope contract", () => {
  it("_meta has exactly the expected keys", () => {
    const env = wrap("compute", "2.0.0-alpha.0", { test: true });
    const metaKeys = Object.keys(env._meta).sort();
    expect(metaKeys).toEqual(["output_schema_version", "subcommand", "timestamp_iso", "tool_version"]);
  });

  it("_meta.output_schema_version is '2.0'", () => {
    const env = wrap("compute", "2.0.0-alpha.0", {});
    expect(env._meta.output_schema_version).toBe("2.0");
  });

  it("_meta.timestamp_iso is a valid ISO date string", () => {
    const env = wrap("compute", "2.0.0-alpha.0", {});
    expect(() => new Date(env._meta.timestamp_iso)).not.toThrow();
    expect(new Date(env._meta.timestamp_iso).toISOString()).toBe(env._meta.timestamp_iso);
  });

  it("envelope _meta shape contract is stable", () => {
    const env = wrap("compute", "TEST", { payload_key: "payload_value" });
    assertContract("envelope_meta_shape", env);
  });
});
