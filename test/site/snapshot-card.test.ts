/// <reference types="happy-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { mount as mountSnapshot } from "../../src/site/components/snapshot-card.js";
import { createStore } from "../../src/site/state.js";
import type { Database } from "../../src/core/index.js";

const db = { ingredients: [], flours: [], references: [], machines: [], defaults: { default_machine_id: "m" } } as unknown as Database;

describe("snapshot-card", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("renders without crashing on an empty recipe", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [] });
    mountSnapshot(root, store, db, { onOpenSettings: () => {} });
    // Empty recipe yields an "—" placeholder for the headline numbers
    expect(root.textContent).toContain("—");
  });

  it("renders gear button with onOpenSettings callback", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [] });
    let opened = 0;
    mountSnapshot(root, store, db, { onOpenSettings: () => { opened++; } });
    const gear = root.querySelector("[data-action='open-settings']") as HTMLButtonElement;
    gear.click();
    expect(opened).toBe(1);
  });

  it("dispatches set_target_loaf_g when '+ Set target weight' is clicked then submitted", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", items: [] });
    mountSnapshot(root, store, db, { onOpenSettings: () => {} });
    const trigger = root.querySelector("[data-action='set-target']") as HTMLButtonElement;
    trigger.click();
    const input = root.querySelector("input[data-action='target-input']") as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = "950";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(store.getState().target_loaf_g).toBe(950);
  });

  it("dispatches set_target_loaf_g(undefined) when '← Stop using target weight' clicked", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    const store = createStore({ schema_version: "2.0", target_loaf_g: 900, items: [] });
    mountSnapshot(root, store, db, { onOpenSettings: () => {} });
    const stopBtn = root.querySelector("[data-action='clear-target']") as HTMLButtonElement;
    stopBtn.click();
    expect("target_loaf_g" in store.getState()).toBe(false);
  });
});
