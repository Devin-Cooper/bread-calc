import { describe, it, expect } from "vitest";
import { escapeXml, escapeHtml } from "../../src/core/escape.js";

describe("escapeXml", () => {
  it("escapes the five XML special characters", () => {
    expect(escapeXml("<a&b>'c\"d")).toBe("&lt;a&amp;b&gt;&apos;c&quot;d");
  });
  it("leaves benign text alone", () => {
    expect(escapeXml("hello world 123")).toBe("hello world 123");
  });
  it("preserves emoji and unicode", () => {
    expect(escapeXml("café 🍞")).toBe("café 🍞");
  });
  it("renders <script> inert", () => {
    expect(escapeXml("<script>alert(1)</script>")).not.toContain("<script>");
  });
});

describe("escapeHtml", () => {
  it("escapes the four HTML special characters", () => {
    expect(escapeHtml("<a&b>\"c")).toBe("&lt;a&amp;b&gt;&quot;c");
  });
  it("renders <script> inert", () => {
    expect(escapeHtml("<script>alert(1)</script>")).not.toContain("<script>");
  });
});
