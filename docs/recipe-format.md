# Recipe format

A recipe is a JSON document conforming to `bread-calc`'s JSON Schema (Draft 2020-12). Top-level shape:

```json
{ "schema_version": "1.0", "items": [ { "ingredient_id": "bread_flour", "grams": 553 } ] }
```

Required: `schema_version`, `items` (≥1).
Optional: `name`, `notes`, `machine` (default `"zojirushi_bb_pdc20"`), `target_loaf_g`, `bake_loss_pct`, `free_water_factor_overrides`, `headline_metric`.

In **mode B** (`target_loaf_g` set), every item must have `grams` or `bakers_pct`.
The solver rejects (`solver_ambiguous_flour`) recipes where any flour has fixed grams while another item has `bakers_pct`.

## Reference data

`bb_pdc20_recipes.json` stores totals only (name, course, total_water_g, total_flour_g, hydration_pct_nominal, zone) — derived from the Zojirushi BB-PDC20 recipe booklet's published recipes. Storing only summary statistics keeps the dataset firmly in factual / non-creative-expression territory.
