export type Category =
  | "volcano"
  | "peak"
  | "park"
  | "wildlife"
  | "waterfall"
  | "forest"
  | "landmark"
  | "funFact"
  | "airport"
  | "port"
  | "marineWildlife"
  | "oceanMilestone"
  | "island"
  | "lake"
  | "beach"
  | "restaurant"
  | "other";

/**
 * Size bucket for lakes/reservoirs/lagoons, used by the "Tamaño" sub-filter.
 * grande ≥ 1 km² · mediana 0.1–1 km² · pequena 0.01–0.1 km² (1–10 ha) ·
 * diminuta < 0.01 km² (< 1 ha).
 */
export type LakeSize = "grande" | "mediana" | "pequena" | "diminuta";

/** Text that may be bilingual. User-entered values are plain strings. */
export interface LocalizedText {
  es: string;
  en: string;
}
export type Localized = string | LocalizedText;

/** A special place on the map. Mirrors the future backend `places` table. */
export interface Place {
  id: string;
  name: Localized;
  description: Localized;
  category: Category;
  latitude: number;
  longitude: number;
  /** Language-agnostic tag such as altitude or area (e.g. "1,670m", "42,469 ha"). */
  meta?: string;
  /** Size bucket for lake-category places (drives the "Tamaño" sub-filter). */
  size?: LakeSize;
  /** Optional area outline as a [lat, lng] ring (e.g. forest boundaries). */
  boundary?: [number, number][];
  photos?: string[];
  createdAt: string; // ISO 8601 timestamp
}

/** Fields the user supplies when creating a place (server assigns id + createdAt). */
export type NewPlace = Omit<Place, "id" | "createdAt">;

/** A location picked on the map but not yet saved. */
export interface DraftLocation {
  latitude: number;
  longitude: number;
}
