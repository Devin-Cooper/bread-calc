import { describe, it } from "vitest";
import { getExamples } from "../../src/agent/examples.js";
import { wrap } from "../../src/core/envelope.js";
import { assertContract } from "./_helper.js";

describe("examples contract", () => {
  it("full getExamples() output shape is stable", () => {
    const examples = getExamples();
    const env = wrap("examples", "TEST", examples);
    assertContract("examples_full", env);
  });
});
