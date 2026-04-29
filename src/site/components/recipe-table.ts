import type { Store } from "../state.js";
import { escapeHtml } from "../../core/escape.js";

export function mount(parent: HTMLElement, store: Store): void {
  function render() {
    const r = store.getState();
    parent.innerHTML = "";
    if (r.items.length === 0) {
      parent.innerHTML = `<p class="placeholder">No ingredients yet — use the picker above to add some.</p>`;
      return;
    }
    for (let i = 0; i < r.items.length; i++) {
      const item = r.items[i]!;
      const row = document.createElement("div");
      row.setAttribute("role", "row");
      row.dataset["focusKey"] = `row-${i}`;
      row.innerHTML = `
        <span role="cell">${escapeHtml(item.ingredient_id)}</span>
        <input role="cell" type="number" inputmode="decimal" step="0.1" min="0"
               data-field="grams" data-index="${i}" value="${item.grams ?? ""}"
               aria-label="grams for ${escapeHtml(item.ingredient_id)}" />
        <input role="cell" type="number" inputmode="decimal" step="0.1" min="0"
               data-field="bakers_pct" data-index="${i}" value="${item.bakers_pct ?? ""}"
               aria-label="bakers percent for ${escapeHtml(item.ingredient_id)}" />
        <span role="cell">${escapeHtml(item.role ?? "")}</span>
        <button role="cell" data-action="remove" data-index="${i}" aria-label="remove ${escapeHtml(item.ingredient_id)}">✕</button>
      `;
      parent.appendChild(row);
    }
  }

  parent.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    const idx = Number(t.dataset["index"]);
    const field = t.dataset["field"];
    if (field === "grams") store.dispatch({ type: "set_grams", index: idx, grams: parseFloat(t.value) || 0 });
    else if (field === "bakers_pct") store.dispatch({ type: "set_bakers_pct", index: idx, bakers_pct: parseFloat(t.value) || 0 });
  });
  parent.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset["action"] === "remove") {
      const idx = Number(t.dataset["index"]);
      store.dispatch({ type: "remove_item", index: idx });
    }
  });

  store.subscribe(render);
  render();
}
