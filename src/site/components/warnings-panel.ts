import type { Store } from "../state.js";
import type { Database, Warning } from "../../core/index.js";
import { computeRecipe } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";
import { effectiveRecipe } from "../effective-recipe.js";

const ORDER: Warning["severity"][] = ["error", "warn", "info"];
const SECTION_LABEL: Record<Warning["severity"], string> = {
  error: "Errors",
  warn:  "Warnings",
  info:  "Notes",
};
const SEVERITY_ICON: Record<Warning["severity"], string> = {
  error: "✕",
  warn:  "⚠",
  info:  "ⓘ",
};

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  function render() {
    let warnings: Warning[] = [];
    try { warnings = computeRecipe(effectiveRecipe(store.getState(), db), db).warnings; } catch { /* validation upstream */ }
    if (warnings.length === 0) {
      parent.innerHTML = `<p class="warnings-empty type-body-md"><span class="warnings-empty-icon" aria-hidden="true">✓</span> No issues. Looks good.</p>`;
      return;
    }
    const groups = ORDER.map((sev) => warnings.filter((w) => w.severity === sev)).filter((g) => g.length > 0);
    parent.innerHTML = `
      <h2 class="type-heading-lg">Recipe checks</h2>
      ${groups.map((g) => `
        <h3 class="type-heading-md">${SECTION_LABEL[g[0]!.severity]}</h3>
        <ul class="warn-list">${g.map((w) => `
          <li class="warn-row warn-${w.severity}" data-related="${(w.related_uids ?? []).join(",")}">
            <span class="warn-row-icon" aria-hidden="true">${SEVERITY_ICON[w.severity]}</span>
            <span class="warn-row-message type-body-md">${escapeHtml(w.message)}</span>
          </li>`).join("")}</ul>
      `).join("")}
    `;
  }

  parent.addEventListener("click", (e) => {
    const li = (e.target as HTMLElement).closest("li.warn-row") as HTMLElement | null;
    if (!li) return;
    const uids = (li.dataset["related"] ?? "").split(",").filter(Boolean);
    for (const uid of uids) {
      const target = document.querySelector<HTMLElement>(`#recipe-table [data-uid="${uid}"]`);
      if (target) { target.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    }
  });

  store.subscribe(render); render();
}
