import type { ApplyFixResult, Fix, Recipe } from "../core/types.js";
import { fixKinds, FixApplyError } from "../core/registry/fixes.js";

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
    if (e instanceof FixApplyError) {
      return { ok: false, error: { code: e.code, message: e.message } };
    }
    // Unexpected error path — bucket as invalid_payload with the raw message.
    return { ok: false, error: { code: "invalid_payload", message: (e as Error).message } };
  }
}
