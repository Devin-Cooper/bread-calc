import type { Store } from "../state.js";
import type { Database } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  parent.innerHTML = `
    <label>Add ingredient
      <input type="search" id="ing-search" placeholder="Type to search…" autocomplete="off"
             role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-autocomplete="list" />
    </label>
    <ul id="ing-results" role="listbox" hidden></ul>`;
  const input = parent.querySelector("#ing-search") as HTMLInputElement;
  const list = parent.querySelector("#ing-results") as HTMLUListElement;

  const items = [
    ...db.flours.map((f) => ({ id: f.id, name: f.name, category: "flour" as const })),
    ...db.ingredients.map((i) => ({ id: i.id, name: i.name, category: i.category })),
  ];

  function render(query: string) {
    const q = query.toLowerCase().trim();
    if (!q) { list.hidden = true; input.setAttribute("aria-expanded", "false"); list.innerHTML = ""; return; }
    const hits = items.filter((it) => it.id.includes(q) || it.name.toLowerCase().includes(q)).slice(0, 12);
    list.innerHTML = hits.map((h) => `<li role="option" data-id="${escapeHtml(h.id)}" tabindex="-1">${escapeHtml(h.name)} <small>${escapeHtml(h.category)}</small></li>`).join("");
    list.hidden = hits.length === 0;
    input.setAttribute("aria-expanded", hits.length > 0 ? "true" : "false");
  }

  input.addEventListener("input", () => render(input.value));
  list.addEventListener("click", (e) => {
    const li = (e.target as HTMLElement).closest("li[role='option']") as HTMLLIElement | null;
    if (!li) return;
    store.dispatch({ type: "add_item", ingredient_id: li.dataset["id"]! });
    input.value = ""; render("");
    input.focus();
  });
}
