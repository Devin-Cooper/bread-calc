# Using bread-calc from an LLM agent

bread-calc v2.0 is designed first-class for agent use: every JSON output carries a `_meta` envelope, warnings include structured `suggested_fixes`, and a complete discovery/parse/fix/verify loop is available without out-of-band knowledge.

## 1. Library imports

The library ships two entry points:

```ts
// Core functions (compute, solve, validate, plot, data)
import { computeRecipe, validateRecipe, solveRecipe } from "bread-calc";

// Agent surfaces (parse, convert, lookup, apply, verify, describe, examples)
import {
  parseText,
  convert,
  lookupIngredient,
  applyFix,
  verifyClaims,
  describe,
  getExamples,
  renderNarrative,
} from "bread-calc/agent";

// Types (re-exported from bread-calc/agent so you don't need to reach into bread-calc directly)
import type { Recipe, ComputedRecipe, Fix, ApplyFixResult, VerifyReport } from "bread-calc/agent";
```

## 2. The verify loop — end-to-end worked example

### Step 1: Parse free text into a Recipe

```ts
import { parseText } from "bread-calc/agent";

const { recipe, unparseable } = parseText(`
  500 g bread_flour
  300 g water_tap
  1.5 tsp salt_table
  1 tsp yeast_instant
`);
// recipe.schema_version === "2.0"
// recipe.items[0].uid is generated (e.g. "k7n3xl42")
// unparseable[] lists any lines the parser could not resolve
```

### Step 2: Compute and inspect warnings

```ts
import { computeRecipe } from "bread-calc";

const computed = computeRecipe(recipe);
console.log(computed.hydration.effective_pct);   // 60
console.log(computed.warnings);
// Example output:
// [
//   {
//     code: "salt_too_high",
//     severity: "warn",
//     message: "Salt is 2.3% of flour (recommended ≤ 2%).",
//     related_uids: ["k7n3xl42"],
//     suggested_fixes: [
//       {
//         kind: "set_grams",
//         uid: "k7n3xl42",
//         grams: 9,
//         rationale: "Reduce to 1.8% of flour (9 g)"
//       }
//     ]
//   }
// ]
```

### Step 3: Apply a suggested fix

```ts
import { applyFix } from "bread-calc/agent";

const warning = computed.warnings.find(w => w.code === "salt_too_high")!;
const fix = warning.suggested_fixes[0];

const result = applyFix(recipe, fix);
if (!result.ok) {
  throw new Error(`applyFix failed: ${result.error.message}`);
}
const fixedRecipe = result.recipe;
```

### Step 4: Re-compute and verify a claim

```ts
import { verifyClaims } from "bread-calc/agent";

const recomputed = computeRecipe(fixedRecipe);
// No more salt_too_high warning

const report = verifyClaims(fixedRecipe, {
  "hydration.effective_pct": 60,
  "metrics.total_flour_g": 500,
});
// report.all_pass: true
// report.results[0].claimed: 60, report.results[0].actual: 60, report.results[0].match: true

if (!report.all_pass) {
  const failing = report.results.filter(r => !r.match);
  console.error("Claims failed:", failing);
}
```

`verifyClaims` accepts a flat `Record<string, number | null>` where keys are dot-path metric names into `ComputedRecipe`. Use it as the final step in any agent reasoning chain to confirm computed truth matches a claimed value before presenting a result to a user.

## 3. The `describe()` capability manifest

`describe()` returns a `CapabilityManifest` — a self-describing document built from the live warning, fix-kind, and explain-node registries. Use it as your discovery primitive before doing any work:

```ts
import { describe } from "bread-calc/agent";

const manifest = describe();
// manifest.warnings[]     — all known warning codes + severity + message template
// manifest.fix_kinds[]    — all known fix kinds + parameter shapes
// manifest.explain_nodes[] — all explain node types
// manifest.subcommands[]  — CLI subcommands with argument/option schemas
```

Via CLI:

```sh
bread-calc describe
bread-calc describe --section=warnings
bread-calc describe --section=fix_kinds --json
```

The manifest drives the CLI's `--help` generation and is the authoritative catalog for what the library can produce. An agent should call `describe()` once at startup (or when encountering an unfamiliar warning code) rather than hard-coding knowledge of the registry.

## 4. Exit codes

| Code | Meaning |
|------|---------|
| 0 | OK |
| 1 | Dangerous warning (`severity: "error"`) present in compute output |
| 2 | Schema / validation error |
| 3 | Unknown ingredient ID |
| 4 | Solver error (e.g. `solver_overconstrained`) |
| 5 | Fix application failed |
| 6 | Verification failed (`verifyClaims` returned `all_pass: false`) |
| 7 | Strict-parse failure (`parse --strict` with unparseable lines) |
| 64 | Bad CLI usage (unknown flag, missing argument) |

Exit codes 4–7 are new in v2.0. Agents shelling out to the CLI should switch on all of 0–7, not just 0/1/2/3.

## 5. Unit conversion and the 240 ml cup convention

`convert` uses a canonical 1 cup = 240 ml for all unit-table arithmetic:

```ts
import { convert } from "bread-calc/agent";

const result = convert(2, "cups", "bread_flour");
// result.ok: true
// result.grams: 240 (2 × 120 g/cup density)
```

**USDA density bias note.** The `density_g_per_cup` values in the ingredient database come from USDA FoodData Central, which was measured against the older U.S. legal cup of 236.5882365 ml. The `convert` function applies 240 ml as the cup definition. This produces a systematic ~1.4% over-estimate on any volumetric input that goes through a density lookup (e.g. cups of flour → grams). For gravimetric inputs (weights in grams or ounces) the bias does not apply.

Practical guidance:
- Prefer weighing ingredients in grams whenever possible.
- When converting from cups, note that the computed grams will be ~1.4% higher than a measurement taken with a 236.5 ml cup.
- The bias is documented here and in `docs/recipe-format.md`; the USDA densities are intentionally left unchanged to preserve hydration calibration continuity from v1.x.

## 6. CLI quick-reference

```sh
bread-calc parse recipe.txt --json       # free text → Recipe JSON
bread-calc convert 2 cups bread_flour    # unit → grams
bread-calc lookup "olive oil"            # fuzzy ingredient search
bread-calc compute recipe.json --json    # compute hydration + warnings
bread-calc apply recipe.json --fix-id=salt_too_high.0   # apply fix by index
bread-calc verify claim.json             # compare claims to computed truth
bread-calc describe --section=warnings   # capability manifest
bread-calc examples --zone=wet           # curated seed recipes
```

All JSON outputs wrap payload in an envelope:
```json
{
  "_meta": { "output_schema_version": "2.0", "tool": "bread-calc", "version": "2.0.0" },
  "ok": true,
  "payload": { ... }
}
```

The `_meta.output_schema_version` field lets agents feature-detect v2.0 vs v1.x output without parsing the payload shape.
