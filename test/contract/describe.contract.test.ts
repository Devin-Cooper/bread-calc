import { describe, it } from "vitest";
import { describe as describeAPI } from "../../src/agent/describe.js";
import { wrap } from "../../src/core/envelope.js";
import { assertContract } from "./_helper.js";

describe("describe contract", () => {
  it("full describe() output shape is stable", () => {
    const manifest = describeAPI();
    const env = wrap("describe", "TEST", manifest);
    assertContract("describe_full", env);
  });
});
