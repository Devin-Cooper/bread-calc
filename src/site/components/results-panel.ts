import type { Store } from "../state.js";
import type { Database, ComputedRecipe } from "../../core/index.js";
import { computeRecipe } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";
import { effectiveRecipe } from "../effective-recipe.js";

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  function fmt(n: number | null, suffix = "%") { return n == null ? "—" : `${n.toFixed(1)}${suffix}`; }
  function render() {
    const r = effectiveRecipe(store.getState(), db);
    const headline = r.headline_metric ?? "effective";
    let c: ComputedRecipe;
    try { c = computeRecipe(r, db); }
    catch (e) {
      parent.innerHTML = `<p class="error">Cannot compute: ${escapeHtml((e as Error).message)}</p>`;
      return;
    }
    const cls = (m: string) => m === headline ? "headline" : "";
    parent.innerHTML = `
      <h2>Hydration</h2>
      <dl class="metrics">
        <dt class="${cls("effective")}">Effective</dt><dd class="${cls("effective")}">${fmt(c.hydration.effective_pct)}</dd>
        <dt class="${cls("nominal")}">Nominal water</dt><dd class="${cls("nominal")}">${fmt(c.hydration.nominal_pct)}</dd>
        <dt class="${cls("total_liquid")}">Total liquid</dt><dd class="${cls("total_liquid")}">${fmt(c.hydration.total_liquid_pct)}</dd>
        <dt>Zone</dt><dd>${escapeHtml(c.hydration.zone?.label ?? "—")}</dd>
      </dl>
      <h2>Composition</h2>
      <dl class="metrics">
        <dt>Salt-equivalent</dt><dd>${fmt(c.bakers_percents.salt_equivalent_pct)}</dd>
        <dt>Sugar-equivalent</dt><dd>${fmt(c.bakers_percents.sugar_equivalent_pct)}</dd>
        <dt>Fat-equivalent</dt><dd>${fmt(c.bakers_percents.fat_equivalent_pct)}</dd>
      </dl>
      <p>Predicted loaf weight: <strong>${c.metrics.predicted_loaf_g} g</strong></p>
    `;
    parent.insertAdjacentHTML("beforeend", `
      <details>
        <summary>Where's the water? (${c.breakdowns.water.length} items)</summary>
        <table><thead><tr><th>Ingredient</th><th>g</th><th>nominal water (g)</th><th>effective water (g)</th></tr></thead>
        <tbody>${c.breakdowns.water.map((b) => `<tr><td>${escapeHtml(b.ingredient_id)}</td><td>${b.grams}</td><td>${b.contribution_g}</td><td>${b.contribution_g_effective ?? b.contribution_g}</td></tr>`).join("")}</tbody></table>
      </details>
      <details>
        <summary>Where's the salt?</summary>
        <table><tbody>${c.breakdowns.salt.filter((b) => b.contribution_g > 0).map((b) => `<tr><td>${escapeHtml(b.ingredient_id)}</td><td>${b.contribution_g} g</td></tr>`).join("")}</tbody></table>
      </details>
      <details>
        <summary>Where's the sugar?</summary>
        <table><tbody>${c.breakdowns.sugar.filter((b) => b.contribution_g > 0).map((b) => `<tr><td>${escapeHtml(b.ingredient_id)}</td><td>${b.contribution_g} g</td></tr>`).join("")}</tbody></table>
      </details>
      <details>
        <summary>Where's the fat?</summary>
        <table><tbody>${c.breakdowns.fat.filter((b) => b.contribution_g > 0).map((b) => `<tr><td>${escapeHtml(b.ingredient_id)}</td><td>${b.contribution_g} g</td></tr>`).join("")}</tbody></table>
      </details>
    `);
  }
  store.subscribe(render); render();
}
