/// <reference types="happy-dom" />
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mount as mountTipStrip } from "../../src/site/components/tip-strip.js";

// Node 22+ exposes a bare localStorage global that has no methods when
// --localstorage-file is not given a valid path. Stub it with a real
// in-memory implementation so tests that call setItem/getItem/removeItem work.
function makeLocalStorageStub(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() { return Object.keys(store).length; },
    key(i: number) { return Object.keys(store)[i] ?? null; },
    getItem(k: string) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k]! : null; },
    setItem(k: string, v: string) { store[k] = String(v); },
    removeItem(k: string) { delete store[k]; },
    clear() { store = {}; },
  } as Storage;
}

describe("tip-strip", () => {
  let ls: Storage;

  beforeEach(() => {
    ls = makeLocalStorageStub();
    vi.stubGlobal("localStorage", ls);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders when not dismissed", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    mountTipStrip(root);
    expect(root.textContent).toMatch(/Edit any cell/);
    expect(root.querySelector("button[data-action='dismiss']")).not.toBeNull();
  });

  it("does not render when localStorage flag is set", () => {
    localStorage.setItem("bread-calc:tip-dismissed", "1");
    const root = document.createElement("div"); document.body.appendChild(root);
    mountTipStrip(root);
    expect(root.textContent).toBe("");
  });

  it("sets the localStorage flag on dismiss click", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    mountTipStrip(root);
    const btn = root.querySelector("button[data-action='dismiss']") as HTMLButtonElement;
    btn.click();
    expect(localStorage.getItem("bread-calc:tip-dismissed")).toBe("1");
  });

  it("removes its content after dismiss", () => {
    const root = document.createElement("div"); document.body.appendChild(root);
    mountTipStrip(root);
    const btn = root.querySelector("button[data-action='dismiss']") as HTMLButtonElement;
    btn.click();
    expect(root.querySelector("button[data-action='dismiss']")).toBeNull();
  });
});
