import { createRegistry, type Registry } from "./base.js";
import type { ApplyFixErrorCode, Recipe, RecipeItem } from "../types.js";
import { generateUid, isValidUid } from "../uid.js";

export class FixApplyError extends Error {
  constructor(public readonly code: ApplyFixErrorCode, message: string) {
    super(message);
    this.name = "FixApplyError";
  }
}

export interface FixKind {
  kind: string;
  description: string;
  payload_schema: Record<string, unknown>;
  apply(recipe: Recipe, payload: Record<string, unknown>): Recipe;
}

export const fixKinds: Registry<FixKind> = createRegistry<FixKind>((k) => k.kind);

function findItemIndex(recipe: Recipe, uid: string): number {
  return recipe.items.findIndex((i) => i.uid === uid);
}

fixKinds.register({
  kind: "set_grams",
  description: "Set the grams field of a single recipe item, replacing any prior value.",
  payload_schema: {
    type: "object",
    required: ["uid", "grams", "rationale"],
    properties: {
      uid: { type: "string", pattern: "^[A-Za-z0-9_-]{8,16}$" },
      grams: { type: "number", minimum: 0 },
      rationale: { type: "string" },
    },
    additionalProperties: false,
  },
  apply(recipe, payload) {
    const idx = findItemIndex(recipe, payload["uid"] as string);
    if (idx < 0) throw new FixApplyError("unknown_uid", `unknown uid: ${payload["uid"]}`);
    const items = recipe.items.map((it, i) => i === idx ? { ...it, grams: payload["grams"] as number } : it);
    return { ...recipe, items };
  },
});

fixKinds.register({
  kind: "increase_grams",
  description: "Add delta_g (positive) to an item's grams; clamps at 0 minimum.",
  payload_schema: {
    type: "object",
    required: ["uid", "delta_g", "rationale"],
    properties: {
      uid: { type: "string", pattern: "^[A-Za-z0-9_-]{8,16}$" },
      delta_g: { type: "number" },
      rationale: { type: "string" },
    },
    additionalProperties: false,
  },
  apply(recipe, payload) {
    const idx = findItemIndex(recipe, payload["uid"] as string);
    if (idx < 0) throw new FixApplyError("unknown_uid", `unknown uid: ${payload["uid"]}`);
    const cur = recipe.items[idx]!.grams ?? 0;
    const next = cur + (payload["delta_g"] as number);
    if (next < 0) throw new FixApplyError("negative_grams", `negative_grams: ${cur}+${payload["delta_g"]}=${next}`);
    return { ...recipe, items: recipe.items.map((it, i) => i === idx ? { ...it, grams: next } : it) };
  },
});

fixKinds.register({
  kind: "decrease_grams",
  description: "Subtract delta_g (positive) from an item's grams; clamps at 0 minimum.",
  payload_schema: {
    type: "object",
    required: ["uid", "delta_g", "rationale"],
    properties: {
      uid: { type: "string", pattern: "^[A-Za-z0-9_-]{8,16}$" },
      delta_g: { type: "number", minimum: 0 },
      rationale: { type: "string" },
    },
    additionalProperties: false,
  },
  apply(recipe, payload) {
    const idx = findItemIndex(recipe, payload["uid"] as string);
    if (idx < 0) throw new FixApplyError("unknown_uid", `unknown uid: ${payload["uid"]}`);
    const cur = recipe.items[idx]!.grams ?? 0;
    const next = cur - (payload["delta_g"] as number);
    if (next < 0) throw new FixApplyError("negative_grams", `negative_grams: ${cur}-${payload["delta_g"]}=${next}`);
    return { ...recipe, items: recipe.items.map((it, i) => i === idx ? { ...it, grams: next } : it) };
  },
});

fixKinds.register({
  kind: "set_bakers_pct",
  description: "Set the bakers_pct field of a single recipe item.",
  payload_schema: {
    type: "object",
    required: ["uid", "bakers_pct", "rationale"],
    properties: {
      uid: { type: "string", pattern: "^[A-Za-z0-9_-]{8,16}$" },
      bakers_pct: { type: "number", minimum: 0 },
      rationale: { type: "string" },
    },
    additionalProperties: false,
  },
  apply(recipe, payload) {
    const idx = findItemIndex(recipe, payload["uid"] as string);
    if (idx < 0) throw new FixApplyError("unknown_uid", `unknown uid: ${payload["uid"]}`);
    return { ...recipe, items: recipe.items.map((it, i) => i === idx ? { ...it, bakers_pct: payload["bakers_pct"] as number } : it) };
  },
});

