/**
 * One-shot importer: fetches lake / reservoir / lagoon polygons from
 * OpenStreetMap (Overpass API) for Costa Rica and emits `src/data/lakes.ts`
 * as seed *places* in the "lake" category (clickable, filterable markers that
 * highlight their outline on click, like parks). ECR ships no lakes of its own.
 *
 * We keep named still-water bodies (water=lake|reservoir|lagoon), drop rivers,
 * require the centroid to sit inside mainland Costa Rica (so the giant Nicaraguan
 * Lago Cocibolca on the border is excluded) and drop anything below a minimum
 * area so the overlay stays a handful of recognisable lakes, not thousands of
 * ponds.
 *
 * Run:  node scripts/import-osm-lakes.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const CR_BBOX = "8.0,-86.0,11.3,-82.5";
// Mainland envelope for the centroid test (keeps CR, drops Nicaragua's lakes).
const CR = { minlat: 8.0, maxlat: 11.22, minlng: -85.95, maxlng: -82.55 };
const MIN_AREA_KM2 = 0.5; // ~50 ha — drops ponds, keeps real lakes
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = OVERPASS_MIRRORS[attempt % OVERPASS_MIRRORS.length];
    try {
      console.log(`  → ${url} (attempt ${attempt + 1})`);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "maps-nat importer (github.com/alexbre) - one-shot lake fetch",
          Accept: "application/json",
        },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(90_000),
      });
      if (res.ok) return res.json();
      lastErr = new Error(`Overpass ${res.status} from ${url}`);
      console.log(`    ${lastErr.message}`);
    } catch (e) {
      lastErr = e;
      console.log(`    ${e.name}: ${e.message}`);
    }
    await sleep(2000 * (attempt + 1));
  }
  throw lastErr;
}

const eq = (p, q) => p[0] === q[0] && p[1] === q[1];

function stitchRings(ways) {
  const remaining = ways.filter((w) => w.length > 1).map((w) => w.slice());
  const rings = [];
  while (remaining.length) {
    let ring = remaining.shift();
    let extended = true;
    while (extended && !eq(ring[0], ring[ring.length - 1])) {
      extended = false;
      for (let i = 0; i < remaining.length; i++) {
        const w = remaining[i];
        const s = ring[0];
        const e = ring[ring.length - 1];
        if (eq(e, w[0])) ring = ring.concat(w.slice(1));
        else if (eq(e, w[w.length - 1])) ring = ring.concat(w.slice().reverse().slice(1));
        else if (eq(s, w[w.length - 1])) ring = w.slice(0, -1).concat(ring);
        else if (eq(s, w[0])) ring = w.slice().reverse().slice(0, -1).concat(ring);
        else continue;
        remaining.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (ring.length > 3) rings.push(ring);
  }
  return rings;
}

function simplify(ring) {
  const EPS = 0.0005; // ~55 m — lakes are smaller than parks, keep more detail
  const out = [];
  for (const [lat, lng] of ring) {
    const p = [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5];
    const last = out[out.length - 1];
    if (!last || Math.abs(p[0] - last[0]) > EPS || Math.abs(p[1] - last[1]) > EPS) out.push(p);
  }
  if (out.length > 2 && !eq(out[0], out[out.length - 1])) out.push(out[0]);
  return out;
}

// Rough km² from a ring list, via shoelace in degrees scaled at ~10°N.
function areaKm2(rings) {
  let deg2 = 0;
  for (const r of rings) {
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][1] * r[i][0] - r[i][1] * r[j][0];
    deg2 += Math.abs(a / 2);
  }
  const kmPerDegLat = 110.57;
  const kmPerDegLng = 111.32 * Math.cos((10 * Math.PI) / 180);
  return deg2 * kmPerDegLat * kmPerDegLng;
}

function centroid(rings) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const r of rings)
    for (const [lat, lng] of r) {
      sy += lat;
      sx += lng;
      n++;
    }
  return [sy / n, sx / n];
}

// ---- Fetch geometry for named still-water bodies ----------------------------
console.log("Querying Overpass for named lakes / reservoirs / lagoons…");
const resp = await overpass(`
[out:json][timeout:120];
(
  relation["natural"="water"]["water"~"^(lake|reservoir|lagoon)$"]["name"](${CR_BBOX});
  way["natural"="water"]["water"~"^(lake|reservoir|lagoon)$"]["name"](${CR_BBOX});
);
out geom;
`);

function ringsOf(el) {
  if (el.type === "way" && Array.isArray(el.geometry)) {
    return stitchRings([el.geometry.map((g) => [g.lat, g.lon])]).map(simplify).filter((r) => r.length > 3);
  }
  if (el.type === "relation" && el.members) {
    const outers = el.members
      .filter((m) => m.type === "way" && (m.role === "outer" || m.role === "") && Array.isArray(m.geometry))
      .map((m) => m.geometry.map((g) => [g.lat, g.lon]));
    return stitchRings(outers).map(simplify).filter((r) => r.length > 3);
  }
  return [];
}

const lakes = [];
const seen = new Set();
for (const el of resp.elements || []) {
  const rings = ringsOf(el);
  if (!rings.length) continue;
  const km2 = areaKm2(rings);
  if (km2 < MIN_AREA_KM2) continue;
  const [clat, clng] = centroid(rings);
  if (clat < CR.minlat || clat > CR.maxlat || clng < CR.minlng || clng > CR.maxlng) continue;
  const name = el.tags?.name || "";
  const key = name.toLowerCase();
  if (seen.has(key)) continue; // way + relation duplicates of the same lake
  seen.add(key);
  lakes.push({ name: { es: name, en: el.tags?.["name:en"] || name }, km2, rings });
}
lakes.sort((a, b) => b.km2 - a.km2);
console.log(`Kept ${lakes.length} lakes ≥ ${MIN_AREA_KM2} km²:`);
lakes.forEach((l) => console.log(`  • ${l.name.es} (${l.km2.toFixed(1)} km²)`));

// ---- Write the generated module ---------------------------------------------
// Each lake becomes a seed Place (category "lake") plus an entry in LAKE_SHAPES
// (keyed by place id) holding its full outline so MapView can highlight it on
// click, exactly like the OSM park boundaries.
const places = [];
const shapes = {};
lakes.forEach((l, i) => {
  const id = `lake-${i}`;
  const [lat, lng] = centroid(l.rings);
  places.push({
    id,
    name: l.name,
    description: "",
    category: "lake",
    latitude: Math.round(lat * 1e5) / 1e5,
    longitude: Math.round(lng * 1e5) / 1e5,
    meta: `${l.km2.toFixed(1)} km²`,
    createdAt: "2024-01-01T00:00:00.000Z",
  });
  shapes[id] = l.rings;
});

const banner =
  "// AUTO-GENERATED by scripts/import-osm-lakes.mjs — do not edit by hand.\n" +
  "// Lake / reservoir polygons from OpenStreetMap (© OpenStreetMap contributors,\n" +
  "// ODbL). LAKE_PLACES seed the \"lake\" category; LAKE_SHAPES holds each lake's\n" +
  "// outline (keyed by place id) for the click highlight. Regenerate with:\n" +
  "//   node scripts/import-osm-lakes.mjs\n";
const body =
  'import type { Place } from "../types/place";\n\n' +
  `export const LAKE_PLACES: Place[] = ${JSON.stringify(places, null, 2)};\n\n` +
  `export const LAKE_SHAPES: Record<string, [number, number][][]> = ${JSON.stringify(shapes)};\n`;
const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "lakes.ts");
writeFileSync(outPath, banner + "\n" + body);
console.log(`\nWrote ${outPath}`);
