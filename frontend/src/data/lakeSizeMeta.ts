/**
 * Size buckets for the lake "Tamaño" sub-filter. Single source of truth for the
 * toggle chips and the bucket thresholds. `sizeBucketFor` mirrors the importer's
 * classification so the app can also bucket user-added lakes on the fly.
 */
import type { LakeSize } from "../types/place";

export const LAKE_SIZE_META: Record<
  LakeSize,
  { emoji: string; es: string; en: string; hint: string }
> = {
  grande: { emoji: "🏞️", es: "Grandes", en: "Large", hint: "≥ 1 km²" },
  mediana: { emoji: "💧", es: "Medianas", en: "Medium", hint: "0.1–1 km²" },
  pequena: { emoji: "🛶", es: "Pequeñas", en: "Small", hint: "1–10 ha" },
  diminuta: { emoji: "💦", es: "Diminutas", en: "Tiny", hint: "< 1 ha" },
};

/** Ordered, largest → smallest, for the toggle group. */
export const LAKE_SIZES = ["grande", "mediana", "pequena", "diminuta"] as const;

/** Classify an area in km² into a size bucket (same cuts as the importer). */
export function sizeBucketFor(km2: number): LakeSize {
  if (km2 >= 1) return "grande";
  if (km2 >= 0.1) return "mediana";
  if (km2 >= 0.01) return "pequena";
  return "diminuta";
}
