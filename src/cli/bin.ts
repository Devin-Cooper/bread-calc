import { parseArgs } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeRecipe, renderHydrationChart, solveWithError, validateRecipe, type Recipe, type Database } from "../core/index.js";
import { formatComputed } from "./format.js";
import { wrap } from "../core/envelope.js";
import { describe as describeManifest } from "../agent/describe.js";
import { formatDescribe } from "./format/describe.js";
import { getExamples } from "../agent/examples.js";
import { parseText } from "../agent/parse.js";
import { convert } from "../agent/convert.js";
import { lookupIngredient } from "../agent/lookup.js";
import { applyFix } from "../agent/fix.js";
import { verifyClaims } from "../agent/verify.js";
import { recommend } from "../agent/recommend.js";
import { formatRecommend } from "./format/recommend.js";
import type { Fix } from "../core/types.js";
import ingredientsFile from "../data/ingredients.json" with { type: "json" };
import floursFile from "../data/flours.json" with { type: "json" };
import refsFile from "../data/bb_pdc20_recipes.json" with { type: "json" };
import coursesFile from "../data/bb_pdc20_courses.json" with { type: "json" };
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
  bread-calc compute   <recipe.json> [--json] [--no-color] [--slim] [--metric=...]
  bread-calc solve     <recipe.json> [--target-g=N] [--out=...]
  bread-calc validate  <recipe.json> [--json]
  bread-calc plot      <recipe.json> [--out=...] [--theme=light|dark]
  bread-calc ingredients [--category=X] [--search=X] [--json]
  bread-calc reference [--course=X] [--zone=X] [--json]
  bread-calc schema
  bread-calc describe  [--section=warnings|fixes|explain|subcommands] [--json]
  bread-calc examples  [--course=X] [--zone=X] [--id=X] [--limit=N] [--json]
  bread-calc parse     [<text-file>|-] [--strict] [--json]
  bread-calc convert   <qty> <unit> <ingredient_id> [--json]
  bread-calc lookup    <query> [--limit=N] [--json]
  bread-calc apply     <recipe.json> [<fix.json>] [--fix=- | --fix-id=CODE.N] [--out=...]
  bread-calc verify    <claim.json> [--json]
  bread-calc recommend <recipe.json> [--intent=bake|dough] [--limit=N] [--json]
  bread-calc --version
  bread-calc --help

Filename "-" reads from stdin.
Exit codes: 0 ok, 1 dangerous warning, 2 schema error, 3 unknown ingredient,
            4 solver error, 5 fix application failed, 6 verification failed,
            7 strict-parse failure, 64 bad usage.
