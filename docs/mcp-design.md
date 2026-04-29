# bread-calc MCP server (Wave 2 design)

## Status

This document describes the **planned** Model Context Protocol server, not yet implemented. Wave 1 (v2.0) library APIs were designed against this target so that the MCP surface is a near-1:1 wrapper with no contortions. Wave 2 will implement it as a separate package: `@bread-calc/mcp`.

This document is **normative** for v2.0: if a v2.0 API cannot be wrapped 1:1 into one of the tools below without rewriting logic, that is a v2.0 design bug to fix before shipping v2.0.

## Why a separate package

The MCP protocol surface is fundamentally different from a CLI dispatcher. It requires a JSON-RPC transport layer, a capability-negotiation handshake, and a server lifecycle that has no place inside the `bread-calc` core package. Keeping MCP in `@bread-calc/mcp` gives the MCP server a clean blast radius for protocol-level changes (transport upgrades, authentication, streaming) without touching the pure-math core. It also means the `bread-calc` npm package has zero JSON-RPC runtime dependencies — important for agents that import it in-process.

## Tools (1:1 mapping to v2.0 library entry points)

Each tool maps directly to a v2.0 library function. No extra logic lives in the MCP layer; the tool is a thin schema-validated wrapper that calls the library and returns the result.

### bread_compute

Compute hydration, baker's percentages, derivation tree, and warnings for a recipe.

| | |
|---|---|
| Input | `{ recipe: Recipe }` |
| Output | `ComputedRecipe` (v2.0 envelope-wrapped) |
| Maps to | `computeRecipe(recipe)` from `bread-calc` |

`ComputedRecipe` includes `metrics`, `hydration`, `bakers_percents`, `breakdowns`, `warnings` (with `suggested_fixes`), and `tree` (the full derivation tree).

### bread_solve

Scale a recipe to a target finished-loaf mass.

| | |
|---|---|
| Input | `{ recipe: Recipe, target_loaf_g?: number }` |
| Output | `SolveResult` — discriminated: `{ ok: true, recipe: Recipe }` or `{ ok: false, error: string }` |
| Maps to | `solveWithError(recipe)` from `bread-calc` |

If `target_loaf_g` is set on the input recipe, the solver uses it; the optional `target_loaf_g` parameter overrides it. Returns an error result for `solver_overconstrained` and `solver_ambiguous_flour` without throwing.

### bread_validate

Validate a recipe document against the JSON Schema (Draft 2020-12) and semantic rules.

| | |
|---|---|
| Input | `{ recipe: unknown }` |
| Output | `RecipeValidationResult` — `{ valid: boolean, issues: Array<{ path, code, message }> }` |
| Maps to | `validateRecipe(recipe)` from `bread-calc` |

Use this before `bread_compute` to get structured validation errors rather than thrown exceptions.

### bread_apply_fix

Apply a single structured fix delta to a recipe.

| | |
|---|---|
| Input | `{ recipe: Recipe, fix: Fix }` |
| Output | `ApplyFixResult` — discriminated: `{ ok: true, recipe: Recipe }` or `{ ok: false, error: ApplyFixError }` |
| Maps to | `applyFix(recipe, fix)` from `bread-calc/agent` |

`Fix` is a discriminated union keyed on `kind`: `set_grams`, `increase_grams`, `decrease_grams`, `set_bakers_pct`, `add_ingredient`, `remove_ingredient`, `set_field`, `set_role`. The `suggested_fixes` array on each `Warning` carries ready-to-use `Fix` values.

### bread_parse

Parse free-form text into a `Recipe` using the closed token grammar.

| | |
|---|---|
| Input | `{ text: string }` |
| Output | `{ recipe: Recipe, unparseable: ParseFailure[] }` |
| Maps to | `parseText(text)` from `bread-calc/agent` |

The closed grammar handles lines like `"500 g bread_flour"`, `"2 cups water_tap"`, `"1.5 tsp salt_table"`. Lines that do not match any pattern are returned in `unparseable[]` rather than throwing. Generated uids follow the `^[A-Za-z0-9_-]{8,16}$` format.

### bread_convert

Convert a single measurement to grams.

| | |
|---|---|
| Input | `{ qty: number, unit: string, ingredient_id: string }` |
| Output | `ConvertResult` — discriminated: `{ ok: true, grams: number, warnings: ConvertWarning[] }` or `{ ok: false, grams: null, warnings: ConvertWarning[] }` |
| Maps to | `convert(qty, unit, ingredient_id)` from `bread-calc/agent` |

Supported units: `g`, `kg`, `oz`, `lb`, `ml`, `l`, `tsp`, `tbsp`, `cups`. Volumetric conversions for non-liquid ingredients use `density_g_per_cup` from the ingredient catalog. See the **density bias note** in `docs/recipe-format.md` — the 240 ml cup definition creates a ~1.4% systematic over-estimate for USDA-sourced densities.

