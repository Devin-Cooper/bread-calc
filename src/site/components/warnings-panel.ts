import type { Store } from "../state.js";
import type { Database, Warning } from "../../core/index.js";
import { computeRecipe } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";
import { effectiveRecipe } from "../effective-recipe.js";

const ORDER: Warning["severity"][] = ["error", "warn", "info"];

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  function render() {
    let warnings: Warning[] = [];
    try { warnings = computeRecipe(effectiveRecipe(store.getState(), db), db).warnings; } catch { /* validation upstream */ }
    if (warnings.length === 0) { parent.innerHTML = `<p class="placeholder">No warnings.</p>`; return; }
    const groups = ORDER.map((sev) => warnings.filter((w) => w.severity === sev)).filter((g) => g.length > 0);
    parent.innerHTML = groups.map((g) => `
      <h3>${g[0]!.severity.toUpperCase()}</h3>
      <ul class="warn-list">${g.map((w) => `
        <li class="warn-row ${w.severity}" data-related="${(w.related_uids ?? []).join(",")}">
          <strong>${escapeHtml(w.code)}</strong>: ${escapeHtml(w.message)}
        </li>`).join("")}</ul>
    `).join("");
  }

  parent.addEventListener("click", (e) => {
    const li = (e.target as HTMLElement).closest("li.warn-row") as HTMLElement | null;
    if (!li) return;
    const uids = (li.dataset["related"] ?? "").split(",").filter(Boolean);
    if (uids.length === 0) return;
    for (const uid of uids) {
      const target = document.querySelector<HTMLElement>(`#recipe-table [data-uid="${uid}"]`);
      if (target) { target.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    }
  });

  store.subscribe(render); render();
}
