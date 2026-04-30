import type { Store } from "../state.js";
import type { Database } from "../../core/index.js";
import { computeRecipe } from "../../core/index.js";
import { escapeHtml } from "../../core/escape.js";
import { effectiveRecipe } from "../effective-recipe.js";
import { attachTooltip } from "./tooltip.js";

// Zone definitions — kept in sync with src/core/zones.ts. The numeric ranges
// below are the visual track ranges; the spec/v2.0 HydrationZone.range field
// drives active-state detection at runtime, but the *display* track has fixed
// boundaries (dry < 60, sandwich 60–75, wet 75–88, very_wet > 88) so the
// segment widths are stable across recipes.
const ZONE_SEGMENTS: Array<{ id: string; label: string; min: number; max: number }> = [
  { id: "dry",       label: "dry",       min: 40, max: 60 },
  { id: "sandwich",  label: "sandwich",  min: 60, max: 75 },
  { id: "wet",       label: "wet",       min: 75, max: 88 },
  { id: "very_wet",  label: "very wet",  min: 88, max: 110 },
];
const TRACK_MIN = 40;
const TRACK_MAX = 110;
const TRACK_RANGE = TRACK_MAX - TRACK_MIN;

function pctOnTrack(hydration: number): number {
  const clamped = Math.max(TRACK_MIN, Math.min(TRACK_MAX, hydration));
  return ((clamped - TRACK_MIN) / TRACK_RANGE) * 100;
}

export function mount(parent: HTMLElement, store: Store, db: Database): void {
  function render(): void {
    const r = effectiveRecipe(store.getState(), db);
    let userHy: number | null = null;
    let activeZoneId: string | null = null;
    let activeNote = "";
    try {
      const c = computeRecipe(r, db);
      userHy = c.hydration.effective_pct;
      if (c.hydration.zone) {
        activeZoneId = c.hydration.zone.id;
        activeNote = c.hydration.zone.note;
      }
    } catch { /* leave nulls */ }

    const refs = (db.references ?? []).filter((ref) => !("excluded_from_chart" in ref) || !(ref as unknown as { excluded_from_chart?: boolean }).excluded_from_chart);

    const userPct = userHy != null ? pctOnTrack(userHy) : null;

    parent.innerHTML = `
      <h2 class="type-heading-lg zone-band-heading">Where you land
        <button type="button" class="help-icon" data-help="zones" aria-label="Explain hydration zones">?</button>
      </h2>
      <div class="zone-band" role="img"
           aria-label="${ariaLabel(userHy, activeZoneId, refs.length)}">
        ${ZONE_SEGMENTS.map((z) => {
          const left = pctOnTrack(z.min);
          const width = pctOnTrack(z.max) - pctOnTrack(z.min);
          const active = z.id === activeZoneId ? " is-active" : "";
          return `<div class="zone-segment${active}" data-zone-id="${z.id}"
                       style="left: ${left}%; width: ${width}%;">
                    <span class="zone-segment-label type-body-sm">${z.label}</span>
                  </div>`;
        }).join("")}
        ${refs.map((ref) => {
          const left = pctOnTrack(ref.hydration_pct_nominal);
          return `<button type="button" class="zone-tick" data-tick-name="${escapeHtml(ref.name)}"
                          data-tick-zone="${escapeHtml(ref.zone)}"
                          data-tick-hy="${ref.hydration_pct_nominal}"
                          aria-label="${escapeHtml(ref.name)}, ${ref.hydration_pct_nominal}% hydration"
                          style="left: ${left}%;"></button>`;
        }).join("")}
        ${userPct != null ? `
          <div class="zone-marker" tabindex="0" role="img"
               aria-label="Your recipe at ${userHy!.toFixed(0)}% hydration"
               style="left: ${userPct}%;">
            <span class="type-numeric-md zone-marker-value">${userHy!.toFixed(0)} %</span>
            <span class="zone-marker-arrow" aria-hidden="true">▼</span>
          </div>` : ""}
      </div>
      <p class="zone-note type-body-md">${activeNote ? escapeHtml(activeNote) : "Add ingredients to see where your recipe lands."}</p>
    `;

    parent.querySelectorAll<HTMLButtonElement>(".zone-tick").forEach((btn) => {
      attachTooltip(btn, {
        content: `<strong>${escapeHtml(btn.dataset["tickName"]!)}</strong><br/>${escapeHtml(btn.dataset["tickZone"]!)} · ${btn.dataset["tickHy"]} %`,
      });
    });

    parent.querySelectorAll<HTMLElement>("[data-help]").forEach((btn) => {
      const key = btn.dataset["help"]!;
      attachTooltip(btn, { content: helpText(key) });
    });
  }

  store.subscribe(render);
  render();
}

function ariaLabel(userHy: number | null, activeZoneId: string | null, refCount: number): string {
  if (userHy == null) return `Hydration zone band. ${refCount} reference recipes plotted.`;
  return `Your recipe is at ${userHy.toFixed(0)}% hydration${activeZoneId ? ` in the ${activeZoneId.replace("_", " ")} zone` : ""}. ${refCount} reference recipes plotted.`;
}

function helpText(key: string): string {
  if (key === "zones") {
    return `Bread doughs are grouped into four hydration zones: dry, sandwich, wet, very wet. <a href="/learn.html#zones">Read more</a>`;
  }
  return "";
}
