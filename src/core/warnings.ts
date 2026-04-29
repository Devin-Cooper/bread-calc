// Thin compatibility shim — preserves `runWarnings(ctx)` signature for callers.
// All rules now live in src/core/registry/warnings.ts.
import { runWarnings as registryRunWarnings, emitSolverWarning } from "./registry/warnings.js";
import type { WarningCtx } from "./registry/warnings.js";
import type { Warning } from "./types.js";

export type { WarningCtx };

export function runWarnings(ctx: WarningCtx): Warning[] {
  return registryRunWarnings(ctx).warnings;
}

export { emitSolverWarning };
