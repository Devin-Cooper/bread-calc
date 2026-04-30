import type { CourseRecommendation } from "../../core/recommend.js";
import type { Database } from "../../core/types.js";

interface FormatOpts {
  readonly limit?: number;
  readonly noColor?: boolean;
}

const ANSI_GREEN = "\x1b[32m";
const ANSI_RED = "\x1b[31m";
const ANSI_DIM = "\x1b[2m";
const ANSI_RESET = "\x1b[0m";

function color(text: string, code: string, noColor: boolean): string {
  return noColor ? text : `${code}${text}${ANSI_RESET}`;
}

export function formatRecommend(
  recs: readonly CourseRecommendation[],
  db: Database,
  opts: FormatOpts = {},
): string {
  const noColor = opts.noColor ?? false;
  const slice = opts.limit !== undefined ? recs.slice(0, opts.limit) : recs;

  const courseNameById = new Map(db.courses.map((c) => [c.id, c.name]));

  const rows = slice.map((rec) => {
    const courseName = courseNameById.get(rec.course_id) ?? rec.course_id;
    const rankStr = rec.rank === null ? "—" : String(rec.rank);
    const eligibility = rec.eligible
      ? color("eligible", ANSI_GREEN, noColor)
      : color("ineligible", ANSI_RED, noColor);
    let topReason = "—";
    if (rec.eligible) {
      const match = rec.reasons.find((r) => r.verdict === "match");
      topReason = match?.evidence ?? rec.reasons.find((r) => r.verdict === "neutral")?.evidence ?? "—";
    } else {
      topReason = rec.reasons.find((r) => r.verdict === "mismatch")?.evidence ?? "—";
    }
    return { rankStr, courseName, eligibility, topReason };
  });

  const colW = {
    rank: Math.max(4, ...rows.map((r) => r.rankStr.length)),
    course: Math.max(6, ...rows.map((r) => r.courseName.length)),
    eligibility: Math.max(8, ...rows.map((r) => r.eligibility.replace(/\x1b\[\d+m/g, "").length)),
  };

  const header = `${"Rank".padEnd(colW.rank)}  ${"Course".padEnd(colW.course)}  ${"Verdict".padEnd(colW.eligibility)}  Top reason`;
  const rule = color("-".repeat(header.length), ANSI_DIM, noColor);

  const body = rows.map((r) => {
    const visibleEligibility = r.eligibility.replace(/\x1b\[\d+m/g, "");
    const padding = " ".repeat(Math.max(0, colW.eligibility - visibleEligibility.length));
    return `${r.rankStr.padEnd(colW.rank)}  ${r.courseName.padEnd(colW.course)}  ${r.eligibility}${padding}  ${r.topReason}`;
  });

  return [header, rule, ...body].join("\n");
}
