import type { ComputedRecipe, BBPDC20Recipe } from "./types.js";
import { HYDRATION_ZONES } from "./zones.js";
import { escapeXml } from "./escape.js";

export interface ChartOptions {
  reference?: readonly BBPDC20Recipe[];
  width?: number;
  height?: number;
  theme?: "light" | "dark";
}

const COURSE_COLORS: Record<string, string> = {
  "White": "#d4a857",
  "Whole Wheat": "#8b4513",
  "European": "#888",
  "Multigrain": "#a0826d",
  "Gluten Free": "#c952d4",
  "Salt Free": "#5fa9d4",
  "Sugar Free": "#7fb3e0",
  "Vegan": "#3e9c50",
  "Rapid": "#d68a3c",
  "Dough": "#a0826d",
  "Sourdough": "#5b3a29",
};

function courseColor(course: string): string {
  for (const k of Object.keys(COURSE_COLORS)) if (course.startsWith(k)) return COURSE_COLORS[k]!;
  return "#666";
}

export function renderHydrationChart(computed: ComputedRecipe, options: ChartOptions = {}): string {
  const W = options.width ?? 720;
  const H = options.height ?? 480;
  const M = { top: 40, right: 160, bottom: 56, left: 64 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const xMin = 380, xMax = 760;
  const yMin = 50, yMax = 90;
  const x = (g: number) => M.left + ((g - xMin) / (xMax - xMin)) * plotW;
  const y = (h: number) => M.top + (1 - (h - yMin) / (yMax - yMin)) * plotH;

  const refs = (options.reference ?? []).filter((r) => !r.excluded_from_chart);
  const userPlotted = computed.hydration.nominal_pct != null && computed.totals.total_flour_g > 0;

  const bands = HYDRATION_ZONES.map((z) => {
    const yTop = y(Math.min(z.max, yMax));
    const yBot = y(Math.max(z.min, yMin));
    return `<rect class="zone-band ${z.id}" x="${M.left}" y="${yTop}" width="${plotW}" height="${yBot - yTop}" fill="${z.color}" stroke="none"><title>${escapeXml(z.label)} (${z.min}–${z.max}%)</title></rect>`;
  }).join("");

  const dots = refs.map((r) => {
    const cx = x(r.total_flour_g), cy = y(r.hydration_pct_nominal);
    const c = courseColor(r.course);
    return `<circle class="ref-dot" cx="${cx}" cy="${cy}" r="5" fill="${c}" stroke="#fff" stroke-width="1"><title>${escapeXml(`${r.name} — ${r.hydration_pct_nominal}% · ${r.total_flour_g} g flour (${r.course})`)}</title></circle>`;
  }).join("");

  let star = "";
  let userTitle = "";
  if (userPlotted) {
    const cx = x(computed.totals.total_flour_g), cy = y(computed.hydration.nominal_pct!);
    const points = [0, 1, 2, 3, 4].flatMap((i) => {
      const a = (Math.PI / 2) - (i * 2 * Math.PI / 5);
      const ai = a - Math.PI / 5;
      return [`${cx + 12 * Math.cos(a)},${cy - 12 * Math.sin(a)}`, `${cx + 5 * Math.cos(ai)},${cy - 5 * Math.sin(ai)}`];
    }).join(" ");
    const label = `${escapeXml(computed.recipe.name ?? "Your recipe")} — ${computed.hydration.nominal_pct!.toFixed(1)}% · ${computed.totals.total_flour_g} g flour`;
    star = `<polygon class="user-star" points="${points}" fill="#000" stroke="#fff" stroke-width="1.5"><title>${label}</title></polygon>
            <text x="${cx + 18}" y="${cy + 4}" font-family="system-ui, sans-serif" font-size="12" fill="#000">${label}</text>`;
  } else {
    userTitle = `<title>no flour — not plotted</title>`;
  }

  const xTicks = [400, 450, 500, 550, 600, 650, 700, 750];
  const yTicks = [50, 55, 60, 65, 70, 75, 80, 85, 90];
  const axes = `
    <g class="axes" font-family="system-ui, sans-serif" font-size="11" fill="#333">
      ${xTicks.map((g) => `<text x="${x(g)}" y="${H - M.bottom + 16}" text-anchor="middle">${g}</text><line x1="${x(g)}" x2="${x(g)}" y1="${H - M.bottom}" y2="${H - M.bottom + 4}" stroke="#333" />`).join("")}
      ${yTicks.map((h) => `<text x="${M.left - 8}" y="${y(h) + 4}" text-anchor="end">${h}%</text><line x1="${M.left - 4}" x2="${M.left}" y1="${y(h)}" y2="${y(h)}" stroke="#333" />`).join("")}
      <text x="${M.left + plotW / 2}" y="${H - 12}" text-anchor="middle" font-size="13">Total flour (g)</text>
      <text transform="translate(${16},${M.top + plotH / 2}) rotate(-90)" text-anchor="middle" font-size="13">Hydration % (total water / flour)</text>
    </g>`;

  const legendItems = HYDRATION_ZONES.map((z, i) => `<rect x="0" y="${i * 18}" width="14" height="14" fill="${z.color}" stroke="#999" /><text x="20" y="${i * 18 + 11}" font-size="11">${escapeXml(z.label)}</text>`).join("");
  const legend = `<g class="legend" transform="translate(${W - M.right + 8},${M.top})">${legendItems}<text x="0" y="${HYDRATION_ZONES.length * 18 + 16}" font-size="11" fill="#555">★ Your recipe</text></g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="BB-PDC20 hydration map">
    <title>${escapeXml(computed.recipe.name ?? "Recipe")} placement on the BB-PDC20 hydration map</title>
    <desc>Y axis shows nominal (total-water-content) hydration percentage. The user's recipe is plotted by nominal hydration; the warnings panel uses effective hydration which may classify into a different zone.</desc>
    ${userTitle}
    ${bands}
    ${dots}
    ${star}
    ${axes}
    ${legend}
  </svg>`;
}
