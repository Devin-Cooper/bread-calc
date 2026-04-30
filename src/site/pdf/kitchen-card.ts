import type { Store } from "../state.js";
import type { Database } from "../../core/index.js";
import { computeRecipe } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";
import { effectiveRecipe } from "../effective-recipe.js";
import { sortItemsForPrint } from "./load-order.js";

const PRINT_ROLE_KEY = "bread-calc:print-show-role";

function fmt(n: number | null | undefined, unit: string): string {
  return n == null ? "—" : `${unit === "%" ? n.toFixed(1) : Math.round(n)} ${unit}`;
}

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  function showRole(): boolean {
    try { return localStorage.getItem(PRINT_ROLE_KEY) === "1"; } catch { return false; }
  }

  function render(): void {
    const r = effectiveRecipe(store.getState(), db);
    let totalMass = 0, hyEff: number | null = null, zoneLabel = "—";
    let pcts: Record<string, number | null> = {};
    let solvedItems = r.items;
    try {
      const c = computeRecipe(r, db);
      totalMass = c.metrics.total_mass_g;
      hyEff = c.hydration.effective_pct;
      zoneLabel = c.hydration.zone?.label ?? "—";
      pcts = c.bakers_percents.by_uid;
      solvedItems = c.recipe.items;
    } catch { /* leave defaults */ }

    const ordered = sortItemsForPrint(solvedItems, db);
    const recipeName = store.getState().name ?? "Recipe";
    const notes = store.getState().notes ?? "";

    const includeRole = showRole();

    parent.innerHTML = `
      <header class="kc-header">
        <h1 class="kc-name">${escapeHtml(recipeName)}</h1>
        ${notes ? `<p class="kc-notes">${escapeHtml(notes)}</p>` : ""}
      </header>

      <div class="kc-metric-strip">
        <div class="kc-metric"><span class="kc-metric-label">Total dough</span><span class="kc-metric-value">${fmt(totalMass, "g")}</span></div>
        <div class="kc-metric"><span class="kc-metric-label">Hydration</span><span class="kc-metric-value">${fmt(hyEff, "%")} effective</span></div>
        <div class="kc-metric"><span class="kc-metric-label">Zone</span><span class="kc-metric-value">${escapeHtml(zoneLabel)}</span></div>
      </div>

      <table class="kc-table">
        <thead>
          <tr>
            <th class="kc-th-name">Ingredient</th>
            <th class="kc-th-num">Baker's %</th>
            ${includeRole ? `<th class="kc-th-role">Role</th>` : ""}
            <th class="kc-th-num">Grams</th>
          </tr>
        </thead>
        <tbody>
          ${ordered.map((item) => {
            const grams = item.grams ?? 0;
            const pct = pcts[item.uid] ?? null;
            return `
              <tr>
                <td class="kc-td-name">${escapeHtml(prettyName(item.ingredient_id, db))}</td>
                <td class="kc-td-num">${pct == null ? "—" : pct.toFixed(1) + " %"}</td>
                ${includeRole ? `<td class="kc-td-role">${escapeHtml(item.role ?? "—")}</td>` : ""}
                <td class="kc-td-num">${Math.round(grams)} g</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  store.subscribe(render); render();
}

function prettyName(id: string, db: Database): string {
  const f = db.flours.find((x) => x.id === id); if (f) return f.name;
  const i = db.ingredients.find((x) => x.id === id); if (i) return i.name;
  return id;
}
