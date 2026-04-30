import { warningRules } from "../core/registry/warnings.js";
import { fixKinds }     from "../core/registry/fixes.js";
import { explainNodeTypes } from "../core/registry/explain.js";
import { HYDRATION_ZONES } from "../core/zones.js";

// Vite's `define` substitutes IDENTIFIERS, not string literals, so we declare
// __TOOL_VERSION__ as an `ambient identifier` (typed via `declare`). The
// build-time substitution then replaces the bare identifier with a string
// literal expression. The TS-only `declare` keeps the typecheck happy for
// vitest (where `__TOOL_VERSION__` is also defined via vitest.config.ts).
declare const __TOOL_VERSION__: string;
const TOOL_VERSION: string = __TOOL_VERSION__;

export interface CapabilityManifest {
  tool_version: string;
  output_schema_version: "2.0";
  homepage: string;
  privacy: { network_calls: false };

  subcommands: SubcommandSpec[];
  warnings:    WarningRuleSpec[];
  fix_kinds:   FixKindSpec[];
  explain_node_types: ExplainNodeTypeSpec[];

  catalogs: {
    categories: string[];
    roles: string[];
    zones: ReturnType<typeof HYDRATION_ZONES.slice>;
    severities: Array<"info" | "warn" | "error">;
  };
}

export interface SubcommandSpec {
  name: string;
  description: string;
  args: Array<{ name: string; required: boolean; description: string }>;
  flags: Array<{ name: string; type: "boolean" | "string" | "number"; description: string }>;
  reads_recipe: boolean;
  emits_envelope: boolean;
  exit_codes: Record<number, string>;
}

export interface WarningRuleSpec {
  code: string;
  severity_default: "info" | "warn" | "error";
  category: "math" | "machine" | "ingredient" | "structural";
  description: string;
  consumes: string[];
  has_fixes: boolean;
}

export interface FixKindSpec {
  kind: string;
  description: string;
  payload_schema: Record<string, unknown>;
}

export interface ExplainNodeTypeSpec {
  type: string;
  description: string;
  schema: Record<string, unknown>;
}