`;
}

const ALL_OPTIONS = {
  // common
  version:    { type: "boolean" as const },
  help:       { type: "boolean" as const },
  json:       { type: "boolean" as const },
  "no-color": { type: "boolean" as const },
  out:        { type: "string"  as const },
  // compute
  slim:       { type: "boolean" as const },
  metric:     { type: "string"  as const },
  // solve
  "target-g": { type: "string"  as const },
  // plot
  theme:      { type: "string"  as const },
  // ingredients/reference filters
  category:   { type: "string"  as const },
  search:     { type: "string"  as const },
  course:     { type: "string"  as const },
  zone:       { type: "string"  as const },
  // examples
  id:         { type: "string"  as const },
  limit:      { type: "string"  as const },  // parsed as number downstream
  // describe
  section:    { type: "string"  as const },
  // parse
  strict:     { type: "boolean" as const },
  // apply
  fix:        { type: "string"  as const },
  "fix-id":   { type: "string"  as const },
  // recommend
  intent:     { type: "string"  as const },
};

// Per-subcommand allow-list of flags. parseArgs is strict at the syntax level
// (rejects unknown flags entirely); this is strict at the semantic level
// (rejects flags not meaningful for the chosen subcommand).
const ALLOWED: Record<string, ReadonlyArray<keyof typeof ALL_OPTIONS>> = {
  compute:    ["json", "no-color", "slim", "metric"],
  solve:      ["json", "target-g", "out"],
  validate:   ["json"],
  plot:       ["out", "theme"],
  ingredients:["category", "search", "json"],
  reference:  ["course", "zone", "json"],
  schema:     [],
  describe:   ["section", "json"],
  examples:   ["course", "zone", "id", "limit", "json"],
  parse:      ["strict", "json"],
  convert:    ["json"],
  lookup:     ["limit", "json"],
  apply:      ["fix", "fix-id", "out", "json"],
  verify:     ["json"],
  recommend:  ["intent", "limit", "json", "no-color"],
};

const SUBCOMMANDS = Object.keys(ALLOWED);

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    strict: true,
    options: ALL_OPTIONS,
  });
} catch (e) {
  process.stderr.write(`bread-calc: ${(e as Error).message}\n`);
  process.exit(64);
}
const { values, positionals } = parsed;

if (values.version) { console.log(readPkg().version); process.exit(0); }
if (values.help) {
  console.log(helpText());
  process.exit(0);
}
if (positionals.length === 0) {
  console.log(helpText());
  process.exit(64);
}

const sub = positionals[0]!;
if (!SUBCOMMANDS.includes(sub)) {
  process.stderr.write(`bread-calc: unknown subcommand '${sub}'\n\n`);
  process.stderr.write(helpText());
  process.exit(64);
}

// Per-subcommand flag validation.
const allowed = new Set<string>(ALLOWED[sub]);
for (const k of Object.keys(values)) {
  if (k === "help" || k === "version") continue;
  if (!allowed.has(k)) {
    process.stderr.write(`bread-calc: flag --${k} is not valid for '${sub}'\n`);
    process.exit(64);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Bundle-time JSON imports lose their declared shape; the cast is intentional and
// the data is schema-validated at compile-time by scripts/transform-data.mjs.
const db: Database = {
  ingredients: (ingredientsFile as any).entries,
  flours:      (floursFile as any).entries,
  references:  (refsFile as any).entries,
  machines:    (machinesFile as any).entries,
  courses:     (coursesFile as any).entries,
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
      if (values.json) console.log(JSON.stringify(wrap("compute", readPkg().version, { ok: false, issues: v.issues }), null, 2));
      else process.stderr.write(`Unknown ingredient_id\n`);
      process.exit(3);
    }
    if (values.json) console.log(JSON.stringify(wrap("compute", readPkg().version, { ok: false, issues: v.issues }), null, 2));
    else process.stderr.write(`Schema validation failed: ${v.issues.length} issue(s)\n`);
    process.exit(2);
  }

  const computed = computeRecipe(parsed as Recipe, db);
  if (values.json || !process.stdout.isTTY) {
    const payload = values.slim ? (({ tree: _t, ...rest }) => rest)(computed) : computed;
    console.log(JSON.stringify(wrap("compute", readPkg().version, payload), null, 2));
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
    console.log(JSON.stringify(wrap("validate", readPkg().version, v), null, 2));
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
    if (values.json) console.log(JSON.stringify(wrap("solve", readPkg().version, { ok: false, issues: v.issues }), null, 2));
    else for (const i of v.issues) process.stderr.write(`${i.path}: ${i.code}: ${i.message}\n`);
    process.exit(v.issues.some((i) => i.code === "unknown_ingredient_id") ? 3 : 2);
  }

  const result = solveWithError(parsed as Recipe, db);
  if (result.error) {
    if (values.json) console.log(JSON.stringify(wrap("solve", readPkg().version, { ok: false, error: result.error }), null, 2));
    else process.stderr.write(`bread-calc: solver error: ${result.error}\n`);
    process.exit(result.error === "target_loaf_g_ignored_no_pcts" ? 0 : 4);
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

function dispatchPlot(positionals: string[]) {
  const raw = readInput(positionals[1]);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { process.stderr.write("bread-calc: invalid JSON\n"); process.exit(2); }

  const v = validateRecipe(parsed, db);
  if (!v.valid) {
    if (values.json) console.log(JSON.stringify({ ok: false, issues: v.issues }, null, 2));
    else for (const i of v.issues) process.stderr.write(`${i.path}: ${i.code}: ${i.message}\n`);
    process.exit(v.issues.some((i) => i.code === "unknown_ingredient_id") ? 3 : 2);
  }

  const computed = computeRecipe(parsed as Recipe, db);
  const theme: "light" | "dark" = values.theme === "dark" ? "dark" : "light";
  const svg = renderHydrationChart(computed, { reference: db.references, theme });

  if (values.out) {
    try { writeFileSync(values.out as string, svg); }
    catch (e) {
      process.stderr.write(`bread-calc: cannot write '${values.out}': ${(e as Error).message}\n`);
      process.exit(2);
    }
  } else {
    process.stdout.write(svg);
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
    console.log(JSON.stringify(wrap("ingredients", readPkg().version, list), null, 2));
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
    console.log(JSON.stringify(wrap("reference", readPkg().version, list), null, 2));
  } else {
    for (const r of list) console.log(`${r.name.padEnd(35)} ${r.course.padEnd(25)} ${r.hydration_pct_nominal}%  [${r.zone}]`);
  }
  process.exit(0);
}

function dispatchSchema(_positionals: string[]) {
  console.log(JSON.stringify(wrap("schema", readPkg().version, schemaJson), null, 2));
  process.exit(0);
}

function dispatchDescribe(_positionals: string[]) {
  const m = describeManifest();
  const section = values.section as string | undefined;
  let payload: unknown = m;
  if (section === "warnings") payload = m.warnings;
  else if (section === "fixes") payload = m.fix_kinds;
  else if (section === "explain") payload = m.explain_node_types;
  else if (section === "subcommands") payload = m.subcommands;
  else if (section) { process.stderr.write(`unknown section: ${section}\n`); process.exit(64); }
  if (values.json || !process.stdout.isTTY) {
    console.log(JSON.stringify(wrap("describe", readPkg().version, payload), null, 2));
  } else {
    console.log(formatDescribe(m, section));
  }
  process.exit(0);
}

function dispatchExamples(_positionals: string[]) {
  const filter: { course?: string; zone?: string; id?: string; limit?: number } = {};
  if (values.course) filter.course = values.course as string;
  if (values.zone)   filter.zone   = values.zone   as string;
  if (values.id)     filter.id     = values.id     as string;
  if (values.limit)  filter.limit  = parseInt(values.limit as string, 10);
  const list = getExamples(filter as never);
  if (values.json || !process.stdout.isTTY) {
    console.log(JSON.stringify(wrap("examples", readPkg().version, list), null, 2));
  } else {
    for (const e of list) console.log(`${e.id.padEnd(28)} ${e.course.padEnd(14)} ${e.zone.padEnd(10)} ${e.description}`);
  }
  process.exit(0);
}

function dispatchParse(positionals: string[]) {
  const path = positionals[1];
  const text = path && path !== "-" ? readFileSync(path, "utf8") : readFileSync(0, "utf8");
  const { recipe, unparseable } = parseText(text, db);
  if (values.strict && unparseable.length > 0) {
    if (values.json) {
      console.log(JSON.stringify(wrap("parse", readPkg().version, { ok: false, unparseable }), null, 2));
    } else {
      for (const u of unparseable) process.stderr.write(`line ${u.line}: ${u.reason}: ${u.raw}\n`);
    }
    process.exit(7);
  }
  if (values.json || !process.stdout.isTTY) {
    console.log(JSON.stringify(wrap("parse", readPkg().version, { recipe, unparseable }), null, 2));
  } else {
    console.log(JSON.stringify(recipe, null, 2));
    if (unparseable.length > 0) {
      process.stderr.write(`\n${unparseable.length} unparseable line(s):\n`);
      for (const u of unparseable) process.stderr.write(`  line ${u.line}: ${u.reason}: ${u.raw}\n`);
    }
  }
  process.exit(0);
}

function dispatchConvert(positionals: string[]) {
  const [, qtyStr, unit, ingId] = positionals;
  if (!qtyStr || !unit || !ingId) { process.stderr.write("bread-calc convert <qty> <unit> <ingredient_id>\n"); process.exit(64); }
  const qty = parseFloat(qtyStr);
  if (!Number.isFinite(qty)) { process.stderr.write(`bad qty: ${qtyStr}\n`); process.exit(64); }
  const r = convert({ qty, unit, ingredient_id: ingId }, db);
  if (values.json || !process.stdout.isTTY) {
    console.log(JSON.stringify(wrap("convert", readPkg().version, r), null, 2));
  } else if (r.ok) {
    console.log(`${r.grams} g`);
  } else {
    for (const w of r.warnings) process.stderr.write(`${w.code}: ${w.message}\n`);
    process.exit(64);
  }
  process.exit(0);
}

function dispatchLookup(positionals: string[]) {
  const query = positionals[1];
  if (!query) { process.stderr.write("bread-calc lookup <query>\n"); process.exit(64); }
  const limit = values.limit ? parseInt(values.limit as string, 10) : undefined;
  const r = lookupIngredient(query, { db, ...(limit !== undefined ? { limit } : {}) });
  if (values.json || !process.stdout.isTTY) {
    console.log(JSON.stringify(wrap("lookup", readPkg().version, r), null, 2));
  } else {
    for (const m of r) console.log(`${m.score.toFixed(2)} ${m.ingredient_id.padEnd(30)} ${m.name} (${m.match_reason})`);
  }
  process.exit(0);
}

function dispatchApply(positionals: string[]) {
  const recipePath = positionals[1];
  const fixPath = positionals[2];
  if (!recipePath) { process.stderr.write("bread-calc apply <recipe.json> [<fix.json>] [--fix=- | --fix-id=...]\n"); process.exit(64); }

  // Reject empty string for --fix-id explicitly (parseArgs accepts it).
  const fixIdValue = values["fix-id"] as string | undefined;
  if (fixIdValue !== undefined && fixIdValue.length === 0) {
    process.stderr.write("bread-calc apply: --fix-id requires a value (e.g. --fix-id=salt_too_high.0)\n");
    process.exit(64);
  }
  const fixStdin = values.fix as string | undefined;
  if (fixStdin !== undefined && fixStdin !== "-") {
    process.stderr.write("bread-calc apply: --fix only accepts '-' (stdin); pass a path positionally instead\n");
    process.exit(64);
  }

  // Mutual exclusion: exactly one of fixPath / --fix=- / --fix-id must be supplied.
  const modes = [
    fixPath !== undefined,
    fixStdin !== undefined,
    fixIdValue !== undefined,
  ];
  if (modes.filter(Boolean).length !== 1) {
    process.stderr.write("bread-calc apply: supply exactly one of <fix.json> | --fix=- | --fix-id=<code>.<n>\n");
    process.exit(64);
  }

  const recipeRaw = recipePath === "-" ? readFileSync(0, "utf8") : readFileSync(recipePath, "utf8");
  const recipe = JSON.parse(recipeRaw);
  let fix: Fix;
  if (fixIdValue) {
    // Selector grammar (per spec §4.2): split on the LAST `.`. <code> matches
    // [a-z_]+; <index> matches \d+. Malformed input → exit 64 (bad usage),
    // distinct from exit 5 (fix didn't apply to a real warning on this recipe).
    const sel = fixIdValue;
    const lastDot = sel.lastIndexOf(".");
    if (lastDot <= 0 || lastDot === sel.length - 1) {
      process.stderr.write(`apply: malformed --fix-id "${sel}"; expected <code>.<index>\n`);
      process.exit(64);
    }
    const code = sel.slice(0, lastDot);
    const idxStr = sel.slice(lastDot + 1);
    if (!/^[a-z_]+$/.test(code) || !/^\d+$/.test(idxStr)) {
      process.stderr.write(`apply: malformed --fix-id "${sel}"; <code> must match [a-z_]+ and <index> must match \\d+\n`);
      process.exit(64);
    }
    const idx = parseInt(idxStr, 10);
    const computed = computeRecipe(recipe, db);
    const w = computed.warnings.find((x) => x.code === code);
    if (!w) { process.stderr.write(`apply: no warning with code "${code}" on this recipe\n`); process.exit(5); }
    if (idx < 0 || idx >= w.suggested_fixes.length) {
      process.stderr.write(`apply: warning ${code} has ${w.suggested_fixes.length} fixes; index ${idx} out of range\n`);
      process.exit(5);
    }
    fix = w.suggested_fixes[idx]!;
  } else if (fixStdin === "-") {
    fix = JSON.parse(readFileSync(0, "utf8"));
  } else {
    fix = JSON.parse(readFileSync(fixPath!, "utf8"));
  }

  const result = applyFix(recipe, fix);
  if (!result.ok) {
    process.stderr.write(`apply: ${result.error.code}: ${result.error.message}\n`);
    process.exit(5);
  }

  if (values.out) {
    // Raw recipe to file — chains into compute/solve/etc.
    writeFileSync(values.out as string, JSON.stringify(result.recipe, null, 2));
  } else if (values.json || !process.stdout.isTTY) {
    // Envelope to stdout when piped or JSON requested.
    console.log(JSON.stringify(wrap("apply", readPkg().version, result.recipe), null, 2));
  } else {
    // Human TTY: also envelope-wrap for consistency. (No bespoke human formatter for apply yet.)
    console.log(JSON.stringify(wrap("apply", readPkg().version, result.recipe), null, 2));
  }
  process.exit(0);
}

function dispatchVerify(positionals: string[]) {
  const path = positionals[1];
  if (!path) { process.stderr.write("bread-calc verify <claim.json>\n"); process.exit(64); }
  const claim = JSON.parse(path === "-" ? readFileSync(0, "utf8") : readFileSync(path, "utf8"));
  if (!claim.recipe || !claim.claims) { process.stderr.write("verify: claim must have { recipe, claims }\n"); process.exit(64); }
  const report = verifyClaims(claim.recipe, claim.claims, db);
  if (values.json || !process.stdout.isTTY) {
    console.log(JSON.stringify(wrap("verify", readPkg().version, report), null, 2));
  } else {
    for (const r of report.results) {
      console.log(`${r.match ? "OK " : "DIFF"} ${r.metric_path.padEnd(40)} claim=${r.claim} actual=${r.actual} diff=${r.diff}`);
    }
  }
  process.exit(report.all_match ? 0 : 6);
}

function dispatchRecommend(positionals: string[]) {
  const path = positionals[1];
  if (!path) {
    process.stderr.write("usage: bread-calc recommend <recipe.json> [--intent=bake|dough] [--limit=N] [--json]\n");
    process.exit(64);
  }
  const recipeText = path === "-" ? readFileSync(0, "utf8") : readFileSync(path, "utf8");
  const recipe = JSON.parse(recipeText) as Recipe;
  const intentFlag = values["intent"];
  const intent: "bake" | "dough" | undefined =
    intentFlag === "bake" ? "bake" : intentFlag === "dough" ? "dough" : undefined;
  const limit = values["limit"] !== undefined ? parseInt(String(values["limit"]), 10) : undefined;
  const result = recommend(recipe, db, intent !== undefined ? { intent } : undefined);
  const allIneligible = result.recommendations.every((r) => !r.eligible);
  if (values["json"]) {
    console.log(JSON.stringify(wrap("recommend", readPkg().version, result), null, 2));
  } else {
    const noColor = Boolean(values["no-color"]);
    const formatOpts: { limit?: number; noColor?: boolean } = { noColor };
    if (limit !== undefined) formatOpts.limit = limit;
    console.log(formatRecommend(result.recommendations, db, formatOpts));
  }
  process.exit(allIneligible ? 4 : 0);
}

type Handler = (positionals: string[]) => void;
const HANDLERS: Record<string, Handler> = {
  compute:     dispatchCompute,
  validate:    dispatchValidate,
  solve:       dispatchSolve,
  ingredients: dispatchIngredients,
  reference:   dispatchReference,
  schema:      dispatchSchema,
  plot:        dispatchPlot,
  describe:    dispatchDescribe,
  examples:    dispatchExamples,
  parse:       dispatchParse,
  convert:     dispatchConvert,
  lookup:      dispatchLookup,
  apply:       dispatchApply,
  verify:      dispatchVerify,
  recommend:   dispatchRecommend,
};
const handler = HANDLERS[sub];
if (handler) handler(positionals);
else { process.stderr.write(`bread-calc: '${sub}' not yet implemented\n`); process.exit(64); }
