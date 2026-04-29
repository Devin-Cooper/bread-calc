import type { Store } from "../state.js";
import type { Database, ComputedRecipe } from "../../core/index.js";
import { computeRecipe } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  function fmt(n: number | null, suffix = "%") { return n == null ? "—" : `${n.toFixed(1)}${suffix}`; }
  function render() {
    const r = store.getState();
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
        <dt>Zone</dt><dd>${escapeHtml(c.hydration.zone ?? "—")}</dd>
      </dl>
      <h2>Composition</h2>
      <dl class="metrics">
        <dt>Salt-equivalent</dt><dd>${fmt(c.bakers_pcts.salt_equivalent_pct)}</dd>
        <dt>Sugar-equivalent</dt><dd>${fmt(c.bakers_pcts.sugar_equivalent_pct)}</dd>
        <dt>Fat-equivalent</dt><dd>${fmt(c.bakers_pcts.fat_equivalent_pct)}</dd>
      </dl>
      <p>Predicted loaf weight: <strong>${c.totals.predicted_loaf_g} g</strong></p>
    `;
  }
  store.subscribe(render); render();
}
