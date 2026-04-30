import type { Store } from "../state.js";
import type { Database, Recipe, RecipeItem } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";
import { buildTemplates, loadTemplate, type TemplateEntry } from "../templates.js";

function stripUids(recipe: Recipe): unknown {
  return {
    ...recipe,
    items: recipe.items.map((it: RecipeItem) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { uid: _uid, ...rest } = it;
      return rest;
    }),
  };
}

function canonicalStringify(value: unknown): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        out[k] = sortKeys((v as Record<string, unknown>)[k]);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(sortKeys(value));
}

function hashRecipe(recipe: Recipe): string {
  const s = canonicalStringify(stripUids(recipe));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  let isOpen = false;
  let filter = "";
  let lastBaselineHash = hashRecipe(store.getState());

  // Build the static trigger button once; update aria-expanded in-place.
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "template-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.innerHTML = `<span>Templates</span><span aria-hidden="true">▾</span>`;
  parent.appendChild(trigger);

  trigger.addEventListener("click", () => {
    isOpen = !isOpen;
    render();
    if (isOpen) parent.querySelector<HTMLInputElement>(".template-filter")?.focus();
  });

  function render(): void {
    trigger.setAttribute("aria-expanded", String(isOpen));

    // Remove existing popover if present.
    parent.querySelector(".template-popover")?.remove();

    if (!isOpen) return;

    const templates = buildTemplates(db);
    const popover = document.createElement("div");
    popover.className = "template-popover";
    popover.innerHTML = `
      <div class="template-search-row">
        <input type="search" class="template-filter" value="${escapeHtml(filter)}"
               placeholder="Type to filter…" aria-label="Filter templates" />
        <button type="button" class="template-close" aria-label="Close template picker">×</button>
      </div>
      <div class="template-list" role="listbox" aria-label="BB-PDC20 templates" tabindex="-1">
        ${renderGroups(filterTemplates(templates, filter))}
      </div>
    `;
    parent.appendChild(popover);

    popover.querySelector<HTMLButtonElement>(".template-close")?.addEventListener("click", () => {
      isOpen = false; filter = ""; render();
    });

    const filterInput = popover.querySelector<HTMLInputElement>(".template-filter");
    filterInput?.addEventListener("input", (e) => {
      filter = (e.target as HTMLInputElement).value;
      render();
      const restored = parent.querySelector<HTMLInputElement>(".template-filter");
      if (restored) { restored.focus(); restored.setSelectionRange(filter.length, filter.length); }
    });

    parent.querySelectorAll<HTMLElement>("[role='option']").forEach((opt) => {
      opt.addEventListener("click", () => {
        const id = opt.dataset["templateId"];
        if (!id) return;
        const entry = templates.find((t) => t.id === id);
        if (!entry) return;
        const isEdited = hashRecipe(store.getState()) !== lastBaselineHash;
        if (isEdited) showConfirmDialog(entry);
        else commitLoad(entry);
      });
    });
  }

  function commitLoad(entry: TemplateEntry): void {
    const loaded = loadTemplate(entry);
    store.dispatch({ type: "load", recipe: loaded });
    lastBaselineHash = hashRecipe(loaded);
    isOpen = false; filter = ""; render();
  }

  function showConfirmDialog(entry: TemplateEntry): void {
    let dialog = document.querySelector<HTMLDialogElement>("#template-confirm");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "template-confirm";
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = `
      <h2>Replace your current recipe?</h2>
      <p>You have unsaved changes. Loading "<em>${escapeHtml(entry.name)}</em>" will discard them.</p>
      <div class="dialog-actions">
        <button type="button" data-action="cancel">Cancel</button>
        <button type="button" data-action="replace" class="primary">Replace</button>
      </div>
    `;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    dialog.querySelector<HTMLButtonElement>("[data-action='cancel']")!.addEventListener("click", () => {
      closeDialog(dialog!);
    });
    dialog.querySelector<HTMLButtonElement>("[data-action='replace']")!.addEventListener("click", () => {
      commitLoad(entry);
      closeDialog(dialog!);
    });
  }

  function closeDialog(dialog: HTMLDialogElement): void {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    dialog.remove();
  }

  function filterTemplates(templates: TemplateEntry[], q: string): TemplateEntry[] {
    const query = q.toLowerCase().trim();
    if (!query) return templates;
    const byName = templates.filter((t) => t.name.toLowerCase().includes(query));
    if (byName.length > 0) return byName;
    return templates.filter((t) => t.course.toLowerCase().includes(query));
  }

  function renderGroups(templates: TemplateEntry[]): string {
    const byCourse = new Map<string, TemplateEntry[]>();
    for (const t of templates) {
      const arr = byCourse.get(t.course) ?? [];
      arr.push(t);
      byCourse.set(t.course, arr);
    }
    return Array.from(byCourse.entries()).map(([course, group]) => `
      <ul role="group" aria-label="${escapeHtml(course)}" class="template-group">
        <li class="template-group-label" aria-hidden="true">${escapeHtml(course)}</li>
        ${group.map((t) => `
          <li role="option" id="tpl-${escapeHtml(t.id)}" data-template-id="${escapeHtml(t.id)}"
              aria-label="${escapeHtml(t.name)}, ${t.totals.hydration_pct_nominal.toFixed(0)}% hydration, ${escapeHtml(t.totals.zone)} zone">
            <span class="template-name">${escapeHtml(t.name)}</span>
            <span class="template-meta">${t.totals.hydration_pct_nominal.toFixed(0)} % · ${escapeHtml(t.totals.zone)}</span>
          </li>
        `).join("")}
      </ul>
    `).join("");
  }

  store.subscribe(render);
  render();
}
