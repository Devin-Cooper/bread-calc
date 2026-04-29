import type { Store } from "../state.js";
import { escapeHtml } from "../../core/escape.js";

export function mount(parent: HTMLElement, store: Store): void {
  function render() {
    const r = store.getState();
    // Focus restoration: capture active element BEFORE clearing,
    // restore at end of render() if the focused element was inside a row.
    const active = document.activeElement as HTMLElement | null;
    const activeKey = active?.closest("[data-focus-key]")?.getAttribute("data-focus-key");
    const cursorPos = active instanceof HTMLInputElement ? active.selectionStart : null;
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
    if (activeKey) {
      const restored = parent.querySelector(`[data-focus-key="${activeKey}"]`) as HTMLElement | null;
      if (restored) {
        // Prefer focusing an inner input (the typical case during editing);
        // fall back to the row itself if no input survived (e.g. focus was
        // on the remove button — rare, but harmless).
        const input = restored.querySelector("input") as HTMLInputElement | null;
        (input ?? restored).focus();
        if (input && cursorPos != null) input.setSelectionRange(cursorPos, cursorPos);
      }
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
