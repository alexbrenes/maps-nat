import type { Category } from "../types/place";

/**
 * Per-category display metadata: an emoji marker icon and bilingual labels.
 * This is the single source of truth for the category list, filter chips,
 * marker icons, and localized category names.
 */
export const CATEGORY_META: Record<Category, { emoji: string; es: string; en: string }> = {
  volcano: { emoji: "🌋", es: "Volcanes", en: "Volcanoes" },
  peak: { emoji: "⛰️", es: "Cerros", en: "Peaks" },
  park: { emoji: "🏞️", es: "Parques Nacionales", en: "National Parks" },
  wildlife: { emoji: "🐾", es: "Fauna terrestre", en: "Land Wildlife" },
  waterfall: { emoji: "💧", es: "Cataratas", en: "Waterfalls" },
  forest: { emoji: "🌳", es: "Bosques", en: "Forests" },
  landmark: { emoji: "📜", es: "Hitos históricos", en: "Historical Milestones" },
  funFact: { emoji: "💡", es: "Datos curiosos", en: "Fun Facts" },
  airport: { emoji: "✈️", es: "Aeropuertos", en: "Airports" },
  port: { emoji: "⚓", es: "Puertos", en: "Ports" },
  marineWildlife: { emoji: "🐋", es: "Fauna marina", en: "Marine Wildlife" },
  oceanMilestone: { emoji: "🌊", es: "Hitos oceánicos", en: "Ocean Milestones" },
  island: { emoji: "🏝️", es: "Islas", en: "Islands" },
  lake: { emoji: "🛶", es: "Lagos", en: "Lakes" },
  beach: { emoji: "🏖️", es: "Playas", en: "Beaches" },
  restaurant: { emoji: "🍽️", es: "Restaurantes", en: "Restaurants" },
  other: { emoji: "📍", es: "Otro", en: "Other" },
};

/** Ordered category list for menus and filters. */
export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];
