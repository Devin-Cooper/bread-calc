#!/usr/bin/env node
// Reads src/data/*.json, writes dist/lib/data/*.js exporting frozen arrays/objects.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";

const FILES = ["ingredients", "flours", "bb_pdc20_recipes", "bb_pdc20_templates", "bb_pdc20_courses", "machines", "defaults"];
mkdirSync("dist/lib/data", { recursive: true });

const indexLines = [];
for (const f of FILES) {
  const raw = readFileSync(`src/data/${f}.json`, "utf8");
  writeFileSync(`dist/lib/data/${f}.js`, `export default Object.freeze(${raw});\n`);
  writeFileSync(`dist/lib/data/${f}.d.ts`, `declare const _default: any;\nexport default _default;\n`);
  indexLines.push(`import _${f} from "./${f}.js";`);
}
indexLines.push("export const ingredients = _ingredients.entries;");
indexLines.push("export const flours = _flours.entries;");
indexLines.push("export const BB_PDC20_RECIPES = _bb_pdc20_recipes.entries;");
indexLines.push("export const BB_PDC20_TEMPLATES = _bb_pdc20_templates;");
indexLines.push("export const BB_PDC20_COURSES = _bb_pdc20_courses.entries;");
indexLines.push("export const machines = _machines.entries;");
indexLines.push("export const defaults = _defaults;");
writeFileSync("dist/lib/data/index.js", indexLines.join("\n") + "\n");
writeFileSync("dist/lib/data/index.d.ts",
  `import type { Ingredient, Flour, BBPDC20Recipe, BBPDC20Course, Machine, Defaults } from "../index.js";
import type { RawTemplateEntry } from "../templates-projection.js";
interface BBPDC20TemplatesFile {
  readonly schema_version: "1.0";
  readonly attribution: string;
  readonly entries: readonly RawTemplateEntry[];
}
export declare const ingredients: readonly Ingredient[];
export declare const flours: readonly Flour[];
export declare const BB_PDC20_RECIPES: readonly BBPDC20Recipe[];
export declare const BB_PDC20_TEMPLATES: BBPDC20TemplatesFile;
export declare const BB_PDC20_COURSES: readonly BBPDC20Course[];
export declare const machines: readonly Machine[];
export declare const defaults: Defaults;
`);

copyFileSync("src/data/schema.json", "dist/lib/schema.json");
console.error("transformed data files");
