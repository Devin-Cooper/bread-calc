import type { Flour } from "./types.js";

export interface FlourComponent {
  flour: Flour;
  grams: number;
}

export function computeWeightedDdtWa(components: readonly FlourComponent[]): number | null {
  let totalGrams = 0;
  let weightedSum = 0;
  for (const c of components) {
    totalGrams += c.grams;
    weightedSum += c.grams * c.flour.ddt_water_absorption_pct;
  }
  if (totalGrams === 0) return null;
  return weightedSum / totalGrams;
}
