import type { Database, Recipe } from "../core/index.js";
import { generateUid } from "../core/uid.js";
import { createStore } from "./state.js";
import { mount as mountPicker } from "./components/ingredient-picker.js";
import { mount as mountTable } from "./components/recipe-table.js";
import { mount as mountResults } from "./components/results-panel.js";
import { mount as mountWarnings } from "./components/warnings-panel.js";
import { mount as mountMeta } from "./components/recipe-meta.js";
import { encodeRecipeHash, decodeRecipeHash } from "./persistence/url-hash.js";
import { mount as mountHeader, type HeaderActionId } from "./components/header.js";
import { mount as mountTipStrip } from "./components/tip-strip.js";
import { mount as mountDrawer, applyTheme } from "./components/settings-drawer.js";
import { mount as mountHeadline } from "./components/recipe-headline.js";
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
  schema_version: "2.0", name: "Classic White (BB-PDC20)", machine: "zojirushi_bb_pdc20",
  items: [
    { uid: generateUid(), ingredient_id: "bread_flour",      grams: 553 },
    { uid: generateUid(), ingredient_id: "water_tap",        grams: 326 },
    { uid: generateUid(), ingredient_id: "sugar_granulated", grams: 30  },
    { uid: generateUid(), ingredient_id: "salt_table",       grams: 9   },
    { uid: generateUid(), ingredient_id: "butter_unsalted",  grams: 28  },
    { uid: generateUid(), ingredient_id: "yeast_instant",    grams: 5   },
  ],
};

async function loadInitialRecipe(): Promise<Recipe> {
  const hash = location.hash;
  if (hash.startsWith("#r=")) {
    try {
      const decoded = await decodeRecipeHash(hash.slice(3));
      if (decoded.schema_version === "2.0") return decoded;
    } catch { /* fall through */ }
  }
  try {
    const saved = localStorage.getItem("bread-calc:autosave");
    if (saved) {
      const parsed = JSON.parse(saved) as Recipe;
      if (parsed.schema_version === "2.0") return parsed;
      // v1 saved state — drop it explicitly so it doesn't linger.
      try { localStorage.removeItem("bread-calc:autosave"); } catch { /* ignore quota errors */ }
    }
  } catch { /* ignore */ }
  return STARTER;
}

(async () => {
  applyTheme();
  const initial = await loadInitialRecipe();
  const store = createStore(initial);

  // Header + actions
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".bread.json,application/json";
  fileInput.hidden = true;
  document.body.appendChild(fileInput);

  fileInput.addEventListener("change", async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    try {
      const recipe = await readRecipeFile(f);
      if (recipe.schema_version !== "2.0") {
        alert("This file uses an older recipe format. breadmachine.io now requires v2.0 recipes.");
      } else {
        store.dispatch({ type: "load", recipe });
      }
    } catch (e) {
      alert(`Could not load recipe: ${(e as Error).message}`);
    }
    fileInput.value = "";
  });

  function handleHeaderAction(id: HeaderActionId): void {
    if (id === "save") saveRecipeAsFile(store.getState(), store.getState().name ?? "recipe");
    else if (id === "open") fileInput.click();
    else if (id === "share") void navigator.clipboard.writeText(location.href);
    else if (id === "pdf") window.print();
    else if (id === "settings") drawerCtl.open();
  }
  mountHeader(document.querySelector("#site-header") as HTMLElement, { onAction: handleHeaderAction });
  mountTipStrip(document.querySelector("#tip-strip") as HTMLElement);
  const drawerCtl = mountDrawer(document.querySelector("#settings-drawer") as HTMLDialogElement, store);

  mountHeadline(document.querySelector("#recipe-headline") as HTMLElement, store);
  mountMeta(document.querySelector("#recipe-meta") as HTMLElement, store);
  mountPicker(document.querySelector("#ingredient-picker") as HTMLElement, store, db);
  mountTable(document.querySelector("#recipe-table") as HTMLElement, store, db);
  mountResults(document.querySelector("#snapshot-card") as HTMLElement, store, db);
  mountWarnings(document.querySelector("#warnings-panel") as HTMLElement, store, db);

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
