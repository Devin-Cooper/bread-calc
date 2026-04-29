import type { Store } from "../state.js";

const VALID_METRICS = ["effective", "nominal", "total_liquid"] as const;
type Metric = typeof VALID_METRICS[number];

function isMetric(s: string): s is Metric {
  return (VALID_METRICS as readonly string[]).includes(s);
}

export function mount(el: HTMLSelectElement, store: Store): void {
  el.value = store.getState().headline_metric ?? "effective";
  el.addEventListener("change", () => {
    if (!isMetric(el.value)) return;
    store.dispatch({ type: "set_headline_metric", metric: el.value });
  });
}
