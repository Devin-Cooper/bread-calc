import type { Store } from "../state.js";
import type { Database } from "../../core/index.js";
import { computeRecipe } from "../../core/index.js";
import { effectiveRecipe } from "../effective-recipe.js";
import { attachTooltip } from "./tooltip.js";

export interface SnapshotProps {
  onOpenSettings: () => void;
}

export function mount(parent: HTMLElement, store: Store, db: Database, props: SnapshotProps): void {
  let editingTarget = false;

  function fmtPct(n: number | null | undefined): string {
    return n == null ? "—" : `${n.toFixed(1)} %`;
  }
  function fmtG(n: number | null | undefined): string {
    return n == null ? "—" : `${Math.round(n)} g`;
  }

  function render(): void {
    const r = effectiveRecipe(store.getState(), db);
    const headlineMetric = r.headline_metric ?? "effective";
    const inTargetMode = store.getState().target_loaf_g != null;

    let hyEffective: number | null = null;
    let hyNominal: number | null = null;
    let hyTotalLiquid: number | null = null;
    let predictedG: number | null = null;
    let totalMass: number | null = null;
    let saltPct: number | null = null;
    let sugarPct: number | null = null;
    let fatPct: number | null = null;

    try {
      const c = computeRecipe(r, db);
      hyEffective = c.hydration.effective_pct;
      hyNominal = c.hydration.nominal_pct;
      hyTotalLiquid = c.hydration.total_liquid_pct;
      predictedG = c.metrics.predicted_loaf_g;
      totalMass = c.metrics.total_mass_g;
      saltPct = c.bakers_percents.salt_equivalent_pct;
      sugarPct = c.bakers_percents.sugar_equivalent_pct;
      fatPct = c.bakers_percents.fat_equivalent_pct;
    } catch { /* leave nulls */ }

    const headlineHy = headlineMetric === "nominal" ? hyNominal
                     : headlineMetric === "total_liquid" ? hyTotalLiquid
                     : hyEffective;
    const headlineLabel = headlineMetric === "nominal" ? "Nominal hydration"
                        : headlineMetric === "total_liquid" ? "Total liquid"
                        : "Effective hydration";

    // Secondary row: include the two hydration variants NOT chosen as headline,
    // followed by salt/sugar/fat. All 5 always rendered; flex-wraps on narrow viewports.
    const secondary: Array<{ label: string; value: number | null; helpKey: string }> = [];
    if (headlineMetric !== "effective")    secondary.push({ label: "Effective",    value: hyEffective,  helpKey: "effective" });
    if (headlineMetric !== "nominal")      secondary.push({ label: "Nominal",      value: hyNominal,    helpKey: "nominal-hydration" });
    if (headlineMetric !== "total_liquid") secondary.push({ label: "Total liquid", value: hyTotalLiquid, helpKey: "total-liquid" });
    secondary.push({ label: "Salt",  value: saltPct,  helpKey: "bakers-percent" });
    secondary.push({ label: "Sugar", value: sugarPct, helpKey: "bakers-percent" });
    secondary.push({ label: "Fat",   value: fatPct,   helpKey: "bakers-percent" });

    parent.innerHTML = `
      <header class="snapshot-header">
        <span class="mode-badge type-body-sm">${inTargetMode ? "Build by target weight" : "Build by ingredients"}</span>
        <button type="button" class="snapshot-gear" data-action="open-settings" aria-label="Open settings">⚙</button>
      </header>

      <div class="snapshot-headline">
        <div class="snapshot-stat is-headline">
          <span class="snapshot-stat-label type-body-sm">${headlineLabel}<button type="button" class="help-icon" data-help="${headlineMetric}" aria-label="Explain ${headlineLabel}">?</button></span>
          <span class="type-numeric-display snapshot-stat-value snapshot-stat-headline">${fmtPct(headlineHy)}</span>
        </div>
        <div class="snapshot-stat">
          <span class="snapshot-stat-label type-body-sm">Predicted loaf weight</span>
          <span class="type-numeric-display snapshot-stat-value">${fmtG(predictedG)}</span>
          ${renderTargetAffordance(inTargetMode)}
        </div>
        <div class="snapshot-stat">
          <span class="snapshot-stat-label type-body-sm">Total dough weight</span>
          <span class="type-numeric-display snapshot-stat-value">${fmtG(totalMass)}</span>
        </div>
      </div>

      <div class="snapshot-secondary">
        ${secondary.map((s) => renderSecondary(s.label, s.value, s.helpKey)).join("")}
      </div>
    `;

    parent.querySelector<HTMLButtonElement>("[data-action='open-settings']")?.addEventListener("click", () => {
      props.onOpenSettings();
    });

    parent.querySelector<HTMLButtonElement>("[data-action='set-target']")?.addEventListener("click", () => {
      editingTarget = true;
      render();
      parent.querySelector<HTMLInputElement>("[data-action='target-input']")?.focus();
    });

    parent.querySelector<HTMLButtonElement>("[data-action='clear-target']")?.addEventListener("click", () => {
      editingTarget = false;
      store.dispatch({ type: "set_target_loaf_g", grams: undefined });
    });

    parent.querySelector<HTMLInputElement>("[data-action='target-input']")?.addEventListener("input", (e) => {
      const n = parseFloat((e.target as HTMLInputElement).value);
      if (Number.isFinite(n) && n > 0) {
        store.dispatch({ type: "set_target_loaf_g", grams: n });
      }
    });

    // Wire help-icon tooltips
    parent.querySelectorAll<HTMLElement>("[data-help]").forEach((btn) => {
      const key = btn.dataset["help"]!;
      attachTooltip(btn, { content: tooltipText(key) });
    });
  }

  function renderTargetAffordance(inTargetMode: boolean): string {
    if (inTargetMode) {
      return `<button type="button" class="snapshot-target-link type-body-sm" data-action="clear-target">← Stop using target weight</button>`;
    }
    if (editingTarget) {
      const v = store.getState().target_loaf_g ?? 900;
      return `<input type="text" class="snapshot-target-input" data-action="target-input"
                inputmode="decimal" pattern="[0-9]*\\.?[0-9]*" value="${v}"
                aria-label="Target loaf weight in grams" />`;
    }
    return `<button type="button" class="snapshot-target-link type-body-sm" data-action="set-target">+ Set target weight</button>`;
  }

  function renderSecondary(label: string, value: number | null, helpKey: string): string {
    return `
      <div class="snapshot-secondary-stat">
        <span class="snapshot-stat-label type-body-sm">${label}<button type="button" class="help-icon" data-help="${helpKey}" aria-label="Explain ${label}">?</button></span>
        <span class="type-numeric-md snapshot-stat-value">${value == null ? "—" : `${value.toFixed(1)} %`}</span>
      </div>
    `;
  }

  store.subscribe(render);
  render();
}

function tooltipText(key: string): string {
  switch (key) {
    case "effective":
      return `Effective hydration counts water from every ingredient, not just plain water. <a href="/learn.html#effective-hydration">Read more</a>`;
    case "nominal":
    case "nominal-hydration":
      return `The simple water ÷ flour view. Water-only, ignores hidden water from milk, eggs, etc. <a href="/learn.html#nominal-hydration">Read more</a>`;
    case "total_liquid":
    case "total-liquid":
      return `The broadest read: every liquid ingredient counted, not just water. <a href="/learn.html#total-liquid">Read more</a>`;
    case "bakers-percent":
      return `Each ingredient as a percentage of total flour weight. <a href="/learn.html#bakers-percent">Read more</a>`;
  }
  return "";
}
