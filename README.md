# bread-calc

Hydration and loaf-weight calculator for the **Zojirushi BB-PDC20** (and similar 2-lb bread machines).
Live at **https://breadmachine.io/** — also a Node CLI (`npm i -g bread-calc`) and a library.

## Use the website
Open https://breadmachine.io/, edit the recipe, copy the share-URL, or click "Export PDF".

## Use the CLI
```sh
npm i -g bread-calc
bread-calc compute   my-recipe.bread.json
bread-calc compute   my-recipe.bread.json --slim --json | jq '.payload.hydration.effective_pct'
# (--slim drops the derivation tree from JSON output. Without it, large compute
#  outputs (~70KB+) can exceed the 64KB POSIX pipe buffer on macOS and truncate.
#  Drop --slim if you need the tree for verification/audit; pipe to a file in
#  that case (`--json > c.json`) rather than `| jq`.)
bread-calc solve     my-recipe.bread.json --target-g=900
bread-calc validate  my-recipe.bread.json
bread-calc plot      my-recipe.bread.json --out=plot.svg
bread-calc describe  --section=warnings
bread-calc examples  --course=White
bread-calc parse     my-recipe.txt
bread-calc convert   2 cups bread_flour
bread-calc lookup    "olive oil"
bread-calc apply     my-recipe.bread.json --fix-id=salt_too_high.0
bread-calc verify    my-claim.json
```

## Use the library
```ts
import { computeRecipe, validateRecipe, type Recipe } from "bread-calc";
import { parseText, applyFix, verifyClaims } from "bread-calc/agent";

const { recipe } = parseText("500 g bread_flour\n300 g water_tap\n9 g salt_table\n4 g yeast_instant");
const v = validateRecipe(recipe);
if (!v.valid) throw new Error(JSON.stringify(v.issues));
const computed = computeRecipe(recipe);
console.log(computed.hydration.effective_pct);
```

See [docs/agents.md](docs/agents.md) for LLM-agent usage (parse/apply/verify loop, exit codes, density bias), [docs/recipe-format.md](docs/recipe-format.md) for the JSON schema (Schema 2.0, uid requirement), [docs/mcp-design.md](docs/mcp-design.md) for the Wave 2 MCP server design, and [docs/privacy.md](docs/privacy.md) for the privacy-first stance.

## License
MIT
