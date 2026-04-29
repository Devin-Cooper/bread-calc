import type { Store } from "../state.js";
import { escapeHtml } from "../../core/escape.js";

export function mount(parent: HTMLElement, store: Store): void {
  function render() {
    const r = store.getState();
    // Focus restoration is deferred to Task 6.x — see [data-focus-key].
    // Today, every dispatch destroys the focused input; user keystrokes
    // beyond the first land on <body>. Acceptable for v0.3.0; revisit
    // when the focus-restore step lands.
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
      // grams/bakers_pct are typed `number | undefined`. The raw template
      // interpolation below is XSS-safe today because numbers stringify
      // to digits/decimals only. If the type ever widens to `string`,
      // wrap value-rendering in escapeHtml.
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
    // parseFloat(t.value) || 0: an empty/non-numeric input commits 0g rather
    // than `undefined`. Intentional — items default to 0g on add, and clearing
    // the field is interpreted as "this ingredient is in the recipe at 0g
    // (deletable via the remove button)" rather than "leave grams unset".
    if (field === "grams") store.dispatch({ type: "set_grams", index: idx, grams: parseFloat(t.value) || 0 });
    else if (field === "bakers_pct") store.dispatch({ type: "set_bakers_pct", index: idx, bakers_pct: parseFloat(t.value) || 0 });
  });
  parent.addEventListener("click", (e) => {
    // Use closest() so clicks on icon-children (e.g. a future <span> inside
    // the button) still dispatch correctly. Matches the pattern Task 3.5's
    // ingredient-picker uses.
    const button = (e.target as HTMLElement).closest<HTMLElement>("[data-action='remove']");
    if (!button) return;
    const idx = Number(button.dataset["index"]);
    if (Number.isNaN(idx)) return;
    store.dispatch({ type: "remove_item", index: idx });
  });

  store.subscribe(render);
  render();
}
