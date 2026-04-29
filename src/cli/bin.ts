import { parseArgs } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeRecipe, solveWithError, validateRecipe, type Recipe, type Database } from "../core/index.js";
import { formatComputed } from "./format.js";
import ingredientsFile from "../data/ingredients.json" with { type: "json" };
import floursFile from "../data/flours.json" with { type: "json" };
import refsFile from "../data/bb_pdc20_recipes.json" with { type: "json" };
import machinesFile from "../data/machines.json" with { type: "json" };
import defaultsRaw from "../data/defaults.json" with { type: "json" };
import schemaJson from "../data/schema.json" with { type: "json" };

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
  bread-calc schema
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

function dispatchCompute(positionals: string[]) {
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
    const VALID_METRICS = ["effective", "nominal", "total_liquid"] as const;
    type Metric = typeof VALID_METRICS[number];
    const cliMetric = values.metric;
    const recipeMetric = (parsed as Recipe).headline_metric;
    const headlinePref: Metric = (VALID_METRICS as readonly string[]).includes(cliMetric ?? "")
      ? (cliMetric as Metric)
      : (recipeMetric ?? "effective");
    console.log(formatComputed(computed, headlinePref));
  }
  if (computed.warnings.some((w) => w.severity === "error")) process.exit(1);
  process.exit(0);
}

function dispatchValidate(positionals: string[]) {
  const raw = readInput(positionals[1]);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { process.stderr.write("bread-calc: invalid JSON\n"); process.exit(2); }

  const v = validateRecipe(parsed, db);
  if (values.json) {
    console.log(JSON.stringify(v, null, 2));
    if (v.valid) process.exit(0);
    process.exit(v.issues.some((i) => i.code === "unknown_ingredient_id") ? 3 : 2);
  }
  if (v.valid) { console.log("OK"); process.exit(0); }
  for (const i of v.issues) process.stderr.write(`${i.path}: ${i.code}: ${i.message}\n`);
  process.exit(v.issues.some((i) => i.code === "unknown_ingredient_id") ? 3 : 2);
}

function dispatchSolve(positionals: string[]) {
  const raw = readInput(positionals[1]);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { process.stderr.write("bread-calc: invalid JSON\n"); process.exit(2); }

  if (values["target-g"] != null) {
    const target = parseFloat(values["target-g"] as string);
    if (!Number.isFinite(target) || target <= 0) {
      process.stderr.write(`bread-calc: --target-g must be a positive number (got '${values["target-g"]}')\n`);
      process.exit(64);
    }
    if (typeof parsed !== "object" || parsed === null) {
      process.stderr.write("bread-calc: recipe must be a JSON object\n");
      process.exit(2);
    }
    (parsed as Record<string, unknown>).target_loaf_g = target;
  }

  const v = validateRecipe(parsed, db);
  if (!v.valid) {
    if (values.json) console.log(JSON.stringify({ ok: false, issues: v.issues }, null, 2));
    else for (const i of v.issues) process.stderr.write(`${i.path}: ${i.code}: ${i.message}\n`);
    process.exit(v.issues.some((i) => i.code === "unknown_ingredient_id") ? 3 : 2);
  }

  const result = solveWithError(parsed as Recipe, db);
  if (result.error) {
    if (values.json) console.log(JSON.stringify({ ok: false, error: result.error }, null, 2));
    else process.stderr.write(`bread-calc: solver error: ${result.error}\n`);
    process.exit(2);
  }

  const out = JSON.stringify(result.recipe, null, 2);
  if (values.out) {
    try { writeFileSync(values.out as string, out); }
    catch (e) {
      process.stderr.write(`bread-calc: cannot write '${values.out}': ${(e as Error).message}\n`);
      process.exit(2);
    }
  } else {
    console.log(out);
  }
  process.exit(0);
}

function dispatchIngredients(_positionals: string[]) {
  let list = [...db.ingredients];
  if (values.category) list = list.filter((i) => i.category === values.category);
  if (values.search) {
    const q = (values.search as string).toLowerCase();
    list = list.filter((i) => (i.id + " " + i.name).toLowerCase().includes(q));
  }
  if (values.json || !process.stdout.isTTY) {
    console.log(JSON.stringify(list, null, 2));
  } else {
    for (const i of list) console.log(`${i.id.padEnd(30)} ${i.category.padEnd(15)} water=${i.water_pct}%`);
  }
  process.exit(0);
}

function dispatchReference(_positionals: string[]) {
  let list = [...db.references];
  if (values.course) {
    const q = (values.course as string).toLowerCase();
    list = list.filter((r) => r.course.toLowerCase().includes(q));
  }
  if (values.zone) list = list.filter((r) => r.zone === values.zone);
  if (values.json || !process.stdout.isTTY) {
    console.log(JSON.stringify(list, null, 2));
  } else {
    for (const r of list) console.log(`${r.name.padEnd(35)} ${r.course.padEnd(25)} ${r.hydration_pct_nominal}%  [${r.zone}]`);
  }
  process.exit(0);
}

function dispatchSchema(_positionals: string[]) {
  console.log(JSON.stringify(schemaJson, null, 2));
  process.exit(0);
}

type Handler = (positionals: string[]) => void;
const HANDLERS: Record<string, Handler> = {
  compute:     dispatchCompute,
  validate:    dispatchValidate,
  solve:       dispatchSolve,
  ingredients: dispatchIngredients,
  reference:   dispatchReference,
  schema:      dispatchSchema,
  plot:        () => { process.stderr.write("bread-calc: 'plot' is added in v0.6.0\n"); process.exit(64); },
};
const handler = HANDLERS[sub];
if (handler) handler(positionals);
else { process.stderr.write(`bread-calc: '${sub}' not yet implemented\n`); process.exit(64); }
