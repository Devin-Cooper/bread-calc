import { recommendCourse } from "../../core/recommend.js";
import type { BBPDC20Course, Database, Recipe } from "../../core/types.js";

interface MatrixEntry {
  readonly name: string;
  readonly canonical_course: string;
  readonly canonical_family: readonly string[];
  readonly recipe: Recipe;
}

export interface AuditRow {
  readonly name: string;
  readonly canonical: string;
  readonly predicted: string | null;
  readonly verdict: "exact" | "same_family" | "mismatch";
}

export interface AuditResult {
  readonly total: number;
  readonly exact: number;
  readonly same_family: number;
  readonly mismatch: number;
  readonly rows: readonly AuditRow[];
}

export function runAudit(matrixEntries: readonly MatrixEntry[], db: Database): AuditResult {
  let exact = 0, same_family = 0, mismatch = 0;
  const rows: AuditRow[] = [];
  for (const fx of matrixEntries) {
    const recs = recommendCourse(fx.recipe, db);
    const top = recs.find((r) => r.eligible);
    const predicted = top?.course_id ?? null;
    let verdict: AuditRow["verdict"];
    if (predicted === fx.canonical_course) {
      verdict = "exact"; exact++;
    } else if (predicted !== null && fx.canonical_family.includes(predicted)) {
      verdict = "same_family"; same_family++;
    } else {
      verdict = "mismatch"; mismatch++;
    }
    rows.push({ name: fx.name, canonical: fx.canonical_course, predicted, verdict });
  }
  return { total: matrixEntries.length, exact, same_family, mismatch, rows };
}

export function formatAudit(result: AuditResult, db: Database, opts?: { json?: boolean }): string {
  if (opts?.json) {
    return JSON.stringify(result, null, 2);
  }
  const courseNameOf = (id: string | null): string => {
    if (id === null) return "—";
    return db.courses.find((c: BBPDC20Course) => c.id === id)?.name ?? id;
  };
  const lines: string[] = [];
  lines.push(`BB-PDC20 recipe-book matrix audit:`);
  lines.push(`  exact:       ${result.exact}/${result.total}`);
  lines.push(`  same_family: ${result.same_family}/${result.total}`);
  lines.push(`  mismatch:    ${result.mismatch}/${result.total}`);
  lines.push("");
  lines.push("Per-fixture verdicts:");
  for (const r of result.rows) {
    const marker = r.verdict === "exact" ? "✓" : r.verdict === "same_family" ? "~" : "✗";
    lines.push(`  ${marker} ${r.name}`);
    lines.push(`      canonical: ${courseNameOf(r.canonical)} (${r.canonical})`);
    lines.push(`      predicted: ${courseNameOf(r.predicted)} (${r.predicted ?? "—"})`);
  }
  return lines.join("\n");
}
