import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeRecipe, validateRecipe, type Recipe, type Database } from "../core/index.js";
import ingredientsFile from "../data/ingredients.json" with { type: "json" };
import floursFile from "../data/flours.json" with { type: "json" };
import refsFile from "../data/bb_pdc20_recipes.json" with { type: "json" };
import machinesFile from "../data/machines.json" with { type: "json" };
import defaultsRaw from "../data/defaults.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readPkg() {
  // dist/cli/bin.js → ../../package.json after build; src/cli/bin.ts → ../../package.json in dev
  for (const candidate of ["../package.json", "../../package.json"]) {
    try { return JSON.parse(readFileSync(join(__dirname, candidate), "utf8")); } catch { /* ignore */ }
  }
  return { version: "0.0.0" };
}

function helpText(): string {
  return `bread-calc — hydration and loaf-weight calculator for the Zojirushi BB-PDC20

Usage:
  bread-calc compute      <recipe.bread.json> [--json] [--no-color] [--metric=effective|nominal|total_liquid]
  bread-calc solve        <recipe.bread.json> [--target-g=900] [--out=solved.bread.json]
  bread-calc validate     <recipe.bread.json>
  bread-calc plot         <recipe.bread.json> [--out=plot.svg] [--theme=light|dark]
  bread-calc ingredients  [--category=<cat>] [--search=<q>] [--json]
  bread-calc reference    [--course=<n>] [--zone=<id>] [--json]
  bread-calc schema       [--type=ingredient|recipe|computed]
  bread-calc --version
  bread-calc --help

Filename "-" reads from stdin.
Exit codes: 0 ok, 1 dangerous warning, 2 schema error, 3 unknown ingredient, 64 bad usage.
`;
}

const SUBCOMMANDS = ["compute", "solve", "validate", "plot", "ingredients", "reference", "schema"];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  strict: true,
  options: {
    version: { type: "boolean" },
    help: { type: "boolean" },
    json: { type: "boolean" },
    "no-color": { type: "boolean" },
    metric: { type: "string" },
    "target-g": { type: "string" },
    out: { type: "string" },
    theme: { type: "string" },
    category: { type: "string" },
    search: { type: "string" },
    course: { type: "string" },
    zone: { type: "string" },
    type: { type: "string" },
  },
});

if (values.version) {
  console.log(readPkg().version);
  process.exit(0);
}
if (values.help || positionals.length === 0) {
  console.log(helpText());
  process.exit(positionals.length === 0 ? 64 : 0);
}

const sub = positionals[0]!;
if (!SUBCOMMANDS.includes(sub)) {
  console.error(`bread-calc: unknown subcommand '${sub}'\n`);
  console.error(helpText());
  process.exit(64);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Bundle-time JSON imports lose their declared shape; the cast is intentional and
// the data is schema-validated at compile-time by scripts/transform-data.mjs.
const db: Database = {
  ingredients: (ingredientsFile as any).entries,
  flours:      (floursFile as any).entries,
  references:  (refsFile as any).entries,
  machines:    (machinesFile as any).entries,
  defaults:    defaultsRaw as any,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

function readInput(arg: string | undefined): string {
  if (!arg) { process.stderr.write("bread-calc: missing argument\n"); process.exit(64); }
  if (arg === "-") return readFileSync(0, "utf8");
  return readFileSync(arg, "utf8");
}

function dispatchCompute() {
  const file = positionals[1];
  const raw = readInput(file);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { process.stderr.write("bread-calc: invalid JSON\n"); process.exit(2); }

  const v = validateRecipe(parsed, db);
  if (!v.valid) {
    if (v.issues.some((i) => i.code === "unknown_ingredient_id")) {
      if (values.json) console.log(JSON.stringify({ ok: false, issues: v.issues }, null, 2));
      else process.stderr.write(`Unknown ingredient_id\n`);
      process.exit(3);
    }
    if (values.json) console.log(JSON.stringify({ ok: false, issues: v.issues }, null, 2));
    else process.stderr.write(`Schema validation failed: ${v.issues.length} issue(s)\n`);
    process.exit(2);
  }

  const computed = computeRecipe(parsed as Recipe, db);
  if (values.json || !process.stdout.isTTY) {
    console.log(JSON.stringify(computed, null, 2));
  } else {
    // Human-readable summary deferred to Task 2.5
    console.log(`Effective hydration: ${computed.hydration.effective_pct ?? "—"}%`);
    console.log(`Predicted loaf:      ${computed.totals.predicted_loaf_g} g`);
    for (const w of computed.warnings) console.log(`[${w.severity}] ${w.code}: ${w.message}`);
  }
  if (computed.warnings.some((w) => w.severity === "error")) process.exit(1);
  process.exit(0);
}

if (sub === "compute") dispatchCompute();
else { console.error(`bread-calc: '${sub}' not yet implemented`); process.exit(64); }
