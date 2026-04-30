import type { Store } from "../state.js";
import type { Database } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";
import { buildTemplates, type TemplateEntry } from "../templates.js";

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  let isOpen = false;
  let filter = "";

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
