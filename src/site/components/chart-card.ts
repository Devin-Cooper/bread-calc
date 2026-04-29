import type { Store } from "../state.js";
import type { Database } from "../../core/index.js";
import { computeRecipe, renderHydrationChart } from "../../core/index.js";
import { mount as mountTableView } from "./chart-table-view.js";

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  let viewMode: "chart" | "table" = "chart";
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  function render() {
    let computed; try { computed = computeRecipe(store.getState(), db); } catch { parent.innerHTML = ""; return; }
    parent.innerHTML = `
      <div class="chart-controls"><button id="toggle-view" aria-pressed="${viewMode === "table"}">${viewMode === "chart" ? "View as table" : "View as chart"}</button></div>
      <div id="chart-content"></div>`;
    const content = parent.querySelector("#chart-content") as HTMLElement;
    const theme = darkQuery.matches ? "dark" : "light";
    if (viewMode === "chart") content.innerHTML = renderHydrationChart(computed, { reference: db.references, theme });
    else mountTableView(content, computed, db);
    parent.querySelector("#toggle-view")!.addEventListener("click", () => {
      viewMode = viewMode === "chart" ? "table" : "chart"; render();
    });
  }
  store.subscribe(render); render();
  darkQuery.addEventListener("change", render);
}
