import type { Store } from "../state.js";
import type { Database, BBPDC20Course } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";
import { recommendCourse } from "../../core/recommend.js";
import type { CourseRecommendation, TreeBranch, DietaryIntent, OutputIntent, TimeIntent } from "../../core/recommend.js";

const BRANCH_LABEL: Record<TreeBranch, string> = {
  intent_output_dough:   "dough output intent",
  intent_output_bake:    "bake output intent",
  dietary_gluten_free:   "gluten-free profile",
  dietary_salt_free:     "salt-free profile",
  dietary_vegan:         "vegan profile",
  dietary_sugar_free:    "sugar-free profile",
  rapid_white:           "rapid white-bread profile",
  rapid_whole_wheat:     "rapid whole-wheat profile",
  grain_multigrain:      "multigrain composition",
  grain_whole_wheat:     "whole-wheat composition",
  structural_european:   "lean European-style profile",
  default_white:         "white-bread default",
  non_baking_ineligible: "output-form mismatch",
};

function branchLabel(branch: TreeBranch): string {
  return BRANCH_LABEL[branch] ?? branch;
}

const DIETARY_LABEL: Record<DietaryIntent, string> = {
  salt_free: "salt-free",
  sugar_free: "sugar-free",
  vegan: "vegan",
  gluten_free: "gluten-free",
};

const OUTPUT_LABEL: Record<OutputIntent, string> = {
  bake: "bake output",
  dough: "dough output",
};

const TIME_LABEL: Record<TimeIntent, string> = {
  rapid: "rapid",
};

