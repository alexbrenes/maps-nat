import type { NewPlace, Place } from "../types/place";
import { COSTA_RICA_PLACES } from "../data/costaRica";
import { LAKE_PLACES } from "../data/lakes";

// Reference seed: ECR points plus the OpenStreetMap lakes (own "lake" category).
const SEED_PLACES: Place[] = [...COSTA_RICA_PLACES, ...LAKE_PLACES];

/**
 * Data layer for places.
 *
 * This is the ONLY module that knows where place data lives. Today it is backed
 * by localStorage (with async signatures that mimic a real network API). When the
 * Rust/PostGIS backend lands in Phase 2, replace the bodies here with `fetch()`
 * calls — no component needs to change.
 */

// Bumped when the seed dataset changes (v3 added the OpenStreetMap lakes; v4
// dropped the lake size filter, growing 19 → 183 named lakes/reservoirs/lagoons;
// v5 tagged each lake with a size bucket for the "Tamaño" sub-filter).
const STORAGE_KEY = "maps-nat.places.v5";

function load(): Place[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as Place[];
    } catch {
      // Corrupt storage — fall through to seeding.
    }
  }
  save(SEED_PLACES);
  return SEED_PLACES;
}

function save(places: Place[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
}

// Simulated latency so the UI is built for async from day one.
const delay = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function makeId(): string {
  return crypto.randomUUID?.() ?? String(Date.now() + Math.random());
}

export async function listPlaces(): Promise<Place[]> {
  await delay();
  return load();
}

export async function createPlace(input: NewPlace): Promise<Place> {
  await delay();
  const place: Place = {
    ...input,
    id: makeId(),
    createdAt: new Date().toISOString(),
  };
  save([...load(), place]);
  return place;
}

export async function deletePlace(id: string): Promise<void> {
  await delay();
  save(load().filter((p) => p.id !== id));
}
