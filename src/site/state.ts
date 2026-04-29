import type { Recipe, RecipeItem } from "../core/index.js";
import { generateUid } from "../core/uid.js";

export type Action =
  | { type: "add_item"; ingredient_id: string }
  | { type: "remove_item"; index: number }
  | { type: "set_grams"; index: number; grams: number }
  | { type: "set_bakers_pct"; index: number; bakers_pct: number }
  | { type: "set_role"; index: number; role: RecipeItem["role"] }
  | { type: "set_target_loaf_g"; grams: number | undefined }
  | { type: "set_bake_loss_pct"; pct: number }
  | { type: "set_name"; name: string }
  | { type: "set_notes"; notes: string }
  | { type: "set_headline_metric"; metric: "effective" | "nominal" | "total_liquid" }
  | { type: "set_free_water_factor_override"; ingredient_id: string; factor: number | undefined }
  | { type: "load"; recipe: Recipe };

function reduce(state: Recipe, action: Action): Recipe {
  switch (action.type) {
    case "add_item": return { ...state, items: [...state.items, { uid: generateUid(), ingredient_id: action.ingredient_id, grams: 0 }] };
    case "remove_item": return { ...state, items: state.items.filter((_, i) => i !== action.index) };
    case "set_grams": return { ...state, items: state.items.map((it, i) => i === action.index ? { ...it, grams: action.grams } : it) };
    case "set_bakers_pct": return { ...state, items: state.items.map((it, i) => i === action.index ? { ...it, bakers_pct: action.bakers_pct } : it) };
    case "set_role": return { ...state, items: state.items.map((it, i) => {
      if (i !== action.index) return it;
      // exactOptionalPropertyTypes forbids assigning `undefined` to an optional `Role?`;
      // delete the key when the action clears the role.
      if (action.role === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { role: _role, ...rest } = it;
        return rest;
      }
      return { ...it, role: action.role };
    }) };
    case "set_target_loaf_g": {
      // exactOptionalPropertyTypes forbids assigning `undefined` to an optional `number?`;
      // we delete the key instead.
      if (action.grams === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { target_loaf_g: _target_loaf_g, ...rest } = state;
        return rest;
      }
      return { ...state, target_loaf_g: action.grams };
    }
    case "set_bake_loss_pct": return { ...state, bake_loss_pct: action.pct };
    case "set_name": return { ...state, name: action.name };
    case "set_notes": {
      // Empty string clears the optional field (delete to satisfy exactOptionalPropertyTypes).
      if (action.notes === "") {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { notes: _notes, ...rest } = state;
        return rest;
      }
      return { ...state, notes: action.notes };
    }
    case "set_headline_metric": return { ...state, headline_metric: action.metric };
    case "set_free_water_factor_override": {
      const overrides = { ...(state.free_water_factor_overrides ?? {}) };
      if (action.factor === undefined) delete overrides[action.ingredient_id];
      else overrides[action.ingredient_id] = action.factor;
      return { ...state, free_water_factor_overrides: overrides };
    }
    case "load": return action.recipe;
  }
}

export interface Store {
  getState(): Recipe;
  dispatch(action: Action): void;
  subscribe(fn: () => void): () => void;
}

export function createStore(initial: Recipe): Store {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    getState: () => state,
    dispatch: (a) => {
      state = reduce(state, a);
      for (const f of subs) {
        try { f(); } catch (e) { console.error("state subscriber threw:", e); }
      }
    },
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
  };
}