### bread_lookup_ingredient

Fuzzy-search the ingredient catalog.

| | |
|---|---|
| Input | `{ query: string, limit?: number }` |
| Output | `LookupResult[]` — each entry has `id`, `name`, `category`, `score` |
| Maps to | `lookupIngredient(query, { limit })` from `bread-calc/agent` |

Returns results ranked by match quality. Useful for resolving natural-language ingredient names (e.g. "olive oil" → `oil_olive`) before constructing a `RecipeItem`.

### bread_describe

Return the capability manifest built from the live registries.

| | |
|---|---|
| Input | `{ section?: "warnings" \| "fix_kinds" \| "explain_nodes" \| "subcommands" }` |
| Output | `CapabilityManifest` (full) or the specified section |
| Maps to | `describe()` from `bread-calc/agent` |

The manifest is the agent discovery primitive — call it once at startup to learn all known warning codes, fix kinds, explain node types, and CLI subcommand schemas. It is generated from the live registries and is always in sync with the running library version.

### bread_examples

Fetch curated seed recipes from the built-in example catalog.

| | |
|---|---|
| Input | `{ course?: string, zone?: ZoneId, id?: string }` |
| Output | `ExampleEntry[]` — each entry has `id`, `name`, `course`, `zone`, `recipe` |
| Maps to | `getExamples(filter)` from `bread-calc/agent` |

Example ids include: `classic_white`, `whole_wheat_basic`, `whole_wheat_high_hydration`, `multigrain_seeded`, `gluten_free_basic`, `enriched_butter_roll`, `vegan_olive_oil`, `salt_free_low_yeast`, `target_mode_900g`, `with_solver_warning`.

### bread_verify

Compare a set of claimed metric values against computed truth for a recipe.

| | |
|---|---|
| Input | `{ recipe: Recipe, claims: Record<string, number \| null> }` |
| Output | `VerifyReport` — `{ all_pass: boolean, results: Array<{ metric, claimed, actual, match, delta? }> }` |
| Maps to | `verifyClaims(recipe, claims)` from `bread-calc/agent` |

Claim keys are dot-path metric names into `ComputedRecipe` (e.g. `"hydration.effective_pct"`, `"metrics.total_flour_g"`). Use this as the terminal step in any agent verification chain.

### bread_build_tree

Build and return the derivation tree for a recipe without the full `ComputedRecipe` wrapper.

| | |
|---|---|
| Input | `{ recipe: Recipe }` |
| Output | `{ tree: ExplainTree }` |
| Maps to | `buildTree(recipe)` from `bread-calc` |

For agents that want to hand-walk the derivation (e.g. to render their own narrative or audit a specific computation path) without needing the rest of `ComputedRecipe`. The tree is a recursive `ExplainNode` structure with types: `Constant`, `ProjectField`, `Sum`, `WeightedSum`, `Product`, `Ratio`, `Scale`, `ProjectFromTree`.

### bread_evaluate_tree

Re-evaluate a derivation tree from leaves to root to verify cached node values.

| | |
|---|---|
| Input | `{ tree: ExplainTree }` |
| Output | `{ ok: boolean, mismatches: Array<{ node_id: string, stored: number \| null, recomputed: number \| null }> }` |
| Maps to | `evaluateTree(tree)` from `bread-calc` |

This is the trust-but-verify primitive. An agent can re-run the math from leaves to confirm that no cached values in a tree were tampered with or incorrectly serialized. Returns `ok: true` when all node values match their recomputed values.

### bread_plot

Render a hydration-zone chart as an SVG string.

| | |
|---|---|
| Input | `{ recipe: Recipe, theme?: "light" \| "dark" }` |
| Output | `{ svg: string }` |
| Maps to | `renderHydrationChart(computed, theme)` from `bread-calc` |

The SVG is approximately 3–5 KB. If agent context windows become a concern in practice, a base64 PNG alternative may be added in a future revision.

## Resources

The MCP server will expose the following resources:

| URI | Contents |
|---|---|
| `bread-calc://schema/recipe-v2` | JSON Schema for `Recipe` input (Schema 2.0) |
| `bread-calc://schema/output-v2` | JSON Schema for the output envelope |
| `bread-calc://catalog/manifest` | Full `describe()` output — all warnings, fixes, node types |
| `bread-calc://examples/{id}` | Single curated recipe by id |

## Prompts

An optional `verify-recipe-claim` prompt will walk an agent through the full verify loop (parse → compute → fix → verify) with an annotated sample recipe. This is deferred to Wave 2 implementation.

## Transport

- **stdio** (default) — suitable for local agent use, spawned as a subprocess.
- **HTTP** — optional, behind an environment flag (`BREAD_CALC_MCP_HTTP=1`). Useful for remote agents or shared tooling servers.

## Out of scope for Wave 2

- Authentication / authorization
- Multi-tenant state
- Streaming responses
- Persistent recipe storage
- Recipe version history
