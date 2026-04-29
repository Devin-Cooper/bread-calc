import type { Store } from "../state.js";

// Renders the target-loaf-weight input when target mode is active (i.e. when
// state.target_loaf_g is set). In ingredients mode the panel is empty.
export function mount(parent: HTMLElement, store: Store): void {
  function render() {
    const r = store.getState();
    if (r.target_loaf_g == null) {
      parent.innerHTML = "";
      return;
    }
    parent.innerHTML = `
      <label class="target-input">
        Target loaf weight (g)
        <input type="number" inputmode="decimal" step="1" min="0"
               id="target-loaf-g" value="${r.target_loaf_g}"
               aria-label="Target loaf weight in grams" />
      </label>
      <p class="hint">In target mode, set baker's % on each ingredient and the grams below are solved automatically.</p>
    `;
    const input = parent.querySelector("#target-loaf-g") as HTMLInputElement;
    input.addEventListener("input", () => {
      const n = parseFloat(input.value);
      if (!Number.isFinite(n) || n <= 0) return;
      store.dispatch({ type: "set_target_loaf_g", grams: n });
    });
  }
  store.subscribe(render);
  render();
}
