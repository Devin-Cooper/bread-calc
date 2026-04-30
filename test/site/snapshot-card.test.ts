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

  // The target-weight affordance moved from snapshot-card to recipe-meta
  // (below the Size segmented control). See test/site/recipe-meta.test.ts
  // for coverage of "+ Set custom weight" / "← Stop" / inline input behavior.
});
