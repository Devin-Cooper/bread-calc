#!/usr/bin/env node
// Reads src/agent/examples-source.ts directly (Node ≥22.6 strips TS types
// natively; we don't depend on a built artifact). Validates each recipe,
// computes expected_metrics, writes .bread.json files and an index.json
// into src/agent/examples/.
//
// IMPORTANT: this script runs *before* the multi-entry build exists
// (Phase 9). It deliberately does NOT import from dist/lib/agent/* — that
// path is only populated by Phase 9. Instead, we import:
//   - the source TS for examples-source (Node strips types via the
//     --experimental-strip-types flag passed in package.json)
//   - the already-built dist/lib/index.js (for computeRecipe/validateRecipe)
//   - the already-built dist/lib/data/index.js (for the bundled db)
// Both `dist/lib/index.js` and `dist/lib/data/index.js` are produced by the
// PRE-`build:examples` steps in `pretest` (build:lib + transform:data).
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const { EXAMPLE_SOURCES } = await import("../src/agent/examples-source.ts");
const { computeRecipe, validateRecipe } = await import("../dist/lib/index.js");
const { ingredients, flours, BB_PDC20_RECIPES, machines, defaults } = await import("../dist/lib/data/index.js");

const db = { ingredients, flours, references: BB_PDC20_RECIPES, machines, defaults };

const OUT_DIR = "src/agent/examples";
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const indexEntries = [];
for (const src of EXAMPLE_SOURCES) {
  const v = validateRecipe(src.recipe, db);
  if (!v.valid) {
    console.error(`example "${src.id}" failed validation:`);
    for (const i of v.issues) console.error(`  ${i.path}: ${i.code}: ${i.message}`);
    process.exit(1);
  }
  const c = computeRecipe(src.recipe, db);
  const expected_metrics = {
    hydration_effective_pct: c.hydration.effective_pct,
    hydration_zone:          c.hydration.zone?.id ?? null,
    predicted_loaf_g:        c.metrics.predicted_loaf_g,
  };
  const file = {
    id: src.id,
    name: src.recipe.name,
    course: src.course,
    zone: src.zone,
    description: src.description,
    recipe: src.recipe,
    expected_metrics,
  };
  writeFileSync(join(OUT_DIR, `${src.id}.bread.json`), JSON.stringify(file, null, 2));
  indexEntries.push({ id: src.id, name: src.recipe.name, course: src.course, zone: src.zone, description: src.description });
}
writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify({ schema_version: "2.0", entries: indexEntries }, null, 2));
console.error(`built ${EXAMPLE_SOURCES.length} examples`);
