import type { Recipe, ZoneId } from "../core/types.js";
import indexFile from "./examples/index.json" with { type: "json" };

// Static, sync, browser-safe loading: the examples directory is committed
// alongside this source file (Task 6.2 generates it), and Vite/Vitest both
// inline JSON via `import ... with { type: "json" }`. Each example is loaded
// via the same mechanism. No fetch(), no top-level await, no runtime URL
// resolution. The trade-off: every example is included in the lib chunk; for
// 10 small recipes that's <30 KB minified. If the count grows materially, a
// Phase-9.5 follow-up can switch to dynamic import() of one-file-per-id and
// add the `loadExamples()` async accessor for callers willing to await.
import classic_white              from "./examples/classic_white.bread.json"              with { type: "json" };
import whole_wheat_basic          from "./examples/whole_wheat_basic.bread.json"          with { type: "json" };
import whole_wheat_high_hydration from "./examples/whole_wheat_high_hydration.bread.json" with { type: "json" };
import multigrain_seeded          from "./examples/multigrain_seeded.bread.json"          with { type: "json" };
import gluten_free_basic          from "./examples/gluten_free_basic.bread.json"          with { type: "json" };
import enriched_butter_roll       from "./examples/enriched_butter_roll.bread.json"       with { type: "json" };
import vegan_olive_oil            from "./examples/vegan_olive_oil.bread.json"            with { type: "json" };
import salt_free_low_yeast        from "./examples/salt_free_low_yeast.bread.json"        with { type: "json" };
import target_mode_900g           from "./examples/target_mode_900g.bread.json"           with { type: "json" };
import with_solver_warning        from "./examples/with_solver_warning.bread.json"        with { type: "json" };

export interface ExampleEntry {
  id: string;
  name: string;
  course: string;
  zone: ZoneId;
  description: string;
  recipe: Recipe;
  expected_metrics: {
    hydration_effective_pct: number | null;
    hydration_zone: ZoneId | null;
    predicted_loaf_g: number;
  };
}

const BY_ID: Record<string, ExampleEntry> = {
  classic_white:                classic_white                as unknown as ExampleEntry,
  whole_wheat_basic:            whole_wheat_basic            as unknown as ExampleEntry,
  whole_wheat_high_hydration:   whole_wheat_high_hydration   as unknown as ExampleEntry,
  multigrain_seeded:            multigrain_seeded            as unknown as ExampleEntry,
  gluten_free_basic:            gluten_free_basic            as unknown as ExampleEntry,
  enriched_butter_roll:         enriched_butter_roll         as unknown as ExampleEntry,
  vegan_olive_oil:              vegan_olive_oil              as unknown as ExampleEntry,
  salt_free_low_yeast:          salt_free_low_yeast          as unknown as ExampleEntry,
  target_mode_900g:             target_mode_900g             as unknown as ExampleEntry,
  with_solver_warning:          with_solver_warning          as unknown as ExampleEntry,
};

// `index.json` is the canonical ordering; we map ids → loaded entries.
const ORDERED: ExampleEntry[] = (indexFile as { entries: Array<{ id: string }> }).entries
  .map((e) => {
    const entry = BY_ID[e.id];
    if (!entry) throw new Error(`getExamples: index references unknown id "${e.id}"`);
    return entry;
  });

export function getExamples(filter?: { course?: string; zone?: ZoneId; id?: string; limit?: number }): ExampleEntry[] {
  let list = ORDERED;
  if (filter?.id) list = list.filter((e) => e.id === filter.id);
  if (filter?.course) list = list.filter((e) => e.course === filter.course);
  if (filter?.zone) list = list.filter((e) => e.zone === filter.zone);
  if (filter?.limit !== undefined) list = list.slice(0, filter.limit);
  return list;
}
