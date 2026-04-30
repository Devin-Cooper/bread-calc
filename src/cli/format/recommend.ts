import type { CourseRecommendation, RecommendationReason } from "../../core/recommend.js";
import type { Database } from "../../core/types.js";

export interface FormatRecommendOpts {
  readonly limit?: number;
  readonly noColor?: boolean;
}

export function formatRecommend(
  recs: readonly CourseRecommendation[],
  db: Database,
  opts?: FormatRecommendOpts,
): string {
  const limit = opts?.limit ?? recs.length;
  const courseNameOf = (id: string): string => db.courses.find((c) => c.id === id)?.name ?? id;

  const eligibleRecs = recs.filter((r) => r.eligible).slice(0, limit);
  const ineligibleRecs = recs.filter((r) => !r.eligible);

  const lines: string[] = [];
  lines.push("Recommended courses (tree-predictor engine):");
  lines.push("─".repeat(60));

  for (const r of eligibleRecs) {
    const name = courseNameOf(r.course_id);
    const branch = r.reasons.find(
      (reason): reason is Extract<RecommendationReason, { kind: "tree_branch" }> => reason.kind === "tree_branch",
    );
    const evidence = branch?.evidence ?? "";
    lines.push(`  #${r.rank}. ${name} (${r.course_id})`);
    if (evidence) lines.push(`      ${evidence}`);
    if (r.rank === 1) {
      const facts = r.reasons.filter(
        (reason): reason is Extract<RecommendationReason, { kind: "predicate_fact" }> => reason.kind === "predicate_fact",
      );
      if (facts.length > 0) {
        const factText = facts.map((f) => `${f.fact}=${f.value}`).join(", ");
        lines.push(`      Facts: ${factText}`);
      }
    }
  }

  if (ineligibleRecs.length > 0) {
    lines.push("");
    lines.push("Ineligible:");
    for (const r of ineligibleRecs) {
      lines.push(`  - ${courseNameOf(r.course_id)} (${r.course_id})`);
    }
  }

  return lines.join("\n");
}
