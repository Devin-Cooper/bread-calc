export interface TooltipOptions {
  content: string;             // Trusted HTML — caller must sanitize
  hoverDelayMs?: number;       // Default 200
  closeDelayMs?: number;       // Default 400
}

let openOverlay: HTMLElement | null = null;
let openTrigger: HTMLElement | null = null;
let openTimer: number | undefined;
let closeTimer: number | undefined;

export function attachTooltip(trigger: HTMLElement, opts: TooltipOptions): void {
  const hoverDelay = opts.hoverDelayMs ?? 200;
  const closeDelay = opts.closeDelayMs ?? 400;
  trigger.setAttribute("aria-haspopup", "true");

  function open(): void {
    if (openTrigger === trigger) return;
    closeAllTooltips();

    const overlay = document.createElement("div");
    overlay.setAttribute("role", "tooltip");
    overlay.className = "tooltip-overlay type-body-md";
    overlay.innerHTML = opts.content;
    overlay.id = `tooltip-${Math.random().toString(36).slice(2, 9)}`;
    document.body.appendChild(overlay);

    const r = trigger.getBoundingClientRect();
    overlay.style.position = "absolute";
    overlay.style.zIndex = "var(--z-tooltip)";
    overlay.style.top = `${r.bottom + window.scrollY + 6}px`;
    overlay.style.left = `${Math.max(8, r.left + window.scrollX)}px`;
    overlay.style.maxWidth = "min(320px, calc(100vw - 32px))";

    trigger.setAttribute("aria-describedby", overlay.id);

    openOverlay = overlay;
    openTrigger = trigger;
  }

  function scheduleOpen(): void {
    if (openTimer) clearTimeout(openTimer);
    if (closeTimer) clearTimeout(closeTimer);
    openTimer = setTimeout(open, hoverDelay) as unknown as number;
  }

  function scheduleClose(): void {
    if (openTimer) clearTimeout(openTimer);
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (openTrigger === trigger) closeAllTooltips();
    }, closeDelay) as unknown as number;
  }

  trigger.addEventListener("mouseenter", scheduleOpen);
  trigger.addEventListener("mouseleave", scheduleClose);
  trigger.addEventListener("focus", scheduleOpen);
  trigger.addEventListener("blur", scheduleClose);
  trigger.addEventListener("click", (e) => {
    // On coarse pointers (touch), tap toggles open and stays open until tap-outside.
    if (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) {
      e.preventDefault();
      if (openTrigger === trigger) closeAllTooltips();
      else open();
    }
  });
}

export function closeAllTooltips(): void {
  if (openOverlay) {
    if (openTrigger) openTrigger.removeAttribute("aria-describedby");
    openOverlay.remove();
    openOverlay = null;
    openTrigger = null;
  }
  if (openTimer) { clearTimeout(openTimer); openTimer = undefined; }
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = undefined; }
}

// Global Escape + tap-outside listeners (installed once).
let listenersInstalled = false;
function installGlobalListeners(): void {
  if (listenersInstalled) return;
  listenersInstalled = true;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllTooltips();
  });
  document.addEventListener("click", (e) => {
    if (!openOverlay || !openTrigger) return;
    const t = e.target as Node;
    if (!openOverlay.contains(t) && !openTrigger.contains(t)) closeAllTooltips();
  });
}
installGlobalListeners();
