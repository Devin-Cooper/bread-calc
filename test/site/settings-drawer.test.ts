/// <reference types="happy-dom" />
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount as mountDrawer } from "../../src/site/components/settings-drawer.js";
import { createStore } from "../../src/site/state.js";

// Reuse the in-memory localStorage stub pattern from tip-strip.test.ts
function makeMemStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
  } as Storage;
}

describe("settings-drawer", () => {
  beforeEach(() => {
    document.body.innerHTML = "<dialog id='d'></dialog>";
    vi.stubGlobal("localStorage", makeMemStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens via the controller open()", () => {
    const dialog = document.querySelector("#d") as HTMLDialogElement;
    const store = createStore({ schema_version: "2.0", items: [] });
    const ctl = mountDrawer(dialog, store);
    ctl.open();
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("closes via close button", () => {
    const dialog = document.querySelector("#d") as HTMLDialogElement;
    const store = createStore({ schema_version: "2.0", items: [] });
    const ctl = mountDrawer(dialog, store);
    ctl.open();
    const close = dialog.querySelector("[data-action='close']") as HTMLButtonElement;
    close.click();
    expect(dialog.hasAttribute("open")).toBe(false);
  });

  it("renders three controls: Theme, Headline metric, Print: include Role", () => {
    const dialog = document.querySelector("#d") as HTMLDialogElement;
    const store = createStore({ schema_version: "2.0", items: [] });
    const ctl = mountDrawer(dialog, store);
    ctl.open();
    expect(dialog.querySelector("[data-control='theme']")).not.toBeNull();
    expect(dialog.querySelector("[data-control='headline-metric']")).not.toBeNull();
    expect(dialog.querySelector("[data-control='print-show-role']")).not.toBeNull();
  });
});
