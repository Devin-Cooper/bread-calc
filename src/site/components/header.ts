export type HeaderActionId = "save" | "open" | "share" | "pdf" | "settings";

export interface HeaderProps {
  onAction: (id: HeaderActionId) => void;
}

const MENU_ITEMS: Array<{ id: HeaderActionId; label: string }> = [
  { id: "save",     label: "Save .bread.json" },
  { id: "open",     label: "Open recipe…" },
  { id: "share",    label: "Copy share URL" },
  { id: "pdf",      label: "Export PDF" },
  { id: "settings", label: "⚙ Settings" },
];

export function mount(parent: HTMLElement, props: HeaderProps): void {
  let menuOpen = false;

  function render(): void {
    parent.innerHTML = `
      <div class="header-row">
        <a class="header-wordmark type-display-md" href="/">breadmachine.io</a>
        <nav class="header-nav">
          <a href="/learn" class="header-learn type-body-md">Learn</a>
          <button type="button" class="header-overflow"
                  data-action="overflow"
                  aria-label="Recipe actions menu"
                  aria-haspopup="menu"
                  aria-expanded="${menuOpen}">⋯</button>
        </nav>
      </div>
      <p class="header-tagline type-body-sm">Hydration calculator for bread machines.</p>
      ${menuOpen ? renderMenu() : ""}
    `;

    const overflowBtn = parent.querySelector<HTMLButtonElement>("[data-action='overflow']");
    overflowBtn?.addEventListener("click", () => {
      menuOpen = !menuOpen;
      // Update the attribute on the live element before render() detaches it,
      // so any caller that holds a reference to this button sees the new value.
      overflowBtn.setAttribute("aria-expanded", String(menuOpen));
      render();
      if (menuOpen) {
        // Focus the first menu item on open
        parent.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus();
      }
    });

    parent.querySelectorAll<HTMLButtonElement>("[role='menuitem']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset["id"] as HeaderActionId;
        menuOpen = false;
        render();
        props.onAction(id);
      });
    });

    if (menuOpen) {
      // Close menu on Escape or click-outside
      const closeOnEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") { menuOpen = false; render(); document.removeEventListener("keydown", closeOnEscape); }
      };
      document.addEventListener("keydown", closeOnEscape);

      const closeOnOutside = (e: MouseEvent) => {
        if (!parent.contains(e.target as Node)) {
          menuOpen = false; render();
          document.removeEventListener("click", closeOnOutside);
        }
      };
      // Defer attaching the click-outside listener to the next tick so the click that opened the menu doesn't immediately close it.
      setTimeout(() => document.addEventListener("click", closeOnOutside), 0);
    }
  }

  function renderMenu(): string {
    return `
      <div class="header-menu" role="menu">
        ${MENU_ITEMS.map((item) => `
          <button type="button" role="menuitem" class="header-menu-item type-body-md" data-id="${item.id}">
            ${item.label}
          </button>
        `).join("")}
      </div>
    `;
  }

  render();
}