fixKinds.register({
  kind: "add_ingredient",
  description: "Append a new RecipeItem; uid is auto-generated if not supplied.",
  payload_schema: {
    type: "object",
    required: ["ingredient_id", "rationale"],
    properties: {
      uid: { type: "string", pattern: "^[A-Za-z0-9_-]{8,16}$" },
      ingredient_id: { type: "string" },
      grams: { type: "number", minimum: 0 },
      bakers_pct: { type: "number", minimum: 0 },
      role: { type: "string" },
      rationale: { type: "string" },
    },
    additionalProperties: false,
  },
  apply(recipe, payload) {
    const uid = (payload["uid"] as string | undefined) ?? generateUid();
    if (!isValidUid(uid)) throw new FixApplyError("invalid_payload", `invalid_payload: bad uid format`);
    if (recipe.items.some((it) => it.uid === uid)) throw new FixApplyError("invalid_payload", `invalid_payload: duplicate uid ${uid}`);
    const item: RecipeItem = { uid, ingredient_id: payload["ingredient_id"] as string };
    if (payload["grams"]      !== undefined) item.grams      = payload["grams"]      as number;
    if (payload["bakers_pct"] !== undefined) item.bakers_pct = payload["bakers_pct"] as number;
    if (payload["role"]       !== undefined) item.role       = payload["role"]       as import("../types.js").Role;
    return { ...recipe, items: [...recipe.items, item] };
  },
});

fixKinds.register({
  kind: "remove_ingredient",
  description: "Remove a RecipeItem by uid.",
  payload_schema: {
    type: "object",
    required: ["uid", "rationale"],
    properties: {
      uid: { type: "string", pattern: "^[A-Za-z0-9_-]{8,16}$" },
      rationale: { type: "string" },
    },
    additionalProperties: false,
  },
  apply(recipe, payload) {
    const idx = findItemIndex(recipe, payload["uid"] as string);
    if (idx < 0) throw new FixApplyError("unknown_uid", `unknown uid: ${payload["uid"]}`);
    return { ...recipe, items: recipe.items.filter((_, i) => i !== idx) };
  },
});

fixKinds.register({
  kind: "set_field",
  description: "Set a top-level Recipe field (bake_loss_pct | target_loaf_g | machine).",
  payload_schema: {
    type: "object",
    required: ["field", "value", "rationale"],
    properties: {
      field: { enum: ["bake_loss_pct", "target_loaf_g", "machine"] },
      value: { type: ["number", "string", "null"] },
      rationale: { type: "string" },
    },
    additionalProperties: false,
  },
  apply(recipe, payload) {
    const field = payload["field"] as string;
    const value = payload["value"];
    if (field === "bake_loss_pct") {
      if (typeof value !== "number") throw new FixApplyError("value_type_mismatch", `value_type_mismatch: bake_loss_pct expects number`);
      return { ...recipe, bake_loss_pct: value };
    }
    if (field === "target_loaf_g") {
      if (value === null) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { target_loaf_g: _drop, ...rest } = recipe;
        return rest as Recipe;
      }
      if (typeof value !== "number") throw new FixApplyError("value_type_mismatch", `value_type_mismatch: target_loaf_g expects number|null`);
      return { ...recipe, target_loaf_g: value };
    }
    if (field === "machine") {
      if (typeof value !== "string") throw new FixApplyError("value_type_mismatch", `value_type_mismatch: machine expects string`);
      return { ...recipe, machine: value };
    }
    throw new FixApplyError("invalid_payload", `invalid_payload: unknown field "${field}"`);
  },
});

fixKinds.register({
  kind: "set_role",
  description: "Override the inferred role for a recipe item.",
  payload_schema: {
    type: "object",
    required: ["uid", "role", "rationale"],
    properties: {
      uid: { type: "string", pattern: "^[A-Za-z0-9_-]{8,16}$" },
      role: { enum: ["flour", "wet", "fat", "sweetener", "salt", "yeast", "leavener", "inclusion", "enrichment"] },
      rationale: { type: "string" },
    },
    additionalProperties: false,
  },
  apply(recipe, payload) {
    const idx = findItemIndex(recipe, payload["uid"] as string);
    if (idx < 0) throw new FixApplyError("unknown_uid", `unknown uid: ${payload["uid"]}`);
    const newRole = payload["role"] as import("../types.js").Role;
    return { ...recipe, items: recipe.items.map((it, i): RecipeItem => i === idx ? { ...it, role: newRole } : it) };
  },
});
