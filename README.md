# maps-nat — Special Places in Costa Rica

An interactive map for collecting special places across Costa Rica. Click the map
to drop a pin, describe the place, and it shows up as a marker you can revisit and
filter by category.

## Architecture

Two decoupled services that agree only on a JSON API contract:

```
Frontend (SPA)                         Backend API (Phase 2)
React + Vite + TypeScript   ──HTTP──▶  Rust (Axum + SQLx)
Leaflet + OpenStreetMap     ◀──────    │
                                       ▼
                              PostgreSQL + PostGIS
```

## Status

- **Phase 1 — Frontend (done):** Full map + add/view/filter/delete places, backed by
  a `localStorage` stub. See [`frontend/`](./frontend).
- **Phase 2 — Backend (planned):** Rust (Axum + SQLx) API over PostgreSQL + PostGIS.
  Swap `frontend/src/api/places.ts` from the localStorage stub to `fetch()` calls —
  no component changes required.
  - **Serve boundary geometry from the API, not the bundle.** The reference overlays
    (forest polygons, rivers, national border in `frontend/src/data/overlays.ts` +
    the `boundary` rings in `costaRica.ts`) and the OpenStreetMap protected-area
    boundaries and lake polygons (`frontend/src/data/areaBoundaries.ts`,
    `frontend/src/data/lakes.ts`) currently ship inside the JS bundle (~790 KB total). In Phase 2, expose this as a fetched GeoJSON endpoint
    (PostGIS `ST_AsGeoJSON`, ideally viewport-filtered and geometry-simplified with
    `ST_SimplifyPreserveTopology`) so the geometry loads on demand and the JS bundle
    shrinks back down.

## Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

The data layer lives entirely in [`frontend/src/api/places.ts`](./frontend/src/api/places.ts).
It's the only file that knows where places are stored, so moving from localStorage to
the real backend touches nothing else.

### Data model (shared contract)

```ts
type Category =
  | "volcano" | "peak" | "park" | "wildlife" | "waterfall" | "forest"
  | "landmark" | "funFact" | "airport" | "port" | "marineWildlife"
  | "oceanMilestone" | "island" | "beach" | "restaurant" | "other";

// Text may be bilingual (imported reference data) or a plain string (user input).
type Localized = string | { es: string; en: string };

interface Place {
  id: string;
  name: Localized;
  description: Localized;
  category: Category;
  latitude: number;
  longitude: number;
  meta?: string;                  // altitude/area tag, e.g. "1,670m", "42,469 ha"
  boundary?: [number, number][];  // optional area outline (e.g. forest rings)
  photos?: string[];
  createdAt: string;              // ISO 8601
}
```

See [`frontend/src/types/place.ts`](./frontend/src/types/place.ts) for the source of
truth. The Phase 2 backend stores location as PostGIS `geography(Point, 4326)` to enable
proximity ("places near me") and viewport (bounding-box) queries.
