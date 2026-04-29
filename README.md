# bread-calc

Hydration and loaf-weight calculator for the **Zojirushi BB-PDC20** (and similar 2-lb bread machines).
Live at **https://breadmachine.io/** — also a Node CLI (`npm i -g bread-calc`) and a library.

## Use the website
Open https://breadmachine.io/, edit the recipe, copy the share-URL, or click "Export PDF".

## Use the CLI
```sh
npm i -g bread-calc
bread-calc compute my-recipe.bread.json
bread-calc compute my-recipe.bread.json --json | jq '.hydration.effective_pct'
bread-calc solve my-recipe.bread.json --target-g=900
bread-calc validate my-recipe.bread.json
bread-calc plot my-recipe.bread.json --out=plot.svg
```

## Use the library
```ts
import { computeRecipe, validateRecipe, type Recipe } from "bread-calc";
const recipe: Recipe = JSON.parse(fs.readFileSync("recipe.bread.json", "utf8"));
const v = validateRecipe(recipe);
if (!v.valid) throw new Error(JSON.stringify(v.issues));
const computed = computeRecipe(recipe);
console.log(computed.hydration.effective_pct);
```

See [docs/agents.md](docs/agents.md) for LLM-agent usage, [docs/recipe-format.md](docs/recipe-format.md) for the JSON schema, and [docs/privacy.md](docs/privacy.md) for the privacy-first stance.

## License
MIT
