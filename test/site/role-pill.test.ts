/// <reference types="happy-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { mount as mountPill, ROLE_OPTIONS } from "../../src/site/components/role-pill.js";

describe("role-pill", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("renders the current role as the trigger label", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    mountPill(root, { current: "flour", isDerived: false, onSelect: () => {} });
    const trigger = root.querySelector("[data-role-trigger]") as HTMLButtonElement;
    expect(trigger.textContent).toContain("flour");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("italicizes when the role is derived", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    mountPill(root, { current: "flour", isDerived: true, onSelect: () => {} });
    const trigger = root.querySelector("[data-role-trigger]") as HTMLButtonElement;
    expect(trigger.classList.contains("is-derived")).toBe(true);
  });

  it("opens the popover on click and shows all role options + a 'use inferred' option", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    mountPill(root, { current: "flour", isDerived: false, onSelect: () => {} });
    const trigger = root.querySelector("[data-role-trigger]") as HTMLButtonElement;
    trigger.click();
    const items = root.querySelectorAll("[role='option']");
    expect(items.length).toBe(ROLE_OPTIONS.length + 1);
    const last = items[items.length - 1]!;
    expect(last.textContent).toMatch(/use inferred/i);
  });

  it("invokes onSelect with the selected role", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    let received: string | null | undefined = "unset" as never;
    mountPill(root, { current: "flour", isDerived: false, onSelect: (r) => { received = r; } });
    const trigger = root.querySelector("[data-role-trigger]") as HTMLButtonElement;
    trigger.click();
    const wet = root.querySelector('[role="option"][data-role="wet"]') as HTMLElement;
    wet.click();
    expect(received).toBe("wet");
  });

  it("invokes onSelect(undefined) for the 'use inferred' option", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    let received: string | null | undefined = "unset" as never;
    mountPill(root, { current: "flour", isDerived: false, onSelect: (r) => { received = r; } });
    const trigger = root.querySelector("[data-role-trigger]") as HTMLButtonElement;
    trigger.click();
    const useInferred = root.querySelector('[role="option"][data-role=""]') as HTMLElement;
    useInferred.click();
    expect(received).toBeUndefined();
  });
});
