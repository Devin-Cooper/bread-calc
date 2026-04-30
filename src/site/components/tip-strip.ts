const FLAG_KEY = "bread-calc:tip-dismissed";

export function mount(parent: HTMLElement): void {
  if (safeRead() === "1") {
    parent.innerHTML = "";
    return;
  }
  parent.innerHTML = `
    <div role="status" class="tip-strip-inner">
      <span class="type-body-md">Edit any cell to recalculate. Use the ⋯ menu to save or share.</span>
      <button type="button" class="tip-strip-dismiss" data-action="dismiss" aria-label="Dismiss tip">×</button>
    </div>
  `;
  parent.querySelector<HTMLButtonElement>("[data-action='dismiss']")?.addEventListener("click", () => {
    safeWrite("1");
    parent.innerHTML = "";
  });
}

function safeRead(): string | null {
  try { return localStorage.getItem(FLAG_KEY); } catch { return null; }
}
function safeWrite(v: string): void {
  try { localStorage.setItem(FLAG_KEY, v); } catch { /* quota; ignore */ }
}
