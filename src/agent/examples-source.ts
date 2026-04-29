import type { Recipe, ZoneId } from "../core/types.js";

export interface ExampleSource {
  id: string;
  course: string;
  zone: ZoneId;
  description: string;
  recipe: Recipe;
}

const u = (n: number) => `u_eg${n.toString().padStart(7, "0")}`;

// NOTE on gluten_free_basic: the plan originally used `brown_rice_flour` and
// `tapioca_starch` which are not present in the bundled data files. Substituted:
//   brown_rice_flour  → gf_flour_blend (300 g, from flours.json)
//   tapioca_starch    → psyllium_husk  (15 g, from ingredients.json)
// and reduced water from 340 g to 325 g to compensate for psyllium husk's
// higher water-absorption relative to tapioca. The recipe still lands in the
// very_wet zone and exercises xanthan_gum + egg_whole_large paths.

export const EXAMPLE_SOURCES: ExampleSource[] = [
  {
    id: "classic_white",
    course: "White",
    zone: "sandwich",
    description: "The default starter — 553 g bread flour, 326 g water, sandwich-zone hydration.",
    recipe: {
      schema_version: "2.0", name: "Classic White (BB-PDC20)", machine: "zojirushi_bb_pdc20",
      items: [
        { uid: u(1),  ingredient_id: "bread_flour",      grams: 553 },
        { uid: u(2),  ingredient_id: "water_tap",        grams: 326 },
        { uid: u(3),  ingredient_id: "sugar_granulated", grams: 30  },
        { uid: u(4),  ingredient_id: "salt_table",       grams: 9   },
        { uid: u(5),  ingredient_id: "butter_unsalted",  grams: 28  },
        { uid: u(6),  ingredient_id: "yeast_instant",    grams: 5   },
      ],
    },
  },
  {
    id: "whole_wheat_basic",
    course: "Whole Wheat",
    zone: "sandwich",
    description: "All whole wheat, sandwich-zone hydration with butter for tenderness.",
    recipe: {
      schema_version: "2.0", name: "Whole Wheat (basic)",
      items: [
        { uid: u(10), ingredient_id: "whole_wheat_flour", grams: 500 },
        { uid: u(11), ingredient_id: "water_tap",         grams: 320 },
        { uid: u(12), ingredient_id: "honey",             grams: 30  },
        { uid: u(13), ingredient_id: "salt_table",        grams: 8   },
        { uid: u(14), ingredient_id: "butter_unsalted",   grams: 25  },
        { uid: u(15), ingredient_id: "yeast_instant",     grams: 5   },
      ],
    },
  },
  {
    id: "whole_wheat_high_hydration",
    course: "Whole Wheat",
    zone: "wet",
    description: "70% hydration whole wheat with vital wheat gluten for structure.",
    recipe: {
      schema_version: "2.0", name: "Whole Wheat (high hydration)",
      items: [
        { uid: u(20), ingredient_id: "whole_wheat_flour",  grams: 500 },
        { uid: u(21), ingredient_id: "water_tap",          grams: 350 },
        { uid: u(22), ingredient_id: "vital_wheat_gluten", grams: 8   },
        { uid: u(23), ingredient_id: "salt_table",         grams: 8   },
        { uid: u(24), ingredient_id: "yeast_instant",      grams: 5   },
      ],
    },
  },
  {
    id: "multigrain_seeded",
    course: "Multigrain",
    zone: "sandwich",
    description: "Bread flour + sunflower + flax with butter and brown sugar.",
    recipe: {
      schema_version: "2.0", name: "Multigrain Seeded",
      items: [
        { uid: u(30), ingredient_id: "bread_flour",       grams: 450 },
        { uid: u(31), ingredient_id: "whole_wheat_flour", grams: 100 },
        { uid: u(32), ingredient_id: "water_tap",         grams: 340 },
        { uid: u(33), ingredient_id: "sunflower_seed",    grams: 40  },
        { uid: u(34), ingredient_id: "flax_seed_ground",  grams: 25  },
        { uid: u(35), ingredient_id: "sugar_brown",       grams: 25  },
        { uid: u(36), ingredient_id: "salt_table",        grams: 9   },
        { uid: u(37), ingredient_id: "butter_unsalted",   grams: 25  },
        { uid: u(38), ingredient_id: "yeast_instant",     grams: 5   },
      ],
    },
  },
  {
    id: "gluten_free_basic",
    course: "Gluten Free",
    zone: "very_wet",
    description: "GF flour blend + psyllium husk + xanthan, very-wet hydration with eggs.",
    recipe: {
      schema_version: "2.0", name: "Gluten Free (basic)",
      items: [
        { uid: u(40), ingredient_id: "gf_flour_blend",   grams: 400 },
        { uid: u(41), ingredient_id: "water_tap",         grams: 340 },
        { uid: u(42), ingredient_id: "egg_whole_large",   grams: 100 },
        { uid: u(43), ingredient_id: "xanthan_gum",       grams: 4   },
        { uid: u(44), ingredient_id: "psyllium_husk",     grams: 15  },
        { uid: u(45), ingredient_id: "sugar_granulated",  grams: 20  },
        { uid: u(46), ingredient_id: "salt_table",        grams: 7   },
        { uid: u(47), ingredient_id: "oil_canola",        grams: 30  },
        { uid: u(48), ingredient_id: "yeast_instant",     grams: 6   },
      ],
    },
  },
  {
    id: "enriched_butter_roll",
    course: "White",
    zone: "dry",
    description: "Low-hydration enriched dough — high butter, sugar, eggs.",
    recipe: {
      schema_version: "2.0", name: "Enriched Butter Roll",
      items: [
        { uid: u(50), ingredient_id: "bread_flour",       grams: 500 },
        { uid: u(51), ingredient_id: "milk_whole",        grams: 220 },
        { uid: u(52), ingredient_id: "sugar_granulated",  grams: 50  },
        { uid: u(53), ingredient_id: "salt_table",        grams: 8   },
        { uid: u(54), ingredient_id: "butter_unsalted",   grams: 60  },
        { uid: u(55), ingredient_id: "egg_whole_large",   grams: 50  },
        { uid: u(56), ingredient_id: "yeast_instant",     grams: 6   },
      ],
    },
  },
  {
    id: "vegan_olive_oil",
    course: "Vegan",
    zone: "sandwich",
    description: "Vegan-friendly: olive oil instead of butter, no eggs/dairy.",
    recipe: {
      schema_version: "2.0", name: "Vegan Olive Oil",
      items: [
        { uid: u(60), ingredient_id: "bread_flour",             grams: 500 },
        { uid: u(61), ingredient_id: "water_tap",               grams: 310 },
        { uid: u(62), ingredient_id: "oil_olive_extra_virgin",  grams: 25  },
        { uid: u(63), ingredient_id: "sugar_granulated",        grams: 25  },
        { uid: u(64), ingredient_id: "salt_table",              grams: 8   },
        { uid: u(65), ingredient_id: "yeast_instant",           grams: 5   },
      ],
    },
  },
  {
    id: "salt_free_low_yeast",
    course: "Salt Free",
    zone: "sandwich",
    description: "Low-salt and low-yeast — fires `no_salt` info warning.",
    recipe: {
      schema_version: "2.0", name: "Salt-Free Low-Yeast",
      items: [
        { uid: u(70), ingredient_id: "bread_flour",       grams: 500 },
        { uid: u(71), ingredient_id: "water_tap",         grams: 310 },
        { uid: u(72), ingredient_id: "sugar_granulated",  grams: 25  },
        { uid: u(73), ingredient_id: "salt_table",        grams: 1   },
        { uid: u(74), ingredient_id: "butter_unsalted",   grams: 20  },
        { uid: u(75), ingredient_id: "yeast_instant",     grams: 3   },
      ],
    },
  },
  {
    id: "target_mode_900g",
    course: "White",
    zone: "sandwich",
    description: "target_loaf_g=900, all items use bakers_pct.",
    recipe: {
      schema_version: "2.0", name: "Target Mode 900g",
      target_loaf_g: 900,
      items: [
        { uid: u(80), ingredient_id: "bread_flour",       bakers_pct: 100 },
        { uid: u(81), ingredient_id: "water_tap",         bakers_pct: 60  },
        { uid: u(82), ingredient_id: "sugar_granulated",  bakers_pct: 5.4 },
        { uid: u(83), ingredient_id: "salt_table",        bakers_pct: 1.6 },
        { uid: u(84), ingredient_id: "butter_unsalted",   bakers_pct: 5.0 },
        { uid: u(85), ingredient_id: "yeast_instant",     bakers_pct: 0.9 },
      ],
    },
  },
  {
    id: "with_solver_warning",
    course: "White",
    zone: "sandwich",
    description: "Deliberately overconstrained — fires `solver_overconstrained` + its fixes.",
    recipe: {
      schema_version: "2.0", name: "With Solver Warning (overconstrained)",
      target_loaf_g: 100,
      items: [
        { uid: u(90), ingredient_id: "bread_flour",       grams: 500 },
        { uid: u(91), ingredient_id: "water_tap",         bakers_pct: 60 },
        { uid: u(92), ingredient_id: "salt_table",        bakers_pct: 1.6 },
        { uid: u(93), ingredient_id: "yeast_instant",     bakers_pct: 0.9 },
      ],
    },
  },
];