const SUBCOMMANDS: SubcommandSpec[] = [
  { name: "compute", description: "Compute a recipe end-to-end (tree, metrics, hydration, breakdowns, warnings).", args: [{ name: "recipe", required: true, description: "Recipe file path or '-' for stdin." }], flags: [{ name: "json", type: "boolean", description: "Force JSON output." }, { name: "slim", type: "boolean", description: "Omit tree from output." }, { name: "metric", type: "string", description: "Headline metric (effective|nominal|total_liquid)." }], reads_recipe: true, emits_envelope: true, exit_codes: { 0: "ok", 1: "computed but recipe has error-severity warnings", 2: "schema validation failed", 3: "unknown ingredient_id", 64: "bad usage" } },
  { name: "solve",   description: "Solve a target_loaf_g recipe to fill grams from bakers_pct.", args: [{ name: "recipe", required: true, description: "Recipe file path or '-'." }], flags: [{ name: "target-g", type: "number", description: "Target loaf weight in grams." }, { name: "out", type: "string", description: "Write output to file." }], reads_recipe: true, emits_envelope: true, exit_codes: { 0: "ok", 2: "schema error", 3: "unknown ingredient", 4: "solver error" } },
  { name: "validate",description: "Validate a recipe against the v2.0 JSON schema.", args: [{ name: "recipe", required: true, description: "Recipe file path or '-'." }], flags: [{ name: "json", type: "boolean", description: "Force JSON output." }], reads_recipe: true, emits_envelope: true, exit_codes: { 0: "ok", 2: "schema error", 3: "unknown ingredient" } },
  { name: "plot",    description: "Render an SVG hydration chart.", args: [{ name: "recipe", required: true, description: "Recipe file path or '-'." }], flags: [{ name: "out", type: "string", description: "Write SVG to file." }, { name: "theme", type: "string", description: "light|dark." }], reads_recipe: true, emits_envelope: false, exit_codes: { 0: "ok", 2: "schema error" } },
  { name: "ingredients", description: "List bundled ingredients.", args: [], flags: [{ name: "category", type: "string", description: "Filter by category." }, { name: "search", type: "string", description: "Free-text filter." }, { name: "json", type: "boolean", description: "JSON output." }], reads_recipe: false, emits_envelope: true, exit_codes: { 0: "ok" } },
  { name: "reference",description: "List bundled BB-PDC20 reference recipes.", args: [], flags: [{ name: "course", type: "string", description: "Filter by course." }, { name: "zone", type: "string", description: "Filter by zone id." }, { name: "json", type: "boolean", description: "JSON output." }], reads_recipe: false, emits_envelope: true, exit_codes: { 0: "ok" } },
  { name: "schema",  description: "Output the v2.0 JSON schema.", args: [], flags: [], reads_recipe: false, emits_envelope: true, exit_codes: { 0: "ok" } },
  { name: "describe",description: "Output the self-describing capability manifest.", args: [], flags: [{ name: "section", type: "string", description: "warnings|fixes|explain|subcommands." }, { name: "json", type: "boolean", description: "JSON output." }], reads_recipe: false, emits_envelope: true, exit_codes: { 0: "ok" } },
  { name: "examples",description: "List or fetch curated example recipes.", args: [], flags: [{ name: "course", type: "string", description: "Filter by course." }, { name: "zone", type: "string", description: "Filter by zone id." }, { name: "id", type: "string", description: "Fetch a specific example by id." }, { name: "limit", type: "number", description: "Cap result count." }, { name: "json", type: "boolean", description: "JSON output." }], reads_recipe: false, emits_envelope: true, exit_codes: { 0: "ok" } },
  { name: "parse",   description: "Parse a free-text recipe into a v2.0 Recipe.", args: [{ name: "text-file", required: false, description: "Path to text file or '-' for stdin." }], flags: [{ name: "strict", type: "boolean", description: "Exit 7 on any unparseable line." }, { name: "json", type: "boolean", description: "JSON output." }], reads_recipe: false, emits_envelope: true, exit_codes: { 0: "ok", 7: "strict-mode unparseable lines" } },
  { name: "convert", description: "Convert qty unit ingredient_id → grams.", args: [{ name: "qty", required: true, description: "" }, { name: "unit", required: true, description: "" }, { name: "ingredient_id", required: true, description: "" }], flags: [{ name: "json", type: "boolean", description: "JSON output." }], reads_recipe: false, emits_envelope: true, exit_codes: { 0: "ok", 64: "bad usage" } },
  { name: "lookup",  description: "Fuzzy ingredient_id search.", args: [{ name: "query", required: true, description: "" }], flags: [{ name: "limit", type: "number", description: "Cap result count (default 12)." }, { name: "json", type: "boolean", description: "JSON output." }], reads_recipe: false, emits_envelope: true, exit_codes: { 0: "ok" } },
  { name: "apply",   description: "Apply a Fix to a Recipe and emit the new Recipe.", args: [{ name: "recipe", required: true, description: "Recipe file path or '-'." }, { name: "fix", required: false, description: "Fix file path (or use --fix=- or --fix-id)." }], flags: [{ name: "fix", type: "string", description: "Use '-' to read fix JSON from stdin." }, { name: "fix-id", type: "string", description: "Selector: <warning_code>.<index>" }, { name: "out", type: "string", description: "Write to file." }], reads_recipe: true, emits_envelope: true, exit_codes: { 0: "ok", 5: "fix application failed", 64: "bad usage" } },
  { name: "verify",  description: "Compare claimed metrics against computed truth.", args: [{ name: "claim", required: true, description: "Claim file: { recipe, claims }" }], flags: [{ name: "json", type: "boolean", description: "JSON output." }], reads_recipe: false, emits_envelope: true, exit_codes: { 0: "all match", 6: "at least one diverged" } },
  { name: "recommend", description: "Rank BB-PDC20 courses by fit for a recipe.", args: [{ name: "recipe", required: true, description: "Recipe file path or '-' for stdin." }], flags: [{ name: "intent", type: "string", description: "bake|dough — filter courses by intent." }, { name: "limit", type: "number", description: "Cap result rows in text output." }, { name: "json", type: "boolean", description: "Force JSON output." }, { name: "no-color", type: "boolean", description: "Disable ANSI color in text output." }], reads_recipe: true, emits_envelope: true, exit_codes: { 0: "at least one eligible course", 4: "all courses ineligible", 64: "bad usage" } },
];

export function describe(): CapabilityManifest {
  return {
    tool_version: TOOL_VERSION,
    output_schema_version: "2.0",
    homepage: "https://breadmachine.io/",
    privacy: { network_calls: false },
    subcommands: SUBCOMMANDS,
    warnings: warningRules.list().map((r) => ({
      code: r.code,
      severity_default: r.severity_default,
      category: r.category,
      description: r.description,
      consumes: [...r.consumes],
      // `has_fixes` reads the static flag declared on the WarningRule entry
      // (see Task 3.2: `has_fixes: true | false`). We do NOT probe by calling
      // `r.fixes(emptyCtx)` — most rules dereference `ctx.resolved` /
      // `ctx.computed.metrics.*` and crash on a null context.
      has_fixes: r.has_fixes,
    })),
    fix_kinds: fixKinds.list().map((k) => ({
      kind: k.kind, description: k.description, payload_schema: k.payload_schema,
    })),
    explain_node_types: explainNodeTypes.list().map((t) => ({
      type: t.type, description: t.description, schema: t.schema,
    })),
    catalogs: {
      categories: ["liquids","sweeteners","fats","fresh_fruit","dried_fruit","nuts_seeds","eggs","cheese","vegetables","herbs_spices","acids_alcohols","specialty","flour","salt","yeast","leavener"],
      roles: ["flour","wet","fat","sweetener","salt","yeast","leavener","inclusion","enrichment"],
      zones: HYDRATION_ZONES.slice(),
      severities: ["info","warn","error"],
    },
  };
}