function intentChipText(intent: { dietary?: DietaryIntent; time?: TimeIntent; output?: OutputIntent } | undefined): string {
  if (!intent) return "";
  const parts: string[] = [];
  if (intent.dietary) parts.push(DIETARY_LABEL[intent.dietary]);
  if (intent.time) parts.push(TIME_LABEL[intent.time]);
  if (intent.output) parts.push(OUTPUT_LABEL[intent.output]);
  return parts.length === 0 ? "" : `· ${parts.join(", ")}`;
}

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  let seeAllOpen = false;
  let intentManuallyToggled = false; // set by toggle handler; suppresses auto-open after manual interaction
  let lastRecipeRef: ReturnType<typeof store.getState> | null = null;

  function render() {
    const r = store.getState();
    if (lastRecipeRef !== null && lastRecipeRef !== r && lastRecipeRef.items !== r.items) {
      // Detect wholesale recipe replacement (e.g., load action). Reset transient UI flags.
      intentManuallyToggled = false;
    }
    lastRecipeRef = r;
    const targetMode = r.target_loaf_g != null;

    // Focus restoration: capture active element BEFORE clearing innerHTML.
    const active = document.activeElement;
    let restoreSelector: string | null = null;
    let restoreStart = 0;
    let restoreEnd = 0;
    if (active && parent.contains(active)) {
      if (active.classList.contains("recipe-meta-extended-notes")) {
        restoreSelector = "textarea.recipe-meta-extended-notes";
      } else if (active instanceof HTMLInputElement && active.dataset.hintIdx !== undefined) {
        restoreSelector = `.bake-hints-list input[data-hint-idx="${active.dataset.hintIdx}"]`;
      }
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        restoreStart = active.selectionStart ?? 0;
        restoreEnd = active.selectionEnd ?? 0;
      }
    }

    const courseOptions = db.courses
      .slice()
      .sort((a, b) => a.course_number - b.course_number)
      .map((c) => `<option value="${escapeHtml(c.id)}"${r.course === c.id ? " selected" : ""}>${c.course_number} — ${escapeHtml(c.name)}</option>`)
      .join("");

    parent.innerHTML = `
      <div class="recipe-meta-strip">
        <label class="recipe-meta-control">
          <span class="recipe-meta-label">Course</span>
          <select class="recipe-meta-course">
            <option value=""${r.course === undefined ? " selected" : ""}>— none —</option>
            ${courseOptions}
          </select>
        </label>
        ${(() => {
          const recs = recommendCourse(r, db);
          const top3 = recs.filter((rec) => rec.eligible).slice(0, 3);
          const eligibleCount = recs.filter((rec) => rec.eligible).length;
          if (top3.length === 0) {
            return `<div class="recommendation-strip recommendation-empty">No compatible course found.</div>`;
          }
          const courseNameOf = (id: string) => db.courses.find((c) => c.id === id)?.name ?? id;

          const top3Rows = top3.map((rec) => {
            const courseName = courseNameOf(rec.course_id);
            const branchReason = rec.reasons.find((rr) => rr.kind === "tree_branch");
            const bName: TreeBranch = branchReason?.kind === "tree_branch" ? branchReason.branch : "default_white";
            const isUserPick = rec.course_id === r.course;
            const useBtn = isUserPick
              ? `<span class="rec-user-marker" aria-label="Your pick">✓ your pick</span>`
              : `<button type="button" class="rec-use" data-rec-id="${escapeHtml(rec.course_id)}" aria-label="Use ${escapeHtml(courseName)} for this recipe">Use</button>`;
            return `
              <div class="rec-row rec-row-${rec.rank}" data-course-id="${escapeHtml(rec.course_id)}">
                <span class="rec-rank">#${rec.rank}</span>
                <strong class="rec-name">${escapeHtml(courseName)}</strong>
                <span class="rec-branch">via ${escapeHtml(branchLabel(bName))}</span>
                ${useBtn}
              </div>
            `;
          }).join("");

          const userOutsideTop3 =
            r.course !== undefined &&
            !top3.some((rec) => rec.course_id === r.course);
          const userPickFooter = userOutsideTop3
            ? (() => {
                const userRec = recs.find((rec) => rec.course_id === r.course);
                const userRank = userRec?.rank ?? null;
                const userCourseName = courseNameOf(r.course!);
                const rankText = userRank !== null
                  ? `(rank #${userRank} of ${eligibleCount})`
                  : "(ineligible)";
                return `<p class="rec-user-pick">Your pick: <strong>${escapeHtml(userCourseName)}</strong> ${rankText}</p>`;
              })()
            : "";

          return `
            <div class="recommendation-strip">
              <div class="rec-top3">
                ${top3Rows}
              </div>
              <button type="button" class="rec-see-all" aria-expanded="${seeAllOpen ? "true" : "false"}" aria-controls="rec-see-all-table">See all ${recs.length}</button>
              ${userPickFooter}
            </div>
            ${seeAllOpen ? renderSeeAllTable(recs, db) : ""}
          `;
        })()}
        <fieldset class="recipe-meta-control">
          <legend class="recipe-meta-label">Crust</legend>
          <div class="segmented" role="radiogroup" aria-label="Crust shade">
            ${(["light","medium","dark"] as const).map((s) => `
              <button type="button" role="radio" aria-checked="${r.crust_shade === s}" data-shade="${s}" class="${r.crust_shade === s ? "is-on" : ""}">${s[0]!.toUpperCase()}${s.slice(1)}</button>
            `).join("")}
          </div>
          <button type="button" class="recipe-meta-clear" data-clear="crust_shade">Clear</button>
        </fieldset>
        <fieldset class="recipe-meta-control">
          <legend class="recipe-meta-label">Size</legend>
          <div class="segmented" role="radiogroup" aria-label="Loaf size">
            ${(["1lb","1.5lb","2lb"] as const).map((s) => `
              <button type="button" role="radio" aria-checked="${r.loaf_size === s}" data-size="${s}" class="${r.loaf_size === s ? "is-on" : ""}">${s}</button>
            `).join("")}
          </div>
          <button type="button" class="recipe-meta-clear" data-clear="loaf_size">Clear</button>
        </fieldset>
        <details class="recipe-meta-intent" data-state="${r.intent && Object.keys(r.intent).length > 0 ? "set" : "unset"}"${(r.intent && Object.keys(r.intent).length > 0 && !intentManuallyToggled) ? " open" : ""}>
          <summary>Intent <span class="intent-chip" aria-hidden="${r.intent && Object.keys(r.intent).length > 0 ? "false" : "true"}">${escapeHtml(intentChipText(r.intent))}</span></summary>
          <div class="intent-controls">
            <fieldset class="recipe-meta-control">
              <legend class="recipe-meta-label">Output</legend>
              <div class="segmented" role="radiogroup" aria-label="Output intent">
                ${(["bake", "dough"] as const).map((s) => `
                  <button type="button" role="radio" aria-checked="${r.intent?.output === s}" data-output="${s}" class="${r.intent?.output === s ? "is-on" : ""}">${s[0]!.toUpperCase()}${s.slice(1)}</button>
                `).join("")}
              </div>
              <button type="button" class="recipe-meta-clear" data-clear="intent_output">Auto</button>
            </fieldset>
            <fieldset class="recipe-meta-control">
              <legend class="recipe-meta-label">Dietary</legend>
              <div class="segmented" role="radiogroup" aria-label="Dietary intent">
                ${(["salt_free", "sugar_free", "vegan", "gluten_free"] as const).map((d) => `
                  <button type="button" role="radio" aria-checked="${r.intent?.dietary === d}" data-dietary="${d}" class="${r.intent?.dietary === d ? "is-on" : ""}">${DIETARY_LABEL[d].replace(/^./, (c) => c.toUpperCase())}</button>
                `).join("")}
              </div>
              <button type="button" class="recipe-meta-clear" data-clear="intent_dietary">None</button>
            </fieldset>
            <fieldset class="recipe-meta-control">
              <legend class="recipe-meta-label">Speed</legend>
              <div class="segmented" role="radiogroup" aria-label="Speed intent">
                <button type="button" role="radio" aria-checked="${r.intent?.time === "rapid"}" data-time="rapid" class="${r.intent?.time === "rapid" ? "is-on" : ""}">Rapid</button>
              </div>
              <button type="button" class="recipe-meta-clear" data-clear="intent_time">Standard</button>
            </fieldset>
          </div>
        </details>
      </div>
      <details class="recipe-meta-details"${(r.extended_notes !== undefined || (r.bake_hints && r.bake_hints.length > 0)) ? " open" : ""}>
        <summary>More details</summary>
        <label class="recipe-meta-extended">
          <span>Extended notes</span>
          <textarea class="recipe-meta-extended-notes" rows="6">${escapeHtml(r.extended_notes ?? "")}</textarea>
        </label>
        <fieldset class="recipe-meta-bake-hints">
          <legend>Bake hints</legend>
          <ul class="bake-hints-list">
            ${(r.bake_hints ?? []).map((h, i) => `
              <li>
                <input type="text" data-hint-idx="${i}" value="${escapeHtml(h)}" />
                <button type="button" class="bake-hint-remove" data-hint-idx="${i}">Remove</button>
              </li>
            `).join("")}
          </ul>
          <button type="button" class="bake-hint-add">+ Add hint</button>
        </fieldset>
      </details>
      ${targetMode ? `
        <label class="target-input">
          Target loaf weight (g)
          <input type="number" inputmode="decimal" step="1" min="0"
                 id="target-loaf-g" value="${r.target_loaf_g}"
                 aria-label="Target loaf weight in grams" />
        </label>
        <p class="hint">In target mode, set baker's % on each ingredient and the grams below are solved automatically.</p>
      ` : ""}
    `;

    parent.querySelectorAll<HTMLButtonElement>(".rec-use").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.recId;
        if (id) store.dispatch({ type: "set_course", course: id });
      });
    });
    const seeAllBtn = parent.querySelector(".rec-see-all") as HTMLButtonElement | null;
    if (seeAllBtn) {
      seeAllBtn.addEventListener("click", () => {
        seeAllOpen = !seeAllOpen;
        render();
      });
    }

    parent.querySelectorAll<HTMLButtonElement>(".rec-row-expand").forEach((btn) => {
      btn.addEventListener("click", () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        const detailId = btn.getAttribute("aria-controls");
        if (!detailId) return;
        const detail = parent.querySelector(`#${detailId}`) as HTMLElement | null;
        if (!detail) return;
        btn.setAttribute("aria-expanded", expanded ? "false" : "true");
        btn.textContent = expanded ? "▸" : "▾";
        if (expanded) detail.setAttribute("hidden", "");
        else detail.removeAttribute("hidden");
      });
    });

    const courseSelect = parent.querySelector(".recipe-meta-course") as HTMLSelectElement;
    courseSelect.addEventListener("change", () => {
      const v = courseSelect.value;
      store.dispatch({ type: "set_course", course: v === "" ? undefined : v });
    });

    parent.querySelectorAll<HTMLButtonElement>("[data-shade]").forEach((b) => {
      b.addEventListener("click", () => {
        const v = b.dataset.shade as "light"|"medium"|"dark";
        store.dispatch({ type: "set_crust_shade", crust_shade: v });
      });
    });
    (parent.querySelector('[data-clear="crust_shade"]') as HTMLButtonElement).addEventListener("click", () => {
      store.dispatch({ type: "set_crust_shade", crust_shade: undefined });
    });

    parent.querySelectorAll<HTMLButtonElement>("[data-size]").forEach((b) => {
      b.addEventListener("click", () => {
        const v = b.dataset.size as "1lb"|"1.5lb"|"2lb";
        store.dispatch({ type: "set_loaf_size", loaf_size: v });
      });
    });
    (parent.querySelector('[data-clear="loaf_size"]') as HTMLButtonElement).addEventListener("click", () => {
      store.dispatch({ type: "set_loaf_size", loaf_size: undefined });
    });

    parent.querySelectorAll<HTMLButtonElement>("[data-output]").forEach((b) => {
      b.addEventListener("click", () => {
        const v = b.dataset.output as "bake" | "dough";
        store.dispatch({ type: "set_intent_output", output: v });
      });
    });
    parent.querySelectorAll<HTMLButtonElement>("[data-dietary]").forEach((b) => {
      b.addEventListener("click", () => {
        const v = b.dataset.dietary as "salt_free" | "sugar_free" | "vegan" | "gluten_free";
        store.dispatch({ type: "set_intent_dietary", dietary: v });
      });
    });
    parent.querySelectorAll<HTMLButtonElement>("[data-time]").forEach((b) => {
      b.addEventListener("click", () => {
        const v = b.dataset.time as "rapid";
        store.dispatch({ type: "set_intent_time", time: v });
      });
    });
    const clearOutputBtn = parent.querySelector('[data-clear="intent_output"]') as HTMLButtonElement | null;
    if (clearOutputBtn) clearOutputBtn.addEventListener("click", () => {
      store.dispatch({ type: "set_intent_output", output: undefined });
    });
    const clearDietaryBtn = parent.querySelector('[data-clear="intent_dietary"]') as HTMLButtonElement | null;
    if (clearDietaryBtn) clearDietaryBtn.addEventListener("click", () => {
      store.dispatch({ type: "set_intent_dietary", dietary: undefined });
    });
    const clearTimeBtn = parent.querySelector('[data-clear="intent_time"]') as HTMLButtonElement | null;
    if (clearTimeBtn) clearTimeBtn.addEventListener("click", () => {
      store.dispatch({ type: "set_intent_time", time: undefined });
    });

    const intentDetails = parent.querySelector(".recipe-meta-intent") as HTMLDetailsElement | null;
    if (intentDetails) {
      intentDetails.addEventListener("toggle", () => {
        intentManuallyToggled = true;
      });
    }

    const ta = parent.querySelector("textarea.recipe-meta-extended-notes") as HTMLTextAreaElement;
    ta.addEventListener("input", () => {
      store.dispatch({ type: "set_extended_notes", extended_notes: ta.value });
    });

    parent.querySelectorAll<HTMLInputElement>(".bake-hints-list input[type='text']").forEach((input) => {
      input.addEventListener("input", () => {
        const idx = parseInt(input.dataset.hintIdx ?? "-1", 10);
        if (idx < 0) return;
        const next = [...(r.bake_hints ?? [])];
        next[idx] = input.value;
        store.dispatch({ type: "set_bake_hints", bake_hints: next });
      });
    });
    parent.querySelectorAll<HTMLButtonElement>(".bake-hint-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.hintIdx ?? "-1", 10);
        if (idx < 0) return;
        const next = [...(r.bake_hints ?? [])];
        next.splice(idx, 1);
        store.dispatch({ type: "set_bake_hints", bake_hints: next });
      });
    });
    (parent.querySelector(".bake-hint-add") as HTMLButtonElement).addEventListener("click", () => {
      store.dispatch({ type: "set_bake_hints", bake_hints: [...(r.bake_hints ?? []), ""] });
    });

    if (targetMode) {
      const input = parent.querySelector("#target-loaf-g") as HTMLInputElement;
      input.addEventListener("input", () => {
        const n = parseFloat(input.value);
        if (!Number.isFinite(n) || n <= 0) return;
        store.dispatch({ type: "set_target_loaf_g", grams: n });
      });
    }

    if (restoreSelector) {
      const el = parent.querySelector(restoreSelector) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) {
        el.focus();
        try { el.setSelectionRange(restoreStart, restoreEnd); } catch { /* some elements don't support */ }
      }
    }
  }
  store.subscribe(render);
  render();
}

function formatTotalMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function courseFingerprint(course: BBPDC20Course): string[] {
  const lines: string[] = [];
  if (course.hydration_range) {
    const idealText = course.hydration_range.ideal_pct !== undefined
      ? ` (ideal ${course.hydration_range.ideal_pct}%)`
      : "";
    lines.push(`Hydration: ${course.hydration_range.min_pct}–${course.hydration_range.max_pct}%${idealText}`);
  }
  if (course.whole_wheat_max_pct !== undefined) {
    lines.push(`Whole-wheat: up to ${course.whole_wheat_max_pct}%`);
  }
  if (course.yeast_compatibility.length > 0) {
    const yeastNames = course.yeast_compatibility.map((y) => y === "active_dry" ? "active dry" : y);
    lines.push(`Yeast: ${yeastNames.join(", ")}`);
  }
  if (course.loaf_sizes.length > 0) {
    lines.push(`Loaf sizes: ${course.loaf_sizes.join(", ")}`);
  }
  if (course.crust_shades.length > 0) {
    const crustText = course.crust_shades.length === 1
      ? `fixed ${course.crust_shades[0]}`
      : course.crust_shades.join(", ");
    lines.push(`Crust: ${crustText}`);
  }
  if (course.dietary_modes.length > 0) {
    lines.push(`Dietary: ${course.dietary_modes.join(", ").replace(/_/g, "-")}`);
  }
  lines.push(`Total time: ${formatTotalMinutes(course.total_minutes)} (medium crust)`);
  if (!course.bakes) {
    if (course.id === "dough" || course.id === "sourdough_starter") {
      lines.push("No bake — produces dough only");
    } else if (course.id === "jam") {
      lines.push("No bake — cooks fruit + sugar");
    } else {
      lines.push("No bake — output is not a baked loaf");
    }
  }
  return lines;
}

