import type { RecipeItem } from "../../core/index.js";

export type Role = NonNullable<RecipeItem["role"]>;

export const ROLE_OPTIONS: Role[] = [
  "flour", "wet", "fat", "sweetener", "salt", "yeast", "leavener", "inclusion", "enrichment",
] as Role[];

export interface PillProps {
  current: Role;
  isDerived: boolean;
  onSelect: (role: Role | undefined) => void;
}

export function mount(parent: HTMLElement, props: PillProps): void {
  let isOpen = false;

  function render(): void {
    parent.innerHTML = `
      <button type="button" class="role-pill ${props.isDerived ? "is-derived" : ""}"
              data-role-trigger
              data-role="${props.isDerived ? "" : props.current}"
              aria-haspopup="listbox"
              aria-expanded="${isOpen}"
              aria-label="Role: ${props.current}${props.isDerived ? " (inferred)" : ""}. Click to change.">
        <span>${props.current}</span>
        <span class="role-pill-caret" aria-hidden="true">▾</span>
      </button>
      ${isOpen ? renderListbox() : ""}
    `;

    parent.querySelector<HTMLButtonElement>("[data-role-trigger]")?.addEventListener("click", () => {
      isOpen = !isOpen;
      render();
      if (isOpen) parent.querySelector<HTMLElement>("[role='option']")?.focus();
    });

    parent.querySelectorAll<HTMLElement>("[role='option']").forEach((opt) => {
      opt.addEventListener("click", () => {
        const v = opt.dataset["role"];
        const role = v === "" ? undefined : (v as Role);
        isOpen = false;
        render();
        props.onSelect(role);
      });
    });

    if (isOpen) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") { isOpen = false; render(); document.removeEventListener("keydown", onKey); }
      };
      document.addEventListener("keydown", onKey);

      const onOutside = (e: MouseEvent) => {
        if (!parent.contains(e.target as Node)) {
          isOpen = false; render();
          document.removeEventListener("click", onOutside);
        }
      };
      setTimeout(() => document.addEventListener("click", onOutside), 0);
    }
  }

  function renderListbox(): string {
    return `
      <div class="role-popover" role="listbox" aria-label="Choose role">
        ${ROLE_OPTIONS.map((r) => `
          <button type="button" role="option" class="role-option type-body-md" data-role="${r}"
                  aria-selected="${props.current === r && !props.isDerived}">${r}</button>
        `).join("")}
        <button type="button" role="option" class="role-option role-option-inferred type-body-sm" data-role=""
                aria-selected="${props.isDerived}">(use inferred)</button>
      </div>
    `;
  }

  render();
}
