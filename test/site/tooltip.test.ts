/// <reference types="happy-dom" />
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { attachTooltip, closeAllTooltips } from "../../src/site/components/tooltip.js";

describe("tooltip", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });
  afterEach(() => {
    closeAllTooltips();
    vi.useRealTimers();
  });

  it("attaches and shows on focus", () => {
    const btn = document.createElement("button"); document.body.appendChild(btn);
    attachTooltip(btn, { content: "hello world" });
    btn.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    vi.advanceTimersByTime(250);
    const t = document.querySelector("[role='tooltip']");
    expect(t?.textContent).toContain("hello world");
  });

  it("closes on Escape", () => {
    const btn = document.createElement("button"); document.body.appendChild(btn);
    attachTooltip(btn, { content: "x" });
    btn.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    vi.advanceTimersByTime(250);
    expect(document.querySelector("[role='tooltip']")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector("[role='tooltip']")).toBeNull();
  });

  it("renders an HTML link in content (Read more)", () => {
    const btn = document.createElement("button"); document.body.appendChild(btn);
    attachTooltip(btn, { content: 'foo <a href="/learn#x">Read more</a>' });
    btn.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    vi.advanceTimersByTime(250);
    const link = document.querySelector("[role='tooltip'] a") as HTMLAnchorElement | null;
    expect(link?.getAttribute("href")).toBe("/learn#x");
  });

  it("only one tooltip open at a time", () => {
    const a = document.createElement("button"); a.id = "a"; document.body.appendChild(a);
    const b = document.createElement("button"); b.id = "b"; document.body.appendChild(b);
    attachTooltip(a, { content: "A" });
    attachTooltip(b, { content: "B" });
    a.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    vi.advanceTimersByTime(250);
    b.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    vi.advanceTimersByTime(250);
    const tips = document.querySelectorAll("[role='tooltip']");
    expect(tips.length).toBe(1);
    expect(tips[0]!.textContent).toContain("B");
  });
});
