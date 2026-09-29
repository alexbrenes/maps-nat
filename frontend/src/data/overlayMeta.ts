/**
 * Boundary/line overlay layers that can be toggled independently of the
 * point-marker categories. Single source of truth for the toggle chips and
 * the layers rendered on the map.
 */
export type OverlayKey = "rivers" | "border";

export const OVERLAY_META: Record<OverlayKey, { emoji: string; es: string; en: string }> = {
  rivers: { emoji: "💧", es: "Ríos", en: "Rivers" },
  border: { emoji: "🗺️", es: "Frontera", en: "Border" },
};

/** Ordered overlay list for the toggle group. */
export const OVERLAY_KEYS = Object.keys(OVERLAY_META) as OverlayKey[];
