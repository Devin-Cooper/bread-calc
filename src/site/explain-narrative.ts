import type { ExplainNode } from "../core/index.js";

export interface NarrativeTerm {
  nodeId: string;          // for drill-down lookup
  label: string;           // visible text (drillable button label)
  formattedValue: string;  // e.g., "350 g" or "70.0 %"
}

export interface Narrative {
  text: string;            // HTML-safe sentence with `{{TERM:n}}` placeholders
  terms: NarrativeTerm[];  // bound to placeholders by index
}

function fmtValue(value: number | null, unit?: string): string {
  if (value == null) return "—";
  const n = unit === "%" ? value.toFixed(1) : Math.round(value * 100) / 100;
  return `${n}${unit ? " " + unit : ""}`;
}

function termFromChild(n: ExplainNode): NarrativeTerm {
  return {
    nodeId: n.id,
    label: n.label,
    formattedValue: fmtValue(n.value, hintUnit(n)),
  };
}

function hintUnit(n: ExplainNode): string | undefined {
  if (n.type === "Constant" && n.unit) return n.unit;
  // Ratio nodes that compute a percentage typically have a label including "%".
  if (n.type === "Ratio" && /%/.test(n.label)) return "%";
  return undefined;
}

export function renderNarrative(node: ExplainNode): Narrative {
  switch (node.type) {
    case "Constant":
      return {
        text: `${node.label} = {{TERM:0}}`,
        terms: [termFromChild(node)],
      };
    case "ProjectField":
      return {
        text: `${node.label} = {{TERM:0}}`,
        terms: [termFromChild(node)],
      };
    case "Sum": {
      const terms = node.terms.map(termFromChild);
      const placeholders = terms.map((_, i) => `{{TERM:${i}}}`);
      return {
        text: `${node.label} = ${placeholders.join(" + ")} = ${fmtValue(node.value)}`,
        terms,
      };
    }
    case "WeightedSum": {
      // Render each term as `(weight × value)`.
      const merged: NarrativeTerm[] = [];
      const fragments: string[] = [];
      for (let i = 0; i < node.terms.length; i++) {
        const t = node.terms[i]!;
        merged.push(termFromChild(t.weight), termFromChild(t.value));
        fragments.push(`(${`{{TERM:${merged.length - 2}}}`} × ${`{{TERM:${merged.length - 1}}}`})`);
      }
      return {
        text: `${node.label} = ${fragments.join(" + ")} = ${fmtValue(node.value)}`,
        terms: merged,
      };
    }
    case "Product": {
      const terms = node.factors.map(termFromChild);
      const placeholders = terms.map((_, i) => `{{TERM:${i}}}`);
      return {
        text: `${node.label} = ${placeholders.join(" × ")} = ${fmtValue(node.value)}`,
        terms,
      };
    }
    case "Ratio": {
      const num = termFromChild(node.numerator);
      const den = termFromChild(node.denominator);
      const unit = /%/.test(node.label) ? "%" : undefined;
      return {
        text: `${node.label} = {{TERM:0}} ÷ {{TERM:1}}${unit === "%" ? " × 100" : ""} = ${fmtValue(node.value, unit)}`,
        terms: [num, den],
      };
    }
    case "Scale": {
      const t = termFromChild(node.input);
      return {
        text: `${node.label} = {{TERM:0}} × ${node.factor} = ${fmtValue(node.value)}`,
        terms: [t],
      };
    }
    case "ProjectFromTree": {
      return {
        text: `${node.label} → ${fmtValue(node.value)}`,
        terms: [],
      };
    }
  }
}

/** Look up a node by id within a tree. Used for drill-down. */
export function findNode(root: ExplainNode, id: string): ExplainNode | null {
  if (root.id === id) return root;
  switch (root.type) {
    case "Sum":
    case "Product":
      for (const c of (root.type === "Sum" ? root.terms : root.factors)) {
        const found = findNode(c, id);
        if (found) return found;
      }
      return null;
    case "WeightedSum":
      for (const t of root.terms) {
        const f1 = findNode(t.weight, id); if (f1) return f1;
        const f2 = findNode(t.value, id);  if (f2) return f2;
      }
      return null;
    case "Ratio": {
      const f1 = findNode(root.numerator, id); if (f1) return f1;
      return findNode(root.denominator, id);
    }
    case "Scale":
      return findNode(root.input, id);
    case "ProjectField":
    case "ProjectFromTree":
    case "Constant":
      return null;
  }
}
