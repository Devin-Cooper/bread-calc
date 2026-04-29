import type { HydrationZone, ZoneId } from "./types.js";

// HYDRATION_ZONES provides the canonical zone metadata for v2.0. Each entry
// also carries a `color` used by plot.ts (kept here so the chart doesn't
// duplicate the zone definitions).
interface ZoneRow extends HydrationZone {
  color: string;
}

export const HYDRATION_ZONES: readonly ZoneRow[] = [
  { id: "dry",      label: "Dry",                   range: [0, 55],   note: "butter rolls; enriched",            color: "#e8e6e1" },
  { id: "sandwich", label: "Sandwich-loaf comfort", range: [55, 67],  note: "BB-PDC20 sweet spot",               color: "#d8e6d3" },
  { id: "wet",      label: "Wet",                   range: [67, 75],  note: "requires gluten support",           color: "#f3ecc6" },
  { id: "very_wet", label: "Very wet",              range: [75, 100], note: "GF / hi-hydration WW only",         color: "#f0d4cf" },
];

export function classifyZone(pct: number): HydrationZone {
  for (const z of HYDRATION_ZONES) {
    if (pct >= z.range[0] && pct < z.range[1]) {
      return { id: z.id, label: z.label, range: z.range, note: z.note };
    }
  }
  // pct >= 100 falls into very_wet via the last zone's inclusive top edge.
  if (pct >= HYDRATION_ZONES.at(-1)!.range[0]) {
    const z = HYDRATION_ZONES.at(-1)!;
    return { id: z.id, label: z.label, range: z.range, note: z.note };
  }
  // Negative or NaN — defensive default to "dry":
  const z = HYDRATION_ZONES[0]!;
  return { id: z.id, label: z.label, range: z.range, note: z.note };
}

export function classifyZoneId(pct: number): ZoneId {
  return classifyZone(pct).id;
}
