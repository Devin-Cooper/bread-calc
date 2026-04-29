# Recipe format (Schema 2.0)

A recipe is a JSON document conforming to `bread-calc`'s JSON Schema (Draft 2020-12).

## Minimal example

```json
{
  "schema_version": "2.0",
  "items": [
    { "uid": "k7n3xl42", "ingredient_id": "bread_flour", "grams": 500 },
    { "uid": "m9p2qr87", "ingredient_id": "water_tap",   "grams": 300 },
    { "uid": "a1b4cd56", "ingredient_id": "salt_table",  "grams": 9   },
    { "uid": "z3x8yw01", "ingredient_id": "yeast_instant","grams": 4  }
  ]
}
```

## Top-level fields

| Field | Type | Required | Default |
|---|---|---|---|
| `schema_version` | `"2.0"` | Yes | — |
| `items` | `RecipeItem[]` | Yes (≥1) | — |
| `name` | string | No | — |
| `notes` | string | No | — |
| `machine` | string | No | `"zojirushi_bb_pdc20"` |
| `target_loaf_g` | number | No | — |
| `bake_loss_pct` | number | No | `13` |
| `free_water_factor_overrides` | `Record<string, number>` | No | — |
| `headline_metric` | `"effective" \| "nominal" \| "total_liquid"` | No | `"effective"` |

`schema_version` is a constant string — always `"2.0"`. It is not incremented between patch/minor releases; only a new major design revision would change it.

## `RecipeItem` fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `uid` | string | **Yes** | Stable item identity; see below |
| `ingredient_id` | string | Yes | Must match an entry in the ingredient catalog |
| `grams` | number | Conditional | Required in mode A; optional in mode B (see below) |
| `bakers_pct` | number | Conditional | Mode B only; used by solver |
| `role` | Role | No | Override the inferred role |

## `uid` — required item identity

Every `RecipeItem` must carry a `uid`. The uid is the stable identity for an item across edits and is used to correlate warnings, fixes, and tree nodes back to specific items.

**Format:** `^[A-Za-z0-9_-]{8,16}$`

Examples of valid uids: `k7n3xl42`, `flour-001`, `item_abc4`, `BREAD2026`

Rules:
- 8–16 characters.
- Characters: alphanumeric, underscore, hyphen.
- Must be unique within a recipe (two items must not share a uid).
- Once a recipe is persisted (e.g. saved to a file or URL), the uids should be stable; changing a uid is semantically equivalent to removing the old item and adding a new one.

**Generation guidance:** Use a short random alphanumeric string. `crypto.randomBytes(6).toString("base64url").slice(0, 8)` (Node.js) produces spec-compliant uids. The `parseText()` library function generates uids automatically; `bread-calc/agent`'s `applyFix({ kind: "add_ingredient" })` also generates one when `uid` is omitted from the fix payload.

## Mode A vs Mode B (`target_loaf_g`)

### Mode A — absolute grams (default)

All items specify `grams`. The calculator takes the recipe as-is and computes hydration, baker's percentages, and warnings. This is the default mode.

### Mode B — target loaf weight

When `target_loaf_g` is set, the solver scales the recipe to hit that finished-loaf mass:

- Each item must specify either `grams` (pinned) or `bakers_pct` (solver-controlled).
- At least one flour item with `bakers_pct` is required for the solver to have a degree of freedom.

**Constraint violations:**

| Code | Condition |
|---|---|
| `solver_overconstrained` | `target_loaf_g` is set but every item has `grams` — nothing for the solver to scale |
| `solver_ambiguous_flour` | At least one flour has fixed `grams` while another flour-role item has `bakers_pct` — the solver cannot determine a unique flour baseline |

These produce warnings with severity `"error"` and stop the solver from running. All other metrics are still computed from the as-given grams.

## Volumetric inputs and the density bias

When you use `convert` to convert cups/tablespoons/teaspoons into grams (before constructing a Recipe), be aware of a systematic ~1.4% bias:

- The `convert` function uses **1 cup = 240 ml** (the modern metric convention).
- The `density_g_per_cup` values in the ingredient database come from **USDA FoodData Central**, which was measured against the older U.S. legal cup of **236.5882365 ml**.

The net effect: for any ingredient whose density comes from USDA data (effectively all of them), converting "2 cups of bread flour" via `convert` will return approximately 1.4% more grams than you would get by measuring with a 236.5 ml cup.

**Practical guidance:**
- Prefer weighing in grams (the bias does not apply to `"grams"` or `"oz"` inputs).
- For recipe-book cup measurements, expect the grams to be slightly high; the computed hydration will be correspondingly high.
- The USDA densities are intentionally left unchanged in this package — altering them would shift all previously-calibrated hydration values.

## Reference data

`bb_pdc20_recipes.json` stores summary statistics only (name, course, total_water_g, total_flour_g, hydration_pct_nominal, zone) derived from the Zojirushi BB-PDC20 recipe booklet. Only aggregate values are stored — no full ingredient lists — to keep the dataset in factual/non-creative-expression territory.

## JSON Schema

The authoritative schema is available at:
- `bread-calc/schema` (npm subpath, after install)
- `https://breadmachine.io/schema.json` (live)
- `bread-calc schema` (CLI subcommand, prints the schema)

The schema enforces `schema_version: "2.0"`, the `uid` regex, and ingredient field constraints. `validateRecipe(recipe)` returns a `RecipeValidationResult` with an `issues[]` array; each issue has a `path`, `code`, and `message`.
