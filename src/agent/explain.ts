import type { ExplainTree, ExplainNode } from "../core/types.js";
import { explainNodeTypes } from "../core/registry/explain.js";

const env = { lookup: (_id: string): ExplainNode | null => null };

export function renderNarrative(tree: ExplainTree, indent = 0): string {
  const lines: string[] = [];
  function walk(n: ExplainNode, depth: number): void {
    const t = explainNodeTypes.get(n.type);
    const text = t ? t.render(n, env) : `${n.label} = ${n.value ?? "null"}`;
    lines.push(`${"  ".repeat(depth)}${text}`);
    switch (n.type) {
      case "Sum":         for (const c of n.terms) walk(c, depth + 1); break;
      case "WeightedSum": for (const p of n.terms) { walk(p.weight, depth + 1); walk(p.value, depth + 1); } break;
      case "Product":     for (const c of n.factors) walk(c, depth + 1); break;
      case "Ratio":       walk(n.numerator, depth + 1); walk(n.denominator, depth + 1); break;
      case "Scale":       walk(n.input, depth + 1); break;
      default: break;
    }
  }
  walk(tree, indent);
  return lines.join("\n");
}
