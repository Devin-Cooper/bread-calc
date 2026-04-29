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
  lines.push("");
  lines.push(bold("  Hydration"));
  const fmt = (n: number | null) => n == null ? "—" : `${n.toFixed(1)}%`;
  const lbl = (k: string, v: string, isHl = false) =>
    isHl ? bold(`    ${k.padEnd(20)} ${v}`) : `    ${k.padEnd(20)} ${v}`;
  lines.push(lbl("Effective hydration", fmt(h.effective_pct), headline === "effective"));
  lines.push(lbl("Nominal water",       fmt(h.nominal_pct),   headline === "nominal"));
  lines.push(lbl("Total liquid",        fmt(h.total_liquid_pct), headline === "total_liquid"));
  lines.push(`    ${"Zone".padEnd(20)} ${h.zone?.label ?? "—"}`);
  lines.push("");
  lines.push(bold("  Composition"));
  lines.push(`    ${"Salt-equivalent".padEnd(20)} ${fmt(c.bakers_percents.salt_equivalent_pct)}`);
  lines.push(`    ${"Sugar-equivalent".padEnd(20)} ${fmt(c.bakers_percents.sugar_equivalent_pct)}`);
  lines.push(`    ${"Fat-equivalent".padEnd(20)} ${fmt(c.bakers_percents.fat_equivalent_pct)}`);
  lines.push("");
  lines.push(`  ${"Predicted loaf".padEnd(22)} ${c.metrics.predicted_loaf_g} g`);
  lines.push("");
  if (c.warnings.length > 0) {
    lines.push(bold(`  Warnings (${c.warnings.length})`));
    for (const w of c.warnings) {
      lines.push(`    ${SEV[w.severity]!(`[${w.severity}]`)} ${w.code}: ${w.message}`);
      for (const f of w.suggested_fixes) {
        const desc =
          f.kind === "set_grams"        ? `set_grams uid=${f.uid} to ${f.grams} g` :
          f.kind === "increase_grams"   ? `increase_grams uid=${f.uid} by +${f.delta_g} g` :
          f.kind === "decrease_grams"   ? `decrease_grams uid=${f.uid} by ${f.delta_g} g` :
          f.kind === "set_bakers_pct"   ? `set_bakers_pct uid=${f.uid} to ${f.bakers_pct}%` :
          f.kind === "add_ingredient"   ? `add_ingredient ${f.ingredient_id}` :
          f.kind === "remove_ingredient"? `remove_ingredient uid=${f.uid}` :
          f.kind === "set_field"        ? `set_field ${f.field}=${JSON.stringify(f.value)}` :
          f.kind === "set_role"         ? `set_role uid=${f.uid} to ${f.role}` :
          (f as { kind: string }).kind;
        lines.push(`      → ${desc}  — ${(f as { rationale: string }).rationale}`);
      }
    }
    if (c.warnings.every((w) => w.suggested_fixes.length === 0)) {
      lines.push(`  No fixes suggested.`);
    }
  } else {
    lines.push(green("  No warnings."));
  }
  return lines.join("\n");
}
