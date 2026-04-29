import type { Database, Recipe } from "../core/index.js";
import { createStore } from "./state.js";
import { mount as mountPicker } from "./components/ingredient-picker.js";
import { mount as mountTable } from "./components/recipe-table.js";
import { mount as mountResults } from "./components/results-panel.js";
import { mount as mountWarnings } from "./components/warnings-panel.js";
import { mount as mountChart } from "./components/chart-card.js";
import { mount as mountMode } from "./components/mode-toggle.js";
import { mount as mountHeadline } from "./components/headline-toggle.js";
import { encodeRecipeHash, decodeRecipeHash } from "./persistence/url-hash.js";
import { saveRecipeAsFile, readRecipeFile } from "./persistence/file-io.js";

import ingredientsFile from "../data/ingredients.json" with { type: "json" };
import floursFile from "../data/flours.json" with { type: "json" };
import refsFile from "../data/bb_pdc20_recipes.json" with { type: "json" };
import machinesFile from "../data/machines.json" with { type: "json" };
import defaultsRaw from "../data/defaults.json" with { type: "json" };

/* eslint-disable @typescript-eslint/no-explicit-any */
// Bundle-time JSON imports lose their declared shape; the cast is intentional and
// the data is schema-validated at compile-time by scripts/transform-data.mjs.
const db: Database = {
  ingredients: (ingredientsFile as any).entries,
  flours:      (floursFile as any).entries,
  references:  (refsFile as any).entries,
  machines:    (machinesFile as any).entries,
  defaults:    defaultsRaw as any,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const STARTER: Recipe = {
  schema_version: "1.0", name: "Classic White (BB-PDC20)", machine: "zojirushi_bb_pdc20",
  items: [
    { ingredient_id: "bread_flour", grams: 553 },
    { ingredient_id: "water_tap", grams: 326 },
    { ingredient_id: "sugar_granulated", grams: 30 },
    { ingredient_id: "salt_table", grams: 9 },
    { ingredient_id: "butter_unsalted", grams: 28 },
    { ingredient_id: "yeast_instant", grams: 5 },
  ],
};

async function loadInitialRecipe(): Promise<Recipe> {
  const hash = location.hash;
  if (hash.startsWith("#r=")) {
    try { return await decodeRecipeHash(hash.slice(3)); } catch { /* fall through */ }
  }
  try {
    const saved = localStorage.getItem("bread-calc:autosave");
    if (saved) return JSON.parse(saved) as Recipe;
  } catch { /* ignore */ }
  return STARTER;
}

(async () => {
  const initial = await loadInitialRecipe();
  const store = createStore(initial);

  mountPicker(document.querySelector("#ingredient-picker") as HTMLElement, store, db);
  mountTable(document.querySelector("#recipe-table") as HTMLElement, store);
  mountResults(document.querySelector("#results-panel") as HTMLElement, store, db);
  mountWarnings(document.querySelector("#warnings-panel") as HTMLElement, store, db);
  mountChart(document.querySelector("#chart-card") as HTMLElement, store, db);
  mountMode(document.querySelector("#mode-toggle") as HTMLSelectElement, store);
  mountHeadline(document.querySelector("#headline-toggle") as HTMLSelectElement, store);

  const actionBar = document.querySelector("#action-bar") as HTMLElement;
  actionBar.innerHTML = `
    <button id="btn-save">Save .bread.json</button>
    <button id="btn-load">Open recipe…</button>
    <input type="file" id="file-input" accept=".bread.json,application/json" hidden />
    <button id="btn-share">Copy share URL</button>
    <button id="btn-pdf">Export PDF</button>
  `;
  const fileInput = document.querySelector("#file-input") as HTMLInputElement;
  (document.querySelector("#btn-save") as HTMLButtonElement).addEventListener("click", () => {
    saveRecipeAsFile(store.getState(), store.getState().name ?? "recipe");
  });
  (document.querySelector("#btn-load") as HTMLButtonElement).addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    try {
      store.dispatch({ type: "load", recipe: await readRecipeFile(f) });
    } catch (e) {
      alert(`Could not load recipe: ${(e as Error).message}`);
    }
    fileInput.value = "";
  });
  (document.querySelector("#btn-share") as HTMLButtonElement).addEventListener("click", async () => {
    await navigator.clipboard.writeText(location.href);
  });
  (document.querySelector("#btn-pdf") as HTMLButtonElement).addEventListener("click", () => window.print());

  let timer: number | undefined;
  store.subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const r = store.getState();
      try { localStorage.setItem("bread-calc:autosave", JSON.stringify(r)); } catch { /* ignore quota */ }
      try { history.replaceState(null, "", `#r=${await encodeRecipeHash(r)}`); } catch { /* ignore */ }
    }, 300) as unknown as number;
  });
})();
