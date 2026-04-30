/// <reference types="happy-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { mount as mountHeader } from "../../src/site/components/header.js";

describe("header", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("renders wordmark and Learn link", () => {
    const root = document.createElement("header"); document.body.appendChild(root);
    mountHeader(root, { onAction: () => {} });
    expect(root.textContent).toContain("breadmachine.io");
    expect(root.querySelector("a[href='/learn.html']")).not.toBeNull();
  });

  it("renders an overflow menu button", () => {
    const root = document.createElement("header"); document.body.appendChild(root);
    mountHeader(root, { onAction: () => {} });
    const trigger = root.querySelector("button[data-action='overflow']") as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens the overflow menu on click", () => {
    const root = document.createElement("header"); document.body.appendChild(root);
    mountHeader(root, { onAction: () => {} });
    const trigger = root.querySelector("button[data-action='overflow']") as HTMLButtonElement;
    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(root.querySelector("[role='menu']")).not.toBeNull();
  });

  it("invokes onAction with the action id", () => {
    const root = document.createElement("header"); document.body.appendChild(root);
    let received: string | null = null;
    mountHeader(root, { onAction: (id) => { received = id; } });
    const trigger = root.querySelector("button[data-action='overflow']") as HTMLButtonElement;
    trigger.click();
    const saveItem = root.querySelector("[role='menuitem'][data-id='save']") as HTMLButtonElement;
    saveItem.click();
    expect(received).toBe("save");
  });
});
