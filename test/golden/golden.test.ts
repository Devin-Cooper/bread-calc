// test/golden/golden.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { computeRecipe } from "../../src/core/index.js";
import type { Database } from "../../src/core/types.js";

const ingredients = JSON.parse(readFileSync("src/data/ingredients.json", "utf8")).entries;
const flours = JSON.parse(readFileSync("src/data/flours.json", "utf8")).entries;
const refs = JSON.parse(readFileSync("src/data/bb_pdc20_recipes.json", "utf8")).entries;
const machines = JSON.parse(readFileSync("src/data/machines.json", "utf8")).entries;
const defaults = JSON.parse(readFileSync("src/data/defaults.json", "utf8"));
const db: Database = { ingredients, flours, references: refs, machines, courses: [], defaults };

const FIXTURES_DIR = "test/golden/fixtures";

describe("golden fixtures", () => {
  for (const file of readdirSync(FIXTURES_DIR)) {
    if (!file.endsWith(".bread.json")) continue;
    const name = basename(file, ".bread.json");
    it(name, () => {
      const recipe = JSON.parse(readFileSync(join(FIXTURES_DIR, file), "utf8"));
      const actual = computeRecipe(recipe, db);
      const expectedPath = join(FIXTURES_DIR, `${name}.expected.json`);
      if (process.env.UPDATE_GOLDENS === "1") {
        writeFileSync(expectedPath, JSON.stringify(actual, null, 2) + "\n");
        console.error(`updated ${expectedPath}`);
        return;
      }
      const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
      expect(actual).toEqual(expected);
    });
  }
});
