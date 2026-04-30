import type { Store } from "../state.js";
import type { Database, Role, BBPDC20Course, Recipe } from "../../core/index.js";
import { computeRecipe, inferRole } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";
import { effectiveRecipe } from "../effective-recipe.js";
import { sortItemsForPrint } from "./load-order.js";
import { recommendCourse } from "../../core/recommend.js";

const PRINT_ROLE_KEY = "bread-calc:print-show-role";

function fmt(n: number | null | undefined, unit: string): string {
  return n == null ? "—" : `${unit === "%" ? n.toFixed(1) : Math.round(n)} ${unit}`;
}

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  function showRole(): boolean {
    try { return localStorage.getItem(PRINT_ROLE_KEY) === "1"; } catch { return false; }
  }

  function render(): void {
    const r = effectiveRecipe(store.getState(), db);
    let totalMass = 0, hyEff: number | null = null, zoneLabel = "—";
    let pcts: Record<string, number | null> = {};
    let solvedItems = r.items;
    try {
      const c = computeRecipe(r, db);
      totalMass = c.metrics.total_mass_g;
      hyEff = c.hydration.effective_pct;
      zoneLabel = c.hydration.zone?.label ?? "—";
      pcts = c.bakers_percents.by_uid;
      solvedItems = c.recipe.items;
    } catch { /* leave defaults */ }

    const ordered = sortItemsForPrint(solvedItems, db);
    const recipeName = store.getState().name ?? "Recipe";
    const notes = store.getState().notes ?? "";
    const includeRole = showRole();

    parent.innerHTML = `
      <article class="kc-card">
        ${renderHeader(recipeName, notes, totalMass, hyEff, zoneLabel)}
        <div class="kc-grid">
          ${renderIngredientsCol(ordered, db, pcts, includeRole)}
          ${renderRightCol(store.getState(), db)}
        </div>
        <footer class="kc-footer">breadmachine.io</footer>
      </article>
    `;
  }

  store.subscribe(render); render();
}

function prettyName(id: string, db: Database): string {
  const f = db.flours.find((x) => x.id === id); if (f) return f.name;
  const i = db.ingredients.find((x) => x.id === id); if (i) return i.name;
  return id;
}