function renderSeeAllTable(recs: readonly CourseRecommendation[], db: Database): string {
  const courseName = (id: string) => db.courses.find((c) => c.id === id)?.name ?? id;
  const courseById = (id: string) => db.courses.find((c) => c.id === id);
  const rows = recs.map((rec) => {
    const rankText = rec.rank === null ? "—" : String(rec.rank);
    const eligText = rec.eligible ? "eligible" : "ineligible";
    const branchReason = rec.reasons.find((r) => r.kind === "tree_branch");
    const evidence = branchReason?.kind === "tree_branch" ? branchReason.evidence : "—";
    const course = courseById(rec.course_id);
    const detailId = `rec-row-detail-${rec.course_id}`;
    const notes = course?.recommended_for_notes ?? "";
    const fingerprintItems = course ? courseFingerprint(course).map((line) => `<li>${escapeHtml(line)}</li>`).join("") : "";
    return `
      <tr class="rec-row" data-eligible="${rec.eligible}">
        <td>${rankText}</td>
        <td>${escapeHtml(courseName(rec.course_id))}</td>
        <td>${eligText}</td>
        <td>${escapeHtml(evidence)}</td>
        <td><button type="button" class="rec-row-expand" aria-expanded="false" aria-controls="${detailId}">▸</button></td>
      </tr>
      <tr class="rec-row-detail" id="${detailId}" hidden>
        <td colspan="5">
          ${notes ? `<p class="rec-row-notes">${escapeHtml(notes)}</p>` : ""}
          <ul class="rec-row-fingerprint">${fingerprintItems}</ul>
        </td>
      </tr>
    `;
  }).join("");
  return `
    <table class="recommendation-table" id="rec-see-all-table">
      <thead><tr><th>Rank</th><th>Course</th><th>Verdict</th><th>Reason</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
