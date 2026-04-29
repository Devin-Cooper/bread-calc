import type { ComputedRecipe, Database } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";

export function mount(parent: HTMLElement, computed: ComputedRecipe, db: Database): void {
  const refs = db.references.filter((r) => !r.excluded_from_chart);
  parent.innerHTML = `
    <table class="chart-table">
      <thead><tr><th>Recipe</th><th>Course</th><th>Flour (g)</th><th>Water (g)</th><th>Hydration</th><th>Zone</th></tr></thead>
      <tbody>
        ${computed.totals.total_flour_g > 0 ? `<tr class="user-row"><td><strong>${escapeHtml(computed.recipe.name ?? "Your recipe")}</strong></td><td>—</td><td>${computed.totals.total_flour_g}</td><td>${computed.totals.total_water_g_nominal}</td><td>${(computed.hydration.nominal_pct ?? 0).toFixed(1)}%</td><td>${escapeHtml(computed.hydration.zone ?? "—")}</td></tr>` : ""}
        ${refs.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.course)}</td><td>${r.total_flour_g}</td><td>${r.total_water_g}</td><td>${r.hydration_pct_nominal}%</td><td>${escapeHtml(r.zone)}</td></tr>`).join("")}
      </tbody>
    </table>`;
}
