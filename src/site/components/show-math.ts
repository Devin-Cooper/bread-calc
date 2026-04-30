import type { Store } from "../state.js";
import type { Database, ComputedRecipe, ExplainNode } from "../../core/index.js";
import { computeRecipe } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";
import { effectiveRecipe } from "../effective-recipe.js";
import { renderNarrative, findNode } from "../explain-narrative.js";

interface MetricSlot {
  key: string;
  displayLabel: string;             // human-readable section heading
  treeLabel: string | null;         // label to look up in the tree; null = no tree backing
  fallback?: (c: ComputedRecipe) => string; // HTML to render when treeLabel is null or node missing
}

const SLOTS: MetricSlot[] = [
  // Hydration: effective and nominal have tree backing via the *_pct Scale nodes.
  // Total liquid is computed in compute.ts outside the tree → fallback only.
  { key: "effective", displayLabel: "Effective hydration", treeLabel: "effective_pct" },
  { key: "nominal",   displayLabel: "Nominal hydration",   treeLabel: "nominal_pct" },
  { key: "total_liquid", displayLabel: "Total liquid", treeLabel: null,
    fallback: (c) => fmtPct("Total liquid", c.hydration.total_liquid_pct) },

  // Salt/Sugar/Fat baker's-percent: no tree node — fallback shows just the number.
  // The drillable absolute-grams aggregates (total_salt_g_equivalent, etc.) are NOT
  // surfaced as their own slot since the user thinks in baker's %, not grams.
  { key: "salt_pct",  displayLabel: "Salt percentage",  treeLabel: null,
    fallback: (c) => fmtPct("Salt %", c.bakers_percents.salt_equivalent_pct) },
  { key: "sugar_pct", displayLabel: "Sugar percentage", treeLabel: null,
    fallback: (c) => fmtPct("Sugar %", c.bakers_percents.sugar_equivalent_pct) },
  { key: "fat_pct",   displayLabel: "Fat percentage",   treeLabel: null,
    fallback: (c) => fmtPct("Fat %", c.bakers_percents.fat_equivalent_pct) },

  { key: "predicted", displayLabel: "Predicted loaf weight", treeLabel: "predicted_loaf_g" },
];

function fmtPct(label: string, n: number | null): string {
  return `<div class="show-math-line">${escapeHtml(label)} = ${n == null ? "—" : n.toFixed(1) + " %"}</div>`;
}

function findByLabel(node: ExplainNode | null | undefined, label: string): ExplainNode | null {
  if (!node) return null;
  if (node.label === label) return node;
  switch (node.type) {
    case "Sum":         return firstFound(node.terms, label);
    case "Product":     return firstFound(node.factors, label);
    case "WeightedSum": return firstFound([...node.terms.map((t) => t.weight), ...node.terms.map((t) => t.value)], label);
    case "Ratio":       return findByLabel(node.numerator, label) ?? findByLabel(node.denominator, label);
    case "Scale":       return findByLabel(node.input, label);
    case "Constant":
    case "ProjectField":
    case "ProjectFromTree":
      return null;
  }
}
function firstFound(nodes: ExplainNode[], label: string): ExplainNode | null {
  for (const n of nodes) { const f = findByLabel(n, label); if (f) return f; }
  return null;
}

function isDrillable(node: ExplainNode): boolean {
  return node.type !== "Constant" && node.type !== "ProjectField" && node.type !== "ProjectFromTree";
}

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  // Track open drill-down node ids per metric slot for re-render preservation.
  const drillState: Record<string, Set<string>> = Object.create(null);

  function render(): void {
    let c: ComputedRecipe;
    try { c = computeRecipe(effectiveRecipe(store.getState(), db), db); }
    catch { parent.innerHTML = `<p class="placeholder type-body-md">Add ingredients to see the math.</p>`; return; }

    parent.innerHTML = `
      <h2 class="type-heading-lg">Show the math</h2>
      <p class="type-body-sm" style="margin-top:0;color:var(--color-fg-muted);">
        Tap any bold term in a derivation to drill into how it was computed.
      </p>
      ${SLOTS.map((slot) => {
        drillState[slot.key] ??= new Set();
        const opens = drillState[slot.key]!;
        let body = "";
        if (slot.treeLabel) {
          const node = findByLabel(c.tree, slot.treeLabel);
          if (node) {
            body = renderNode(node, opens);
          } else if (slot.fallback) {
            body = slot.fallback(c);
          } else {
            body = `<p class="placeholder type-body-md">No derivation available.</p>`;
          }
        } else if (slot.fallback) {
          body = slot.fallback(c);
        }
        return `
          <details class="show-math-item" data-slot="${slot.key}">
            <summary class="type-heading-md">${escapeHtml(slot.displayLabel)}</summary>
            <div class="show-math-body">${body}</div>
          </details>
        `;
      }).join("")}
    `;

    parent.querySelectorAll<HTMLElement>("[data-drill]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const slotKey = btn.closest<HTMLElement>("[data-slot]")?.dataset["slot"];
        const id = btn.dataset["drill"]!;
        if (!slotKey) return;
        const set = drillState[slotKey]!;
        if (set.has(id)) set.delete(id);
        else set.add(id);
        render();
      });
    });
  }

  function renderNode(node: ExplainNode, opens: Set<string>): string {
    const narr = renderNarrative(node);
    let html = escapeHtml(narr.text);
    narr.terms.forEach((term, i) => {
      // Look up the actual child node to decide drillability
      const child = findNode(node, term.nodeId);
      const childIsDrillable = child != null && isDrillable(child);
      const isOpen = opens.has(term.nodeId);
      const buttonHtml = childIsDrillable
        ? `<button type="button" class="show-math-term ${isOpen ? "is-open" : ""}" data-drill="${term.nodeId}">
             <strong>${escapeHtml(term.formattedValue)}</strong>
             <span class="show-math-term-label type-body-sm">${escapeHtml(term.label)}</span>
           </button>`
        : `<span class="show-math-term-leaf">
             <strong>${escapeHtml(term.formattedValue)}</strong>
             <span class="show-math-term-label type-body-sm">${escapeHtml(term.label)}</span>
           </span>`;
      html = html.replace(`{{TERM:${i}}}`, buttonHtml);
    });

    // Render nested derivations for any open terms
    const nested = narr.terms
      .filter((t) => opens.has(t.nodeId))
      .map((t) => {
        const child = findNode(node, t.nodeId);
        if (!child) return "";
        return `<div class="show-math-nested">${renderNode(child, opens)}</div>`;
      }).join("");

    return `<div class="show-math-line">${html}</div>${nested}`;
  }

  store.subscribe(render); render();
}
