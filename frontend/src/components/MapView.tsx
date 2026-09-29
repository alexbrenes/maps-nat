import { useEffect, useMemo } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { Category, DraftLocation, Place } from "../types/place";
import { CATEGORY_META } from "../data/categoryMeta";
import type { OverlayKey } from "../data/overlayMeta";
import { COSTA_RICA_PLACES } from "../data/costaRica";
import { NATIONAL_BORDER, RIVERS } from "../data/overlays";
import { LAKE_SHAPES } from "../data/lakes";
import { AREA_OF, AREA_SHAPES } from "../data/areaBoundaries";
import { useI18n } from "../i18n/LanguageContext";

// INNER box — Costa Rica itself. Used only to frame the initial view so the
// country fills the screen; it is fully contained inside MAX_BOUNDS.
const COSTA_RICA_BOUNDS: L.LatLngBoundsLiteral = [
  [8.0, -85.95], // south-west
  [11.22, -82.55], // north-east
];

// OUTER box — the pannable / zoomable envelope. Derived from the data so EVERY
// marker is reachable (including far-offshore ones like Isla del Coco, ~550 km
// out), plus padding, then unioned with the mainland box so the envelope never
// shrinks below the country itself. Tiles are NOT clipped to this box — it only
// limits how far the view can move, so the viewport is always tile-filled (no
// grey void), yet you can't wander off to the rest of the world.
function computeMaxBounds(pad = 1.0): L.LatLngBoundsLiteral {
  let minLat = COSTA_RICA_BOUNDS[0][0];
  let minLng = COSTA_RICA_BOUNDS[0][1];
  let maxLat = COSTA_RICA_BOUNDS[1][0];
  let maxLng = COSTA_RICA_BOUNDS[1][1];
  for (const p of COSTA_RICA_PLACES) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  return [
    [minLat - pad, minLng - pad],
    [maxLat + pad, maxLng + pad],
  ];
}

const MAX_BOUNDS = computeMaxBounds();

