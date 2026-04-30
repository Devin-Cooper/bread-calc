import type { Store } from "../state.js";
import type { Database } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";
import { recommendCourse } from "../../core/recommend.js";
import type { CourseRecommendation } from "../../core/recommend.js";

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  let seeAllOpen = false;

  function render() {
    const r = store.getState();
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
          const top = recs.find((rec) => rec.eligible);
          if (!top) {
            return `<div class="recommendation-strip recommendation-empty">No compatible course found.</div>`;
          }
          const topName = db.courses.find((c) => c.id === top.course_id)?.name ?? top.course_id;
          const branchReason = top.reasons.find((r) => r.kind === "tree_branch");
          const branchName = branchReason?.kind === "tree_branch" ? branchReason.branch : "default_white";
          const matchLabel = `(via ${branchName})`;

          if (r.course === undefined) {
            return `
              <div class="recommendation-strip">
                <span class="rec-label">Recommended: <strong>${escapeHtml(topName)}</strong> ${matchLabel}</span>
                <button type="button" class="rec-use-this" data-rec-id="${escapeHtml(top.course_id)}">Use this</button>
                <button type="button" class="rec-see-all" aria-expanded="${seeAllOpen ? "true" : "false"}">See all</button>
              </div>
              ${seeAllOpen ? renderSeeAllTable(recs, db) : ""}
            `;
          }
          if (r.course === top.course_id) {
            return `
              <div class="recommendation-strip">
                <span class="rec-label">Top match: <strong>✓ ${escapeHtml(topName)}</strong> ${matchLabel}</span>
                <button type="button" class="rec-see-all" aria-expanded="${seeAllOpen ? "true" : "false"}">See all</button>
              </div>
              ${seeAllOpen ? renderSeeAllTable(recs, db) : ""}
            `;
          }
          // State C
          const userRec = recs.find((rec) => rec.course_id === r.course);
          const userRank = userRec?.rank ?? null;
          const eligibleCount = recs.filter((rec) => rec.eligible).length;
          const userCourseName = db.courses.find((c) => c.id === r.course)?.name ?? r.course;
          const userBlurb = userRank !== null
            ? `Your pick (${escapeHtml(userCourseName)}) is rank #${userRank} of ${eligibleCount} eligible`
            : `Your pick (${escapeHtml(userCourseName)}) is ineligible`;
          return `
            <div class="recommendation-strip">
              <span class="rec-label">Recommended: <strong>${escapeHtml(topName)}</strong> ${matchLabel} · ${userBlurb}</span>
              <button type="button" class="rec-use-top" data-rec-id="${escapeHtml(top.course_id)}">Use top match</button>
              <button type="button" class="rec-see-all" aria-expanded="${seeAllOpen ? "true" : "false"}">See all</button>
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

    const useThisBtn = parent.querySelector(".rec-use-this") as HTMLButtonElement | null;
    if (useThisBtn) {
      useThisBtn.addEventListener("click", () => {
        const id = useThisBtn.dataset.recId;
        if (id) store.dispatch({ type: "set_course", course: id });
      });
    }
    const useTopBtn = parent.querySelector(".rec-use-top") as HTMLButtonElement | null;
    if (useTopBtn) {
      useTopBtn.addEventListener("click", () => {
        const id = useTopBtn.dataset.recId;
        if (id) store.dispatch({ type: "set_course", course: id });
      });
    }
    const seeAllBtn = parent.querySelector(".rec-see-all") as HTMLButtonElement | null;
    if (seeAllBtn) {
      seeAllBtn.addEventListener("click", () => {
        seeAllOpen = !seeAllOpen;
        render();
      });
    }

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

function renderSeeAllTable(recs: readonly CourseRecommendation[], db: Database): string {
  const courseName = (id: string) => db.courses.find((c) => c.id === id)?.name ?? id;
  const rows = recs.map((rec) => {
    const rankText = rec.rank === null ? "—" : String(rec.rank);
    const eligText = rec.eligible ? "eligible" : "ineligible";
    const branchReason = rec.reasons.find((r) => r.kind === "tree_branch");
    const evidence = branchReason?.kind === "tree_branch" ? branchReason.evidence : "—";
    return `<tr class="rec-row" data-eligible="${rec.eligible}"><td>${rankText}</td><td>${escapeHtml(courseName(rec.course_id))}</td><td>${eligText}</td><td>${escapeHtml(evidence)}</td></tr>`;
  }).join("");
  return `
    <table class="recommendation-table">
      <thead><tr><th>Rank</th><th>Course</th><th>Verdict</th><th>Reason</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
