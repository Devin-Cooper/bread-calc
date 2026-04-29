import type { Store } from "../state.js";
export function mount(el: HTMLSelectElement, store: Store): void {
  el.value = store.getState().target_loaf_g != null ? "target" : "ingredients";
  el.addEventListener("change", () => {
    const r = store.getState();
    if (el.value === "target" && r.target_loaf_g == null) store.dispatch({ type: "set_target_loaf_g", grams: 900 });
    if (el.value === "ingredients" && r.target_loaf_g != null) store.dispatch({ type: "set_target_loaf_g", grams: undefined });
  });
}
