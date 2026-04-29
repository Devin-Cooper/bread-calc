import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

// Stub — real handlers wired in later tasks
console.error(`bread-calc: '${sub}' not yet implemented`);
process.exit(64);
