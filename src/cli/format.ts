// src/cli/format.ts — colorized human-readable summary, no chalk dep
import type { ComputedRecipe } from "../core/index.js";

const noColor = process.env.NO_COLOR != null && process.env.NO_COLOR !== "";
const forceColor = process.env.FORCE_COLOR != null && process.env.FORCE_COLOR !== "";
function ansi(code: string, s: string): string {
  if (noColor || (!forceColor && !process.stdout.isTTY)) return s;
  return `\x1b[${code}m${s}\x1b[0m`;
}
const bold = (s: string) => ansi("1", s);
const red = (s: string) => ansi("31", s);
const yellow = (s: string) => ansi("33", s);
const blue = (s: string) => ansi("34", s);
const green = (s: string) => ansi("32", s);

const SEV: Record<string, (s: string) => string> = { error: red, warn: yellow, info: blue };

export function formatComputed(c: ComputedRecipe, headline: "effective" | "nominal" | "total_liquid"): string {
  const h = c.hydration;
  const lines: string[] = [];
  lines.push(bold(`${c.recipe.name ?? "Recipe"}`));
  const hLabel = (k: string, v: number | null | undefined) => `${k.padEnd(18)} ${v == null ? "—" : `${v.toFixed(1)}%`}`;
  lines.push(headline === "effective" ? bold(hLabel("Effective hydration", h.effective_pct)) : hLabel("Effective hydration", h.effective_pct));
  lines.push(headline === "nominal" ? bold(hLabel("Nominal water", h.nominal_pct)) : hLabel("Nominal water", h.nominal_pct));
  lines.push(headline === "total_liquid" ? bold(hLabel("Total liquid", h.total_liquid_pct)) : hLabel("Total liquid", h.total_liquid_pct));
  lines.push(`${"Zone".padEnd(18)} ${h.zone?.label ?? "—"}`);
  lines.push("");
  lines.push(bold("Composition"));
  lines.push(hLabel("Salt-equivalent", c.bakers_pcts.salt_equivalent_pct));
  lines.push(hLabel("Sugar-equivalent", c.bakers_pcts.sugar_equivalent_pct));
  lines.push(hLabel("Fat-equivalent", c.bakers_pcts.fat_equivalent_pct));
  lines.push("");
  lines.push(`${"Predicted loaf".padEnd(18)} ${c.totals.predicted_loaf_g} g`);
  lines.push("");
  if (c.warnings.length > 0) {
    lines.push(bold("Warnings"));
    for (const w of c.warnings) lines.push(SEV[w.severity]!(`[${w.severity}] ${w.code}: ${w.message}`));
  } else {
    lines.push(green("No warnings"));
  }
  return lines.join("\n");
}