// Build a marker icon from an emoji — avoids Leaflet's bundler-broken PNG icons.
function emojiIcon(emoji: string, size = 30): L.DivIcon {
  return L.divIcon({
    html: `<span class="emoji-marker">${emoji}</span>`,
    className: "emoji-marker-wrap",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const DRAFT_ICON = emojiIcon("📍", 34);

// Fixed highlight radius (metres) for places that have no area figure.
const DEFAULT_HIGHLIGHT_RADIUS = 2500;

// Informational point markers that shouldn't get an area highlight.
const NO_HIGHLIGHT: Set<Category> = new Set(["funFact", "other", "landmark", "oceanMilestone"]);

// Real area outline(s) for a place, if we have any: forests ship a single ring
// inline; parks are matched to OpenStreetMap boundaries (possibly multi-ring).
function boundaryRings(place: Place): [number, number][][] {
  if (place.boundary && place.boundary.length > 2) return [place.boundary];
  const lake = LAKE_SHAPES[place.id];
  if (lake && lake.length) return lake;
  const key = AREA_OF[place.id];
  const area = key ? AREA_SHAPES[key] : undefined;
  return area && area.length ? area : [];
}

// Approximate a circular radius (metres) from an area tag like "42,469 ha".
// Returns null when meta isn't an area (e.g. an altitude such as "1,670m").
function areaRadiusMeters(meta?: string): number | null {
  if (!meta) return null;
  const m = meta.match(/([\d.,]+)\s*ha\b/i);
  if (!m) return null;
  const hectares = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(hectares) || hectares <= 0) return null;
  return Math.sqrt((hectares * 10_000) / Math.PI); // m² -> radius
}

function ClickHandler({ onMapClick }: { onMapClick: (loc: DraftLocation) => void }) {
  useMapEvents({
    click(e) {
      onMapClick({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

function FocusFlyTo({
  place,
  radius,
  rings,
}: {
  place: Place | undefined;
  radius: number | null;
  rings: [number, number][][];
}) {
  const map = useMap();
  useEffect(() => {
    if (!place) return;
    const center: [number, number] = [place.latitude, place.longitude];
    if (rings.length) {
      // Frame the real area outline(s).
      map.flyToBounds(L.latLngBounds(rings.flat()), { maxZoom: 13, padding: [40, 40] });
    } else if (radius && radius > 800) {
      // Frame the whole highlighted area, with a little breathing room.
      map.flyToBounds(L.latLng(center).toBounds(radius * 2.6), { maxZoom: 14 });
    } else {
      map.flyTo(center, Math.max(map.getZoom(), 12));
    }
  }, [place, radius, rings, map]);
  return null;
}

interface MapViewProps {
  places: Place[];
  draft: DraftLocation | null;
  focusedId: string | null;
  overlays: Set<OverlayKey>;
  onMapClick: (loc: DraftLocation) => void;
}

export default function MapView({ places, draft, focusedId, overlays, onMapClick }: MapViewProps) {
  const { t, loc, categoryLabel } = useI18n();
  const focused = places.find((p) => p.id === focusedId);
  const highlightFocused = focused ? !NO_HIGHLIGHT.has(focused.category) : false;
  // Prefer a real area outline when the focused place has one; otherwise fall
  // back to the hectare-derived circle. Memoized so FocusFlyTo only re-runs
  // when the selection actually changes.
  const focusedRings = useMemo<[number, number][][]>(
    () => (focused && highlightFocused ? boundaryRings(focused) : []),
    [focused, highlightFocused],
  );
  const focusedRadius =
    highlightFocused && focused && focusedRings.length === 0 ? areaRadiusMeters(focused.meta) : null;

  return (
    <MapContainer
      bounds={COSTA_RICA_BOUNDS}
      boundsOptions={{ padding: [10, 10] }}
      minZoom={7}
      maxZoom={18}
      maxBounds={MAX_BOUNDS}
      maxBoundsViscosity={1.0}
      zoomControl={false}
      className="map"
    >
      {/* Zoom buttons on the right side, clear of the floating menu (left). */}
      <ZoomControl position="topright" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        noWrap
      />
      <ClickHandler onMapClick={onMapClick} />
      <FocusFlyTo place={focused} radius={focusedRadius} rings={focusedRings} />

      {/* Toggleable boundary/line overlays. */}
      {overlays.has("rivers") &&
        RIVERS.map((r, i) => (
          <Polyline
            key={`river-${i}`}
            positions={r.coords}
            pathOptions={{ color: "#2b7bb9", weight: 2, opacity: 0.7 }}
          />
        ))}
      {overlays.has("border") &&
        NATIONAL_BORDER.map((seg, i) => (
          <Polyline
            key={`border-${i}`}
            positions={seg}
            pathOptions={{ color: "#8a5a2b", weight: 2, dashArray: "5 5" }}
          />
        ))}

      {/* Highlight for the focused place: real outline if available, else circle. */}
      {focusedRings.map((ring, i) => (
        <Polygon
          key={`focus-ring-${i}`}
          positions={ring}
          pathOptions={{
            color: "#1f7a4d",
            weight: 2,
            dashArray: "6 6",
            fillColor: "#1f7a4d",
            fillOpacity: 0.2,
          }}
        />
      ))}
      {focused && highlightFocused && focusedRings.length === 0 && (
        <Circle
          center={[focused.latitude, focused.longitude]}
          radius={focusedRadius ?? DEFAULT_HIGHLIGHT_RADIUS}
          pathOptions={{
            color: "#1f7a4d",
            weight: 2,
            dashArray: "6 6",
            fillColor: "#1f7a4d",
            fillOpacity: 0.12,
          }}
        />
      )}

      {places.map((p) => (
        <Marker
          key={p.id}
          position={[p.latitude, p.longitude]}
          icon={emojiIcon(CATEGORY_META[p.category].emoji, p.id === focusedId ? 42 : 30)}
          zIndexOffset={p.id === focusedId ? 1000 : 0}
        >
          <Popup>
            <strong>{loc(p.name)}</strong>
            <div className="popup-category">
              {CATEGORY_META[p.category].emoji} {categoryLabel(p.category)}
              {p.meta ? ` · ${p.meta}` : ""}
            </div>
            {p.description && <p>{loc(p.description)}</p>}
          </Popup>
        </Marker>
      ))}

      {draft && (
        <Marker position={[draft.latitude, draft.longitude]} icon={DRAFT_ICON} opacity={0.7}>
          <Popup>{t.newPlaceHere}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
