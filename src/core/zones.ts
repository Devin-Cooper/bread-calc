import type { ZoneId } from "./types.js";

export interface HydrationZone {
  id: ZoneId;
  min: number;
  max: number;
  label: string;
  color: string;
  note: string;
}

export const HYDRATION_ZONES: readonly HydrationZone[] = [
  { id: "dry",      min: 0,   max: 55,  label: "Dry",                   color: "#e8e6e1", note: "butter rolls; enriched" },
  { id: "sandwich", min: 55,  max: 67,  label: "Sandwich-loaf comfort", color: "#d8e6d3", note: "BB-PDC20 sweet spot" },
  { id: "wet",      min: 67,  max: 75,  label: "Wet",                   color: "#f3ecc6", note: "requires gluten support" },
  { id: "very_wet", min: 75,  max: 100, label: "Very wet",              color: "#f0d4cf", note: "GF / hi-hydration WW only" },
];

export function classifyZone(pct: number): ZoneId {
  for (const z of HYDRATION_ZONES) {
    if (pct >= z.min && pct < z.max) return z.id;
  }
  // pct === 100 falls into very_wet via the last zone's [min, max] inclusive top edge:
  if (pct >= HYDRATION_ZONES.at(-1)!.min) return HYDRATION_ZONES.at(-1)!.id;
  // Negative or NaN — defensive default to "dry":
  return "dry";
}
