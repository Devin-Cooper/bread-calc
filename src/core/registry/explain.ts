import { createRegistry, type Registry } from "./base.js";
import type { ExplainNode } from "../types.js";

export interface ExplainEnv {
  lookup(node_id: string): ExplainNode | null;
}

export interface ExplainNodeType {
  type: string;
  description: string;
  schema: Record<string, unknown>;
  evaluate(node: ExplainNode, env: ExplainEnv): number | null;
  render(node: ExplainNode, env: ExplainEnv): string;
}

export const explainNodeTypes: Registry<ExplainNodeType> = createRegistry<ExplainNodeType>(
  (t) => t.type,
);

// Helpers (kept local; not exported).
function toFixed(n: number | null, digits = 2): string {
  return n === null ? "null" : n.toFixed(digits);
}

// ---- 1. Constant ----
explainNodeTypes.register({
  type: "Constant",
  description: "A literal numeric value (e.g. a default, a threshold).",
  schema: { required: ["id", "label", "value"], properties: { value: { type: "number" } } },
  evaluate(node) {
    if (node.type !== "Constant") return null;
    return node.value;
  },
  render(node) {
    if (node.type !== "Constant") return "";
    return node.unit ? `${node.value} ${node.unit}` : `${node.value}`;
  },
});

// ---- 2. ProjectField ----
explainNodeTypes.register({
  type: "ProjectField",
  description: "Reads a numeric field from a recipe item or its resolved ingredient.",
  schema: { required: ["id", "label", "source_uid", "field", "value"] },
  evaluate(node) {
    if (node.type !== "ProjectField") return null;
    return node.value;
  },
  render(node) {
    if (node.type !== "ProjectField") return "";
    return `${node.label} (${node.source_uid}.${node.field}) = ${node.value}`;
  },
});

// ---- 3. Sum ----
explainNodeTypes.register({
  type: "Sum",
  description: "Sum of child term values. null if any term is null.",
  schema: { required: ["id", "label", "terms"] },
  evaluate(node, env) {
    if (node.type !== "Sum") return null;
    let total = 0;
    for (const term of node.terms) {
      const t = explainNodeTypes.get(term.type)!.evaluate(term, env);
      if (t === null) return null;
      total += t;
    }
    return total;
  },
  render(node) {
    if (node.type !== "Sum") return "";
    return `${node.label} = sum(${node.terms.length} terms) = ${toFixed(node.value)}`;
  },
});

// ---- 4. WeightedSum ----
explainNodeTypes.register({
  type: "WeightedSum",
  description: "Sum of (weight × value) over child term pairs.",
  schema: { required: ["id", "label", "terms"] },
  evaluate(node, env) {
    if (node.type !== "WeightedSum") return null;
    let total = 0;
    for (const { weight, value } of node.terms) {
      const w = explainNodeTypes.get(weight.type)!.evaluate(weight, env);
      const v = explainNodeTypes.get(value.type)!.evaluate(value, env);
      if (w === null || v === null) return null;
      total += w * v;
    }
    return total;
  },
  render(node) {
    if (node.type !== "WeightedSum") return "";
    return `${node.label} = Σ(weight × value) over ${node.terms.length} pairs = ${toFixed(node.value)}`;
  },
});

// ---- 5. Product ----
explainNodeTypes.register({
  type: "Product",
  description: "Product of child factor values. null if any factor is null.",
  schema: { required: ["id", "label", "factors"] },
  evaluate(node, env) {
    if (node.type !== "Product") return null;
    let total = 1;
    for (const f of node.factors) {
      const v = explainNodeTypes.get(f.type)!.evaluate(f, env);
      if (v === null) return null;
      total *= v;
    }
    return total;
  },
  render(node) {
    if (node.type !== "Product") return "";
    return `${node.label} = product(${node.factors.length} factors) = ${toFixed(node.value)}`;
  },
});

// ---- 6. Ratio ----
explainNodeTypes.register({
  type: "Ratio",
  description: "numerator / denominator. null when denominator is 0 or null.",
  schema: { required: ["id", "label", "numerator", "denominator"] },
  evaluate(node, env) {
    if (node.type !== "Ratio") return null;
    const n = explainNodeTypes.get(node.numerator.type)!.evaluate(node.numerator, env);
    const d = explainNodeTypes.get(node.denominator.type)!.evaluate(node.denominator, env);
    if (n === null || d === null || d === 0) return null;
    return n / d;
  },
  render(node) {
    if (node.type !== "Ratio") return "";
    return `${node.label} = ${toFixed(node.numerator.value as number)} / ${toFixed(node.denominator.value as number)} = ${toFixed(node.value)}`;
  },
});

// ---- 7. Scale ----
explainNodeTypes.register({
  type: "Scale",
  description: "input × factor (constant multiplier).",
  schema: { required: ["id", "label", "input", "factor"] },
  evaluate(node, env) {
    if (node.type !== "Scale") return null;
    const v = explainNodeTypes.get(node.input.type)!.evaluate(node.input, env);
    if (v === null) return null;
    return v * node.factor;
  },
  render(node) {
    if (node.type !== "Scale") return "";
    return `${node.label} = ${toFixed(node.input.value as number)} × ${node.factor} = ${toFixed(node.value)}`;
  },
});

// ---- 8. ProjectFromTree ----
explainNodeTypes.register({
  type: "ProjectFromTree",
  description: "Reads the value of another node in the tree by id (cross-reference).",
  schema: { required: ["id", "label", "ref_id"] },
  evaluate(node, env) {
    if (node.type !== "ProjectFromTree") return null;
    const target = env.lookup(node.ref_id);
    if (!target) return null;
    return explainNodeTypes.get(target.type)!.evaluate(target, env);
  },
  render(node) {
    if (node.type !== "ProjectFromTree") return "";
    return `${node.label} = (ref ${node.ref_id}) = ${toFixed(node.value)}`;
  },
});
