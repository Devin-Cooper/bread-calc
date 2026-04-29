import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { wrap, type OutputEnvelope, type Meta } from "../../src/core/envelope.js";

describe("envelope wrap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:00:00.000Z"));
  });
  afterEach(() => { vi.useRealTimers(); });

  it("wraps a payload with _meta", () => {
    const env: OutputEnvelope<{ a: number }> = wrap("compute", "1.2.3", { a: 1 });
    expect(env.payload).toEqual({ a: 1 });
    expect(env._meta.subcommand).toBe("compute");
    expect(env._meta.tool_version).toBe("1.2.3");
    expect(env._meta.output_schema_version).toBe("2.0");
    expect(env._meta.timestamp_iso).toBe("2026-04-29T12:00:00.000Z");
  });

  it("Meta type is correctly typed", () => {
    const meta: Meta = {
      tool_version: "x",
      output_schema_version: "2.0",
      subcommand: "compute",
      timestamp_iso: "2026-04-29T12:00:00.000Z",
    };
    expect(meta.output_schema_version).toBe("2.0");
  });
});
