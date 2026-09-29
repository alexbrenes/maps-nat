/**
 * One-shot importer: fetches protected-area boundary polygons from OpenStreetMap
 * (Overpass API) and matches them to the ECR point markers whose areas we want
 * to highlight — parks, volcanoes, peaks, islands and land-wildlife/reserve
 * markers. Forests already ship their own inline ring from import-ecr.mjs.
 *
 * Matching, per marker (keyed by the same ecr-{layer}-{i} id):
 *   1. exact/contained normalized NAME match against a protected area, else
 *   2. the SMALLEST protected-area polygon that geometrically CONTAINS the point
 *      (so a peak inside a park gets the park, not a huge conservation area, and
 *      overlapping areas resolve to the tightest fit).
 *
 * Emits `src/data/areaBoundaries.ts` as Record<placeId, [lat, lng][][]>.
 *
 * Run:  node scripts/import-osm-areas.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ECR_URL = "https://www.esencialcostarica.com/mapainteractivo/map-data.js";
const CR_BBOX = "5.0,-87.5,11.3,-82.5"; // Costa Rica incl. offshore Isla del Coco
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// ECR marker layers whose areas we want to highlight (forests are inline).
// Land-wildlife markers are excluded on purpose: a species isn't an area, and
// matching them highlighted whole parks/reserves, which was misleading.
const TARGET_LAYERS = ["parques", "volcanes", "cerros", "islas"];

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
          "User-Agent": "maps-nat importer (github.com/alexbre) - one-shot area boundary fetch",
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

// ---- 1. ECR markers we want to attach areas to ------------------------------
const ecrSrc = await (await fetch(ECR_URL, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
const MAP_DATA = new Function(`${ecrSrc}\n;return MAP_DATA;`)();
const markers = [];
for (const layer of TARGET_LAYERS) {
  (MAP_DATA[layer] || []).forEach((it, i) => {
    if (typeof it.lat === "number" && typeof it.lng === "number") {
      markers.push({ id: `ecr-${layer}-${i}`, es: it.name?.es ?? "", en: it.name?.en ?? "", lat: it.lat, lng: it.lng });
    }
  });
}
console.log(`Targeting ${markers.length} markers across ${TARGET_LAYERS.length} layers.`);

// ---- 2. Protected areas in Costa Rica: tags + bounding box (light query) ----
function norm(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/\bp\.?\s*n\.?\b/g, "")
    .replace(/\br\.?\s*n\.?\s*v\.?\s*s\.?\b/g, "")
    .replace(
      /parque nacional|national park|reserva natural absoluta|reserva biologica|refugio (nacional )?(de vida silvestre)?|wildlife refuge|biological reserve|absolute (natural )?reserve|reserva forestal|forest reserve|zona protectora|protected zone|humedal|wetland|monumento nacional|national monument/g,
      "",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

console.log("Querying Overpass for protected-area names + bounds…");
const bbResp = await overpass(`
[out:json][timeout:120];
(
  relation["boundary"="protected_area"]["name"](${CR_BBOX});
  relation["boundary"="national_park"]["name"](${CR_BBOX});
);
out tags bb;
`);
const areas = (bbResp.elements || [])
  .filter((e) => e.type === "relation" && e.bounds)
  .map((e) => ({
    id: e.id,
    tagName: e.tags?.name || "",
    name: norm(e.tags?.name || e.tags?.["name:es"] || ""),
    b: e.bounds,
  }));
console.log(`Overpass returned ${areas.length} protected areas.`);

// ---- 3. Candidate relations: name matches + bbox-containing per marker -------
const bboxContains = (a, lat, lng) =>
  lat >= a.b.minlat && lat <= a.b.maxlat && lng >= a.b.minlon && lng <= a.b.maxlon;

const nameHit = new Map(); // marker.id -> area.id
const needed = new Set();
for (const m of markers) {
  const keyEs = norm(m.es);
  const keyEn = norm(m.en);
  if (keyEs || keyEn) {
    const hit =
      areas.find((a) => a.name && (a.name === keyEs || a.name === keyEn)) ||
      areas.find(
        (a) =>
          a.name &&
          ((keyEs && (a.name.includes(keyEs) || keyEs.includes(a.name))) ||
            (keyEn && (a.name.includes(keyEn) || keyEn.includes(a.name)))),
      );
    if (hit) {
      nameHit.set(m.id, hit.id);
      needed.add(hit.id);
    }
  }
  for (const a of areas) if (bboxContains(a, m.lat, m.lng)) needed.add(a.id);
}
console.log(`Fetching geometry for ${needed.size} candidate relations…`);

// ---- 4. Geometry for candidates, stitched into rings ------------------------
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
  const EPS = 0.001; // ~110 m — invisible at park-level zoom, ~halves the data
  const out = [];
  for (const [lat, lng] of ring) {
    const p = [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5];
    const last = out[out.length - 1];
    if (!last || Math.abs(p[0] - last[0]) > EPS || Math.abs(p[1] - last[1]) > EPS) out.push(p);
  }
  if (out.length > 2 && !eq(out[0], out[out.length - 1])) out.push(out[0]);
  return out;
}

function ringsOf(rel) {
  const outers = rel.members
    .filter((m) => m.type === "way" && (m.role === "outer" || m.role === "") && Array.isArray(m.geometry))
    .map((m) => m.geometry.map((g) => [g.lat, g.lon]));
  return stitchRings(outers)
    .map(simplify)
    .filter((r) => r.length > 3);
}

// Signed-area magnitude (deg²) — only used to compare relative sizes.
function ringsArea(rings) {
  let total = 0;
  for (const r of rings) {
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][1] * r[i][0] - r[i][1] * r[j][0];
    total += Math.abs(a / 2);
  }
  return total;
}

function pointInRings(lat, lng, rings) {
  let inside = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [yi, xi] = r[i];
      const [yj, xj] = r[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const geomResp = needed.size
  ? await overpass(`[out:json][timeout:180];relation(id:${[...needed].join(",")});out geom;`)
  : { elements: [] };
const built = new Map(); // area.id -> { rings, area }
for (const el of geomResp.elements || []) {
  if (el.type === "relation" && el.members) {
    const rings = ringsOf(el);
    if (rings.length) built.set(el.id, { rings, area: ringsArea(rings) });
  }
}

// ---- 5. Assign one boundary per marker (name first, else smallest container) -
// Deduplicated: each protected area's geometry is stored ONCE in AREA_SHAPES
// (keyed by its OSM relation id), and every marker that resolves to it just
// references that key in AREA_OF. Many markers share an area (a volcano + its
// park, several peaks in La Amistad…), so this avoids copying big polygons.
const AREA_SHAPES = {}; // "r<relId>" -> [lat, lng][][]
const AREA_OF = {}; // placeId -> "r<relId>"
const matched = [];
const unmatched = [];
for (const m of markers) {
  let chosen = null;
  const nid = nameHit.get(m.id);
  if (nid && built.has(nid)) chosen = { id: nid, ...built.get(nid) };
  if (!chosen) {
    let best = null;
    for (const a of areas) {
      if (!bboxContains(a, m.lat, m.lng)) continue;
      const bt = built.get(a.id);
      if (!bt || !pointInRings(m.lat, m.lng, bt.rings)) continue;
      if (!best || bt.area < best.area) best = { id: a.id, ...bt };
    }
    chosen = best;
  }
  if (chosen) {
    const key = `r${chosen.id}`;
    if (!AREA_SHAPES[key]) AREA_SHAPES[key] = chosen.rings;
    AREA_OF[m.id] = key;
    const tag = areas.find((a) => a.id === chosen.id)?.tagName || chosen.id;
    matched.push(`${m.es} → ${tag}`);
  } else {
    unmatched.push(m.es);
  }
}

// ---- 6. Write the generated module ------------------------------------------
const banner =
  "// AUTO-GENERATED by scripts/import-osm-areas.mjs — do not edit by hand.\n" +
  "// Protected-area boundaries from OpenStreetMap (© OpenStreetMap contributors,\n" +
  "// ODbL). AREA_SHAPES holds each area's rings once (keyed by OSM relation id);\n" +
  "// AREA_OF maps each ecr-{layer}-{i} place id to its shape. Regenerate with:\n" +
  "//   node scripts/import-osm-areas.mjs\n";
const body =
  `export const AREA_SHAPES: Record<string, [number, number][][]> = ${JSON.stringify(AREA_SHAPES)};\n\n` +
  `export const AREA_OF: Record<string, string> = ${JSON.stringify(AREA_OF, null, 2)};\n`;
const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "areaBoundaries.ts");
writeFileSync(outPath, banner + "\n" + body);

console.log(`\nMatched ${matched.length}/${markers.length} markers:`);
matched.forEach((m) => console.log("  ✓ " + m));
if (unmatched.length) console.log(`\nNo area (kept as point): ${unmatched.length}\n  ✗ ` + unmatched.join("\n  ✗ "));
