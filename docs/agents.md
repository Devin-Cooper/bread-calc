# Using bread-calc from an LLM agent

bread-calc gives an agent three ways to verify hydration math, all using the same JSON shape.

## 1. Library (preferred for in-process verification)

```ts
import { computeRecipe, validateRecipe, type Recipe } from "bread-calc";
const recipe: Recipe = { schema_version: "1.0", items: [
  { ingredient_id: "bread_flour", grams: 553 },
  { ingredient_id: "water_tap", grams: 326 },
] };
const v = validateRecipe(recipe);
if (!v.valid) throw new Error(JSON.stringify(v.issues));
const c = computeRecipe(recipe);
// c.hydration.effective_pct, c.warnings, c.bakers_pcts.salt_equivalent_pct, …
```

## 2. CLI (preferred when shelling out)

```sh
echo '{"schema_version":"1.0","items":[{"ingredient_id":"bread_flour","grams":553},{"ingredient_id":"water_tap","grams":326}]}' \
  | bread-calc compute - --json | jq '.hydration'
```

Exit codes: 0 ok, 1 dangerous warning, 2 schema error, 3 unknown ingredient, 64 bad usage.

## 3. JSON schema (no library install needed)

The schema at `https://breadmachine.io/schema.json` (or `bread-calc/schema`) lets any agent validate a recipe before claiming a hydration value.

## Verification pattern

To verify a math claim ("this recipe is 65% hydration"):
1. Construct the recipe as JSON.
2. `bread-calc compute --json | jq '.hydration.effective_pct'`.
3. Compare. If different, your math was wrong; if the same, agree.
