import type { Store } from "../state.js";
import { escapeHtml } from "../../core/escape.js";
import { attachTooltip } from "./tooltip.js";

export function mount(parent: HTMLElement, store: Store): void {
  function render(): void {
    const r = store.getState();
    const inTargetMode = r.target_loaf_g != null;
    const badge = inTargetMode ? "Build by target weight" : "Build by ingredients";

    const nameContent = r.name && r.name.length > 0 ? escapeHtml(r.name) : "Untitled recipe";
    const nameEmpty = !r.name || r.name.length === 0 ? "1" : "";

    const hasNotes = r.notes != null && r.notes.length > 0;

    parent.innerHTML = `
      <h2 class="recipe-name type-display-md">
        <span data-role="name" contenteditable="plaintext-only" spellcheck="false"
              role="textbox" aria-label="Recipe name"
              data-empty="${nameEmpty}">${nameContent}</span>
      </h2>
      <p class="recipe-notes-row">
        ${hasNotes
          ? `<span class="recipe-notes type-body-md" data-role="notes" contenteditable="plaintext-only" role="textbox" aria-label="Recipe notes">${escapeHtml(r.notes!)}</span>
             <button type="button" class="recipe-notes-clear" data-action="clear-notes" aria-label="Clear notes">×</button>`
          : `<button type="button" class="recipe-notes-add type-body-sm" data-action="add-notes">+ Add note</button>`
        }
      </p>
      <div class="mode-badge type-body-sm" aria-live="polite">${badge}<button type="button" class="help-icon" data-help="mode-badge" aria-label="Explain mode">?</button></div>
    `;
    parent.querySelectorAll<HTMLElement>(".mode-badge [data-help]").forEach((btn) => {
      attachTooltip(btn, {
        content: `<strong>Build by ingredients:</strong> type grams directly. <strong>Build by target weight:</strong> set a loaf size and the calculator solves for grams from your baker's percentages. Switch by clicking <em>+ Set target weight</em> in the snapshot card. <a href="/learn.html#bakers-percent">Read more</a>`,
      });
    });
  }

  // Use event delegation on parent with capture to handle blur events even
  // after innerHTML re-assignment (happy-dom compat, same pattern as header.ts).
  parent.addEventListener("blur", (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset["role"] === "name") {
      const v = (target.textContent ?? "").trim();
      if (v === "Untitled recipe" && target.dataset["empty"] === "1") return;
      store.dispatch({ type: "set_name", name: v });
    } else if (target.dataset["role"] === "notes") {
      const v = (target.textContent ?? "").trim();
      store.dispatch({ type: "set_notes", notes: v });
    }
  }, true);

  parent.addEventListener("focus", (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset["role"] === "name" && target.dataset["empty"] === "1") {
      target.textContent = "";
      target.dataset["empty"] = "";
    }
  }, true);

  parent.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    if (e.key === "Enter" && (target.dataset["role"] === "name" || target.dataset["role"] === "notes")) {
      e.preventDefault();
      target.blur();
    }
  });

  parent.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset["action"];
    if (action === "add-notes") {
      store.dispatch({ type: "set_notes", notes: " " });
      // Re-render will draw the notes span; focus it.
      setTimeout(() => parent.querySelector<HTMLElement>("[data-role='notes']")?.focus(), 0);
    } else if (action === "clear-notes") {
      store.dispatch({ type: "set_notes", notes: "" });
    }
  });

  store.subscribe(render);
  render();
}
