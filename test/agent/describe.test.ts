import { describe, it, expect } from "vitest";
import { describe as describeManifest } from "../../src/agent/describe.js";

describe("describe()", () => {
  it("returns a CapabilityManifest with required top-level keys", () => {
    const m = describeManifest();
    expect(m.tool_version).toBeTypeOf("string");
    expect(m.output_schema_version).toBe("2.0");
    expect(m.privacy.network_calls).toBe(false);
    expect(Array.isArray(m.subcommands)).toBe(true);
    expect(Array.isArray(m.warnings)).toBe(true);
    expect(Array.isArray(m.fix_kinds)).toBe(true);
    expect(Array.isArray(m.explain_node_types)).toBe(true);
    expect(m.catalogs.zones.length).toBe(4);
  });

  it("warnings has exactly 24 entries (matches WarningCode union)", () => {
    const m = describeManifest();
    expect(m.warnings.length).toBe(24);
  });

  it("fix_kinds has exactly 8 entries", () => {
    const m = describeManifest();
    expect(m.fix_kinds.length).toBe(8);
  });

  it("explain_node_types has exactly 8 entries", () => {
    const m = describeManifest();
    expect(m.explain_node_types.length).toBe(8);
  });

  it("subcommands lists all 15 v2.0 subcommands", () => {
    const m = describeManifest();
    const names = m.subcommands.map((s) => s.name).sort();
    expect(names).toEqual([
      "apply", "compute", "convert", "describe", "examples", "ingredients",
      "lookup", "parse", "plot", "recommend", "reference", "schema", "solve", "validate", "verify",
    ]);
  });

  it("each subcommand has exit_codes documented", () => {
    const m = describeManifest();
    for (const s of m.subcommands) {
      expect(typeof s.exit_codes).toBe("object");
    }
  });
});