function effectiveRole(item: { ingredient_id: string; role?: Role }, db: Database): Role | null {
  if (item.role) return item.role;
  const flour = db.flours.find((f) => f.id === item.ingredient_id);
  if (flour) return "flour";
  const ing = db.ingredients.find((i) => i.id === item.ingredient_id);
  if (ing) return inferRole(ing.category, ing.is_liquid ?? false);
  return null;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function formatLoafSize(s: string): string {
  return s.replace(/lb$/, " lb");
}

function resolveCrustLabel(recipe: Recipe, course: BBPDC20Course): string | null {
  if (recipe.crust_shade) return capitalize(recipe.crust_shade);
  if (course.crust_shades.length === 0) return null;
  if (course.crust_shades.includes("medium")) return "Medium";
  return capitalize(course.crust_shades[0]!);
}

function resolveSizeLabel(recipe: Recipe, course: BBPDC20Course): string | null {
  if (recipe.loaf_size) return formatLoafSize(recipe.loaf_size);
  if (course.loaf_sizes.length === 0) return null;
  if (course.loaf_sizes.includes("2lb")) return formatLoafSize("2lb");
  if (course.loaf_sizes.includes("1.5lb")) return formatLoafSize("1.5lb");
  return formatLoafSize(course.loaf_sizes[0]!);
}

function renderCrustSizeSubline(recipe: Recipe, course: BBPDC20Course): string | null {
  const crust = resolveCrustLabel(recipe, course);
  const size = resolveSizeLabel(recipe, course);
  const parts: string[] = [];
  if (crust) parts.push(`Crust:&nbsp;${escapeHtml(crust)}`);
  if (size) parts.push(`Size:&nbsp;${escapeHtml(size)}`);
  if (parts.length === 0) return null;
  return parts.join("&nbsp;·&nbsp;");
}

function renderHintsBlock(recipe: Recipe): string | null {
  const hints = (recipe.bake_hints ?? []).filter((h) => h.trim().length > 0);
  if (hints.length === 0) return null;
  const lis = hints.map((h) => `<li>${escapeHtml(h)}</li>`).join("");
  return `
    <div class="kc-hints-block">
      <h2 class="kc-section-heading">Bake hints</h2>
      <ul class="kc-hints-list">${lis}</ul>
    </div>
  `;
}

function renderNotesBlock(recipe: Recipe): string | null {
  const text = recipe.extended_notes ?? "";
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (paragraphs.length === 0) return null;
  const ps = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  return `
    <div class="kc-notes-block">
      <h2 class="kc-section-heading">Notes</h2>
      ${ps}
    </div>
  `;
}

function renderCourseBlock(recipe: Recipe, db: Database): string | null {
  let cardCourse: BBPDC20Course | null = null;
  let courseSource: "user" | "recommended" | null = null;

  if (recipe.course !== undefined) {
    const found = db.courses.find((c) => c.id === recipe.course);
    if (found) {
      cardCourse = found;
      courseSource = "user";
    }
  } else {
    const recs = recommendCourse(recipe, db);
    const top = recs.find((r) => r.eligible);
    if (top) {
      const found = db.courses.find((c) => c.id === top.course_id);
      if (found) {
        cardCourse = found;
        courseSource = "recommended";
      }
    }
  }

  if (cardCourse === null || courseSource === null) return null;

  const prefix = courseSource === "recommended" ? "Recommended: " : "";
  const heading = `${prefix}${cardCourse.course_number} — ${escapeHtml(cardCourse.name)}`;
  const subline = renderCrustSizeSubline(recipe, cardCourse);

  return `
    <div class="kc-course-block">
      <h2 class="kc-section-heading">Course</h2>
      <p class="kc-course-heading">${heading}</p>
      ${subline ? `<p class="kc-course-subline">${subline}</p>` : ""}
    </div>
  `;
}

function renderHeader(recipeName: string, notes: string, totalMass: number, hyEff: number | null, zoneLabel: string): string {
  return `
    <header class="kc-header">
      <div class="kc-header-text">
        <h1 class="kc-name">${escapeHtml(recipeName)}</h1>
        ${notes ? `<p class="kc-notes">${escapeHtml(notes)}</p>` : ""}
      </div>
      <div class="kc-metric-strip">
        <div class="kc-metric"><span class="kc-metric-label">Total</span><span class="kc-metric-value">${fmt(totalMass, "g")}</span></div>
        <div class="kc-metric"><span class="kc-metric-label">Hydration</span><span class="kc-metric-value">${fmt(hyEff, "%")}</span></div>
        <div class="kc-metric"><span class="kc-metric-label">Zone</span><span class="kc-metric-value">${escapeHtml(zoneLabel)}</span></div>
      </div>
    </header>
  `;
}

function renderIngredientsCol(
  ordered: ReadonlyArray<{ uid: string; ingredient_id: string; grams?: number; role?: Role }>,
  db: Database,
  pcts: Record<string, number | null>,
  includeRole: boolean,
): string {
  return `
    <div class="kc-col-left">
      <table class="kc-table">
        <thead>
          <tr>
            <th class="kc-th-name">Ingredient</th>
            <th class="kc-th-num">%</th>
            ${includeRole ? `<th class="kc-th-role">Role</th>` : ""}
            <th class="kc-th-num">Grams</th>
          </tr>
        </thead>
        <tbody>
          ${ordered.map((item) => {
            const grams = item.grams ?? 0;
            const pct = pcts[item.uid] ?? null;
            const role = effectiveRole(item, db);
            return `
              <tr>
                <td class="kc-td-name">${escapeHtml(prettyName(item.ingredient_id, db))}</td>
                <td class="kc-td-num">${pct == null ? "—" : pct.toFixed(1)}</td>
                ${includeRole ? `<td class="kc-td-role">${escapeHtml(role ?? "—")}</td>` : ""}
                <td class="kc-td-num">${Math.round(grams)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRightCol(recipe: Recipe, db: Database): string {
  const blocks: string[] = [];
  const c = renderCourseBlock(recipe, db);
  if (c) blocks.push(c);
  const n = renderNotesBlock(recipe);
  if (n) blocks.push(n);
  const h = renderHintsBlock(recipe);
  if (h) blocks.push(h);
  return `<div class="kc-col-right">${blocks.join("")}</div>`;
}
