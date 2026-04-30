import type { Database } from "../../core/index.js";
import type { Store } from "../state.js";
import { computeRecipe, inferRole } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";
import { effectiveRecipe } from "../effective-recipe.js";
import { mount as mountRolePill, type Role } from "./role-pill.js";
import { attachTooltip } from "./tooltip.js";

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  function render() {
    const state = store.getState();
    const targetMode = state.target_loaf_g != null;
    // In target mode, show the solver's grams as a hint but keep the user's
    // raw inputs editable; in ingredients mode, the raw recipe IS the source.
    const solved = targetMode ? effectiveRecipe(state, db) : state;
    // Derive bakers_pct + role for items that don't have them set, so the
    // columns aren't blank for hand-entered grams-only recipes. The user can
    // still type a baker's % to override the derived value.
    let derivedPcts: Record<string, number | null> = {};
    try {
      const computed = computeRecipe(solved, db);
      for (const item of solved.items) {
        derivedPcts[item.uid] = computed.bakers_percents.by_uid[item.uid] ?? null;
      }
    }
    catch { /* invalid recipe — leave derived empty */ }
    const lookupCategoryAndLiquid = (ingredient_id: string): { category: string; isLiquid: boolean } | null => {
      const flour = db.flours.find((f) => f.id === ingredient_id);
      if (flour) return { category: "flour", isLiquid: false };
      const ing = db.ingredients.find((i) => i.id === ingredient_id);
      if (ing) return { category: ing.category, isLiquid: ing.is_liquid ?? false };
      return null;
    };
    // Focus restoration: capture active element BEFORE clearing.
    // We capture three things so the restore lands on the SAME input the user
    // was typing in (grams vs. bakers_pct) and preserves their work-in-progress
    // string verbatim — important for decimals like "1." where the parsed
    // float is "1" and the round-trip would otherwise eat the trailing dot.
    const active = document.activeElement as HTMLElement | null;
    const activeKey = active?.closest("[data-focus-key]")?.getAttribute("data-focus-key");
    const activeField = active instanceof HTMLInputElement ? active.dataset["field"] ?? null : null;
    const activeRawValue = active instanceof HTMLInputElement ? active.value : null;
    const cursorPos = active instanceof HTMLInputElement ? active.selectionStart : null;
    parent.innerHTML = "";
    if (state.items.length === 0) {
      parent.innerHTML = `<p class="placeholder">No ingredients yet — use the picker above to add some.</p>`;
      return;
    }
    const header = document.createElement("div");
    header.className = "row-header";
    header.setAttribute("role", "row");
    const gramsHeader = targetMode ? "Solved g" : "Grams";
    header.innerHTML = `<span role="columnheader">Ingredient</span><span role="columnheader">${gramsHeader}</span><span role="columnheader">Baker's %<button type="button" class="help-icon" data-help="bakers-percent-col" aria-label="Explain Baker's percent">?</button></span><span role="columnheader">Role<button type="button" class="help-icon" data-help="role-col" aria-label="Explain Role">?</button></span><span role="columnheader" aria-label="actions"></span>`;
    parent.appendChild(header);
    parent.querySelectorAll<HTMLElement>(".row-header [data-help]").forEach((btn) => {
      const key = btn.dataset["help"]!;
      const content = key === "bakers-percent-col"
        ? `Each ingredient as a percentage of total flour weight. <a href="/learn.html#bakers-percent">Read more</a>`
        : `The category an ingredient belongs to (flour, wet, salt, etc.). Used to compute hydration and to order ingredients in the printed kitchen card. <a href="/learn.html#bakers-percent">Read more</a>`;
      attachTooltip(btn, { content });
    });
    for (let i = 0; i < state.items.length; i++) {
      const item = state.items[i]!;
      const solvedItem = solved.items[i]!;
      const row = document.createElement("div");
      row.setAttribute("role", "row");
      row.dataset["focusKey"] = `row-${i}`;
      row.dataset["uid"] = item.uid;
      // grams/bakers_pct are typed `number | undefined`. The raw template
      // interpolation below is XSS-safe today because numbers stringify
      // to digits/decimals only. If the type ever widens to `string`,
      // wrap value-rendering in escapeHtml.
      const gramsCell = targetMode
        ? `<span role="cell" class="solved-grams" aria-label="solved grams for ${escapeHtml(item.ingredient_id)}">${solvedItem.grams != null ? `${Math.round(solvedItem.grams)} g` : "—"}</span>`
        : `<input role="cell" type="text" inputmode="decimal" pattern="[0-9]*\\.?[0-9]*"
                 data-field="grams" data-index="${i}" value="${item.grams ?? ""}"
                 aria-label="grams for ${escapeHtml(item.ingredient_id)}" />`;
      const derivedPct = derivedPcts[item.uid];
      const pctIsDerived = item.bakers_pct == null;
      const pctValue = pctIsDerived
        ? (derivedPct != null ? derivedPct.toFixed(1) : "")
        : `${item.bakers_pct}`;
      const pctClass = pctIsDerived ? "pct-derived" : "";
      row.innerHTML = `
        <span role="cell">${escapeHtml(item.ingredient_id)}</span>
        ${gramsCell}
        <input role="cell" type="text" inputmode="decimal" pattern="[0-9]*\\.?[0-9]*"
               data-field="bakers_pct" data-index="${i}" value="${pctValue}" class="${pctClass}"
               title="${pctIsDerived ? "Derived from grams. Type to override." : "User-set baker's percent."}"
               aria-label="bakers percent for ${escapeHtml(item.ingredient_id)}" />
        <span role="cell" class="role-pill-host" data-role-host="${i}"></span>
        <button role="cell" data-action="remove" data-index="${i}" aria-label="remove ${escapeHtml(item.ingredient_id)}">✕</button>
      `;
      parent.appendChild(row);
    }
    // Mount role-pills (separate from row HTML build to avoid escaping issues with the popover).
    for (let i = 0; i < state.items.length; i++) {
      const host = parent.querySelector<HTMLElement>(`[data-role-host="${i}"]`);
      if (!host) continue;
      const item = state.items[i]!;
      const meta = lookupCategoryAndLiquid(item.ingredient_id);
      const inferred = meta ? inferRole(meta.category as never, meta.isLiquid) : ("inclusion" as Role);
      const current = (item.role ?? inferred) as Role;
      const isDerived = item.role == null;
      mountRolePill(host, {
        current,
        isDerived,
        onSelect: (r) => store.dispatch({ type: "set_role", index: i, role: r }),
      });
    }
    if (activeKey) {
      const restored = parent.querySelector(`[data-focus-key="${activeKey}"]`) as HTMLElement | null;
      if (restored) {
        // Restore to the SAME input field (grams vs. bakers_pct) the user was
        // typing in — not just the first input in the row. Falling back to the
        // first input would jump the cursor between columns.
        let input: HTMLInputElement | null = null;
        if (activeField) input = restored.querySelector<HTMLInputElement>(`input[data-field="${activeField}"]`);
        input ??= restored.querySelector("input");
        if (input) {
          // Preserve the user's WIP raw string (e.g. "1." mid-decimal-entry)
          // over the store-derived value attribute. The store value comes from
          // parseFloat(input.value) which strips trailing dots; replaying the
          // raw string keeps the input field stable while the user types.
          if (activeRawValue !== null && activeField === input.dataset["field"]) {
            input.value = activeRawValue;
          }
          input.focus();
          if (cursorPos != null) input.setSelectionRange(cursorPos, cursorPos);
        } else {
          restored.focus();
        }
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
