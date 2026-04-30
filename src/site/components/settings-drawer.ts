import type { Store } from "../state.js";
import type { Recipe } from "../../core/index.js";

export interface DrawerController {
  open(): void;
  close(): void;
}

const THEME_KEY = "bread-calc:theme";
const PRINT_ROLE_KEY = "bread-calc:print-show-role";

type Theme = "system" | "light" | "dark";
type Metric = NonNullable<Recipe["headline_metric"]>;

export function mount(dialog: HTMLDialogElement, store: Store): DrawerController {
  function getTheme(): Theme {
    try {
      const v = localStorage.getItem(THEME_KEY);
      if (v === "light" || v === "dark") return v;
    } catch { /* ignore */ }
    return "system";
  }
  function setTheme(t: Theme): void {
    try {
      if (t === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, t);
    } catch { /* ignore */ }
    applyTheme();
  }
  function getPrintRole(): boolean {
    try { return localStorage.getItem(PRINT_ROLE_KEY) === "1"; } catch { return false; }
  }
  function setPrintRole(v: boolean): void {
    try { localStorage.setItem(PRINT_ROLE_KEY, v ? "1" : "0"); } catch { /* ignore */ }
  }

  function render(): void {
    const theme = getTheme();
    const headline = store.getState().headline_metric ?? "effective";
    const printRole = getPrintRole();

    dialog.innerHTML = `
      <div class="drawer-inner">
        <header class="drawer-header">
          <h2 class="type-heading-lg">Settings</h2>
          <button type="button" class="drawer-close" data-action="close" aria-label="Close settings">×</button>
        </header>

        <fieldset class="drawer-control" data-control="theme">
          <legend class="type-body-sm">Theme</legend>
          <div class="segmented" role="radiogroup" aria-label="Theme">
            ${(["system", "light", "dark"] as Theme[]).map((t) => `
              <button type="button" role="radio"
                      aria-checked="${theme === t}"
                      class="${theme === t ? "is-on" : ""}"
                      data-theme="${t}">${t[0]!.toUpperCase()}${t.slice(1)}</button>
            `).join("")}
          </div>
        </fieldset>

        <fieldset class="drawer-control" data-control="headline-metric">
          <legend class="type-body-sm">Headline metric</legend>
          <div class="segmented" role="radiogroup" aria-label="Headline metric">
            ${(["effective", "nominal", "total_liquid"] as Metric[]).map((m) => `
              <button type="button" role="radio"
                      aria-checked="${headline === m}"
                      class="${headline === m ? "is-on" : ""}"
                      data-metric="${m}">${labelOf(m)}</button>
            `).join("")}
          </div>
        </fieldset>

        <fieldset class="drawer-control" data-control="print-show-role">
          <legend class="type-body-sm">Print: include Role column</legend>
          <label class="checkbox-row">
            <input type="checkbox" data-action="toggle-print-role" ${printRole ? "checked" : ""} />
            <span class="type-body-md">Add a Role column to the printed kitchen card.</span>
          </label>
        </fieldset>
      </div>
    `;

    dialog.querySelector<HTMLButtonElement>("[data-action='close']")?.addEventListener("click", close);

    dialog.querySelectorAll<HTMLButtonElement>("[data-theme]").forEach((b) => {
      b.addEventListener("click", () => { setTheme(b.dataset["theme"] as Theme); render(); });
    });

    dialog.querySelectorAll<HTMLButtonElement>("[data-metric]").forEach((b) => {
      b.addEventListener("click", () => {
        store.dispatch({ type: "set_headline_metric", metric: b.dataset["metric"] as Metric });
        render();
      });
    });

    dialog.querySelector<HTMLInputElement>("[data-action='toggle-print-role']")?.addEventListener("change", (e) => {
      setPrintRole((e.target as HTMLInputElement).checked);
    });
  }

  function open(): void {
    render();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    dialog.querySelector<HTMLButtonElement>("[data-action='close']")?.focus();
  }
  function close(): void {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  // Keep headline-metric segmented in sync if the store changes from elsewhere.
  store.subscribe(() => { if (dialog.hasAttribute("open")) render(); });

  return { open, close };
}

function labelOf(m: Metric): string {
  if (m === "total_liquid") return "Total liquid";
  return m[0]!.toUpperCase() + m.slice(1);
}

export function applyTheme(): void {
  const root = document.documentElement;
  let v: string | null = null;
  try { v = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
  if (v === "light" || v === "dark") root.setAttribute("data-theme", v);
  else root.removeAttribute("data-theme");
}
