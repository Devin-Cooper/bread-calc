import type { ApplyFixResult, Fix, Recipe } from "../core/types.js";
import { fixKinds } from "../core/registry/fixes.js";

export function applyFix(recipe: Recipe, fix: Fix): ApplyFixResult {
  const kind = fixKinds.get((fix as { kind: string }).kind);
  if (!kind) {
    return { ok: false, error: {
      code: "unknown_kind",
      message: `Unknown fix kind: "${(fix as { kind: string }).kind}".`,
    }};
  }
  try {
    const result = kind.apply(recipe, fix as unknown as Record<string, unknown>);
    return { ok: true, recipe: result };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("unknown_uid")) {
      return { ok: false, error: { code: "unknown_uid", message: msg } };
    }
    if (msg.startsWith("negative_grams")) {
      return { ok: false, error: { code: "negative_grams", message: msg } };
    }
    if (msg.startsWith("value_type_mismatch")) {
      return { ok: false, error: { code: "value_type_mismatch", message: msg } };
    }
    if (msg.startsWith("invalid_payload")) {
      return { ok: false, error: { code: "invalid_payload", message: msg } };
    }
    return { ok: false, error: { code: "invalid_payload", message: msg } };
  }
}
