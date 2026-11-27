#!/usr/bin/env node
/**
 * Bakes one city's street/water/park detail from US Census TIGER/Line (public domain) into a local metre plane.
 * Dev/CI only: this is the only place that touches the network; the render reads the baked JSON.
 *
 *   node scripts/map_bake_city.mjs <id> [--detail=light|rich|both] [--budget=400] [--cities=public/kit/map/cities.json]
 *                                      [--year=2025] [--local=<dir of tl_YYYY_GEOID_kind.zip>] [--force]
 *
 * Input: cities.json = [{id, name, lat, lng, boxKm?}] (boxKm default 14). Add a city by adding a row; no code change.
 * Counties: those whose polygon meets the city box, from public/kit/map/regions/counties.json (bake it first).
 * TIGER/Line per county (https://www2.census.gov/geo/tiger/TIGER<year>/): ROADS, AREAWATER, LINEARWATER, AREALM.
 * Output: public/kit/map/cities/<id>.json (rich) and <id>.light.json (light):
 *   {id, name, lat, lng, detail, vintage, bbox:{minX,maxX,minY,maxY}, centre:{x:0,y:0},
 *    classes:{primary, secondary, local?, ramp?, service?, other?, water}: string[]   // SVG path strings, longest first
 *    polygons:{water, parks}: string[]}                                               // rich only, filled areas
 * Plane: metres, x EAST, y SOUTH (y flipped so paths draw upright); x=(lon-lon0)*cos(lat0)*111320, y=-(lat-lat0)*110574
 * (the same flat plane as PayRanked's street files, so map_bake_alignment.mjs uses the same method).
 */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync, readdirSync, rmSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {feature} from 'topojson-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const id = argv.find((a) => !a.startsWith('--'));
const opt = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] ?? true]; }));
if (!id) { console.error('usage: node scripts/map_bake_city.mjs <id> [--detail=light|rich|both] [--budget=KB] [--year=YYYY] [--local=dir] [--force]'); process.exit(2); }
const DETAIL = String(opt.detail ?? 'both');
const BUDGET = Number(opt.budget ?? 400) * 1024;
const FORCE = Boolean(opt.force);
const CITIES = join(ROOT, String(opt.cities ?? 'public/kit/map/cities.json'));
const OUT_DIR = join(ROOT, 'public', 'kit', 'map', 'cities');
const CACHE = join(ROOT, '.cache', 'census', 'tiger');
const YEARS = opt.year ? [String(opt.year)] : ['2025', '2024', '2023']; // newest first; first one that answers wins

// ---- MTFCC (MAF/TIGER Feature Class Codes) -> kit class -------------------------------------------------------
// Official list: https://www.census.gov/library/reference/code-lists/mt-feature-class-codes.html (TIGER/Line Technical
// Documentation, appendix "MAF/TIGER Feature Class Code Definitions"). ONE table; any code seen in the data but missing
// here is counted in the report as "unmapped" so the table can be audited against the official list.
const MTFCC = {
  // roads (ROADS layer)
  S1100: ['road', 'primary'],    // Primary Road (limited-access highway)
  S1200: ['road', 'secondary'],  // Secondary Road (main arteries, US/state/county highways)
  S1400: ['road', 'local'],      // Local Neighborhood Road, Rural Road, City Street
  S1630: ['road', 'ramp'],       // Ramp
  S1640: ['road', 'service'],    // Service Drive usually along a limited access highway
  S1500: ['road', 'other'],      // Vehicular Trail (4WD)
  S1730: ['road', 'other'],      // Alley
  S1740: ['road', 'other'],      // Private Road for service vehicles
  S1780: ['road', 'other'],      // Parking Lot Road
  S1710: ['skip', 'walkway'],    // Walkway/Pedestrian Trail (not drawn)
  S1720: ['skip', 'stairway'],   // Stairway
  S1750: ['skip', 'internal'],   // Internal Census Bureau use
  S1820: ['skip', 'bikepath'],   // Bike Path or Trail
  S1830: ['skip', 'bridle'],     // Bridle Path
  S2000: ['skip', 'median'],     // Road Median
  // water (AREAWATER / LINEARWATER layers)
  H2030: ['water', 'lake'],      // Lake/Pond
  H2040: ['water', 'reservoir'], // Reservoir
  H2041: ['water', 'treatment'], // Treatment Pond
  H2051: ['water', 'bay'],       // Bay/Estuary/Gulf/Sound
  H2053: ['water', 'ocean'],     // Ocean/Sea
  H2060: ['water', 'pit'],       // Gravel Pit/Quarry filled with water
  H1100: ['skip', 'connector'], // Connector (water line across a water body; not drawn)
  H2081: ['water', 'glacier'],   // Glacier
  H3010: ['water', 'stream'],    // Stream/River
  H3013: ['water', 'braided'],   // Braided Stream
  H3020: ['water', 'canal'],     // Canal, Ditch or Aqueduct
  // area landmarks (AREALM layer): parks and similar green/recreation land
  K2180: ['park', 'park'],       // Park (State or Local)
  K2181: ['park', 'park'],       // National Park Service Land
  K2182: ['park', 'park'],       // National Forest or Other Federal Land
  K2183: ['park', 'park'],       // Tribal Park, Forest, or Recreation Area
  K2184: ['park', 'park'],       // State Park, Forest, or Recreation Area
  K2185: ['park', 'park'],       // Regional Park, Forest, or Recreation Area
  K2186: ['park', 'park'],       // County Park, Forest, or Recreation Area
  K2187: ['park', 'park'],       // County Subdivision Park, Forest, or Recreation Area
  K2188: ['park', 'park'],       // Incorporated Place Park, Forest, or Recreation Area
  K2189: ['park', 'park'],       // Private Park, Forest, or Recreation Area
  K2190: ['park', 'park'],       // Other Park, Forest, or Recreation Area
};

// Douglas-Peucker tolerance (m) and minimum length (m) per class and tier. Polygons: [tol, min area m2].
const TIERS = {
  light: {primary: [3, 15], secondary: [4, 20], water: [4, 20]},
  rich: {primary: [2, 10], secondary: [2.5, 12], local: [3, 25], ramp: [2, 12], service: [3, 20], other: [4, 40], water: [3, 15], waterArea: [3, 4000], park: [4, 5000]},
};
const ROAD_CLASSES = ['primary', 'secondary', 'local', 'ramp', 'service', 'other'];

// ---- helpers -----------------------------------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function download(url, cachePath, {retries = 4, base = 1000} = {}) {
  if (existsSync(cachePath) && !FORCE && statSync(cachePath).size > 0) return cachePath;
  mkdirSync(dirname(cachePath), {recursive: true});
  let last;
  for (let a = 0; a <= retries; a++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) { const e = new Error('HTTP 404'); e.notFound = true; throw e; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 100) throw new Error(`tiny response ${buf.length}`);
      writeFileSync(cachePath, buf);
      return cachePath;
    } catch (e) { last = e; if (e.notFound) break; console.warn(`  ${url}: ${e.message} (try ${a + 1})`); if (a < retries) await sleep(base * 2 ** a); }
  }
  throw Object.assign(new Error(`giving up on ${url}: ${last?.message}`), {notFound: last?.notFound});
}
const mapshaper = (args) => execFileSync(join(ROOT, 'node_modules', '.bin', 'mapshaper'), args, {stdio: ['ignore', 'inherit', 'inherit']});

// ---- city + box ---------------------------------------------------------------------------------------------------
const cities = JSON.parse(readFileSync(CITIES, 'utf8'));
const city = cities.find((c) => c.id === id);
if (!city) { console.error(`no city "${id}" in ${CITIES}`); process.exit(2); }
const boxKm = city.boxKm ?? 14;
const M_LAT = 110574, M_LON_EQ = 111320;
const k = Math.cos((city.lat * Math.PI) / 180) * M_LON_EQ;
const half = (boxKm * 1000) / 2;
const plane = ([lon, lat]) => [(lon - city.lng) * k, -(lat - city.lat) * M_LAT];
const bbox = {minX: -half, maxX: half, minY: -half, maxY: half};
const lonLat = {w: city.lng - half / k, e: city.lng + half / k, s: city.lat - half / M_LAT, n: city.lat + half / M_LAT};

// ---- counties meeting the box ---------------------------------------------------------------------------------------
function countiesInBox() {
  const f = join(ROOT, 'public', 'kit', 'map', 'regions', 'counties.json');
  if (!existsSync(f)) throw new Error('public/kit/map/regions/counties.json missing: run the "Bake map regions" workflow first');
  const topo = JSON.parse(readFileSync(f, 'utf8'));
  const fc = feature(topo, topo.objects[Object.keys(topo.objects)[0]]);
  const inBox = ([x, y]) => x >= lonLat.w && x <= lonLat.e && y >= lonLat.s && y <= lonLat.n;
  const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const corners = [[lonLat.w, lonLat.s], [lonLat.e, lonLat.s], [lonLat.w, lonLat.n], [lonLat.e, lonLat.n], [city.lng, city.lat]];
  const hit = [];
  for (const ft of fc.features) {
    const polys = ft.geometry.type === 'Polygon' ? [ft.geometry.coordinates] : ft.geometry.coordinates;
    let meets = false;
    for (const poly of polys) {
      const ring = poly[0];
      if (ring.some(inBox) || corners.some((c) => inRing(c, ring))) { meets = true; break; }
    }
    if (meets) hit.push(String(ft.id ?? ft.properties.GEOID));
  }
  if (!hit.length) throw new Error('no county meets the city box');
  return hit.sort();
}

// ---- geometry -----------------------------------------------------------------------------------------------------
const len = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
const dp = (pts, tol) => {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, z] = st.pop(); const [ax, ay] = pts[a], [zx, zy] = pts[z];
    const dx = zx - ax, dy = zy - ay, den = Math.hypot(dx, dy); let best = -1, bi = -1;
    for (let i = a + 1; i < z; i++) { const d = den === 0 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs(dy * pts[i][0] - dx * pts[i][1] + zx * ay - zy * ax) / den; if (d > best) { best = d; bi = i; } }
    if (best > tol && bi > 0) { keep[bi] = 1; st.push([a, bi], [bi, z]); }
  }
  return pts.filter((_, i) => keep[i]);
};
const area = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(s / 2); };
const r1 = (v) => Math.round(v * 10) / 10;
const enc = (pts, close) => 'M' + pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L') + (close ? 'Z' : '');
const onEdge = (a, b) => { const e = 0.05; return (Math.abs(a[0] - bbox.minX) < e && Math.abs(b[0] - bbox.minX) < e) || (Math.abs(a[0] - bbox.maxX) < e && Math.abs(b[0] - bbox.maxX) < e) || (Math.abs(a[1] - bbox.minY) < e && Math.abs(b[1] - bbox.minY) < e) || (Math.abs(a[1] - bbox.maxY) < e && Math.abs(b[1] - bbox.maxY) < e); };
/** ring -> polylines, dropping the stretches that only run along the clip box (they are not coastline). */
const ringToLines = (ring) => { const out = []; let cur = [ring[0]]; for (let i = 1; i < ring.length; i++) { if (onEdge(ring[i - 1], ring[i])) { if (cur.length > 1) out.push(cur); cur = [ring[i]]; } else cur.push(ring[i]); } if (cur.length > 1) out.push(cur); return out; };
const lines = (g) => !g ? [] : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
const polys = (g) => !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];

// ---- download + clip per layer ---------------------------------------------------------------------------------------
const LAYERS = {roads: ['ROADS', 'roads'], areawater: ['AREAWATER', 'areawater'], linearwater: ['LINEARWATER', 'linearwater'], arealm: ['AREALM', 'arealm']};
async function fetchLayer(layer, countyIds) {
  // TIGER/Line publishes ROADS, AREAWATER and LINEARWATER per county, but landmarks (AREALM) per STATE (tl_<year>_<ST>_arealm.zip).
  const geoids = layer === 'arealm' ? [...new Set(countyIds.map((g) => g.slice(0, 2)))] : countyIds;
  let vintage = null; const zips = [];
  for (const g of geoids) {
    let got = null;
    for (const y of (vintage ? [vintage] : YEARS)) {
      const name = `tl_${y}_${g}_${LAYERS[layer][1]}.zip`;
      if (opt.local) { const p = join(String(opt.local), name); if (existsSync(p)) { got = {p, y}; break; } continue; }
      try { got = {p: await download(`https://www2.census.gov/geo/tiger/TIGER${y}/${LAYERS[layer][0]}/${name}`, join(CACHE, y, name)), y}; break; }
      catch (e) { if (!e.notFound) throw e; }
    }
    if (!got) { if (opt.local || layer === 'arealm' || layer === 'linearwater') { console.warn(`  ${layer} ${g}: not published, skipped`); continue; } throw new Error(`${layer} ${g}: no TIGER file found for ${YEARS.join('/')}`); }
    vintage = got.y; zips.push(got.p);
  }
  return {zips, vintage};
}
function clipToGeoJson(zips, layer, tmp) {
  if (!zips.length) return {features: []};
  const out = join(tmp, `${layer}.json`);
  const dissolve = layer === 'areawater' || layer === 'arealm';
  const cmds = ['-i', ...zips, 'combine-files', '-merge-layers', '-filter-fields', 'MTFCC'];
  if (dissolve) cmds.push('-dissolve2', 'MTFCC'); // union across county seams (water/parks split at county lines)
  cmds.push('-clip', `bbox=${lonLat.w},${lonLat.s},${lonLat.e},${lonLat.n}`, '-o', out, 'format=geojson', 'precision=0.000001');
  mapshaper(cmds);
  return JSON.parse(readFileSync(out, 'utf8'));
}

// ---- build one tier -----------------------------------------------------------------------------------------------------
function build(raw, detail, scale = 1, drop = []) {
  const T = TIERS[detail];
  const classes = {}; const polygons = {water: [], parks: []}; const counts = {};
  const add = (cls, pts) => (classes[cls] ??= []).push({pts, l: len(pts)});
  const push = (cls, p, [tol, minLen]) => { const s = dp(p.map(plane), tol * scale); if (len(s) >= minLen * scale) add(cls, s); };
  for (const ft of raw.roads.features) {
    const [kind, cls] = MTFCC[ft.properties.MTFCC] ?? ['unmapped', ft.properties.MTFCC];
    counts[ft.properties.MTFCC] = (counts[ft.properties.MTFCC] ?? 0) + 1;
    if (kind !== 'road' || !T[cls] || drop.includes(cls)) continue;
    for (const l of lines(ft.geometry)) push(cls, l, T[cls]);
  }
  for (const ft of raw.linearwater.features) { const [kind] = MTFCC[ft.properties.MTFCC] ?? ['unmapped']; counts[ft.properties.MTFCC] = (counts[ft.properties.MTFCC] ?? 0) + 1; if (kind !== 'water') continue; for (const l of lines(ft.geometry)) push('water', l, T.water); }
  for (const ft of raw.areawater.features) {
    const [kind] = MTFCC[ft.properties.MTFCC] ?? ['unmapped']; counts[ft.properties.MTFCC] = (counts[ft.properties.MTFCC] ?? 0) + 1;
    if (kind !== 'water') continue;
    for (const poly of polys(ft.geometry)) {
      const outer = poly[0].map(plane);
      if (area(outer) < (detail === 'rich' ? T.waterArea[1] : 8000)) continue;
      for (const ring of poly) for (const l of ringToLines(ring.map(plane))) { const s = dp(l, T.water[0] * scale); if (len(s) >= T.water[1] * scale) add('water', s); }
      if (detail === 'rich') {
        const [tol, minA] = T.waterArea;
        const rings = poly.map((r) => dp(r.map(plane), tol * scale)).filter((r, i) => r.length >= 4 && (i === 0 || area(r) > minA * scale));
        if (rings.length) polygons.water.push(rings.map((r) => enc(r, true)).join(''));
      }
    }
  }
  if (detail === 'rich') for (const ft of raw.arealm.features) {
    const [kind] = MTFCC[ft.properties.MTFCC] ?? ['unmapped']; counts[ft.properties.MTFCC] = (counts[ft.properties.MTFCC] ?? 0) + 1;
    if (kind !== 'park') continue;
    for (const poly of polys(ft.geometry)) {
      const rings = poly.map((r) => dp(r.map(plane), T.park[0] * scale)).filter((r, i) => r.length >= 4 && (i === 0 || area(r) > T.park[1] * scale));
      if (rings.length && area(rings[0]) >= T.park[1] * scale) polygons.parks.push(rings.map((r) => enc(r, true)).join(''));
    }
  }
  const out = {};
  const order = detail === 'light' ? ['primary', 'secondary', 'water'] : [...ROAD_CLASSES, 'water'];
  for (const c of order) out[c] = (classes[c] ?? []).sort((a, b) => b.l - a.l).map((x) => enc(x.pts));
  return {classes: out, polygons, counts};
}

const sizeOf = (o) => Buffer.byteLength(JSON.stringify(o));
function assemble(raw, detail, vintage) {
  const head = {id: city.id, name: city.name, lat: city.lat, lng: city.lng, detail, vintage, bbox, centre: {x: 0, y: 0}, boxKm};
  const steps = detail === 'light' ? [[1, []]] : [[1, []], [1.5, []], [2, []], [3, ['other']], [3, ['other', 'service']], [4, ['other', 'service']]];
  let best;
  for (const [scale, drop] of steps) {
    const b = build(raw, detail, scale, drop);
    best = {...head, classes: b.classes, polygons: b.polygons, budget: {scale, dropped: drop}};
    if (detail === 'light' || sizeOf(best) <= BUDGET) return {out: best, counts: b.counts};
  }
  // still over: trim shortest local roads until it fits
  const loc = best.classes.local;
  while (sizeOf(best) > BUDGET && loc.length > 50) loc.length = Math.floor(loc.length * 0.9);
  best.budget.trimmedLocal = true;
  return {out: best, counts: build(raw, detail, 1).counts};
}

// ---- main ---------------------------------------------------------------------------------------------------------------
const geoids = countiesInBox();
console.log(`${city.id}: box ${boxKm} km at ${city.lat},${city.lng}; counties ${geoids.join(', ')}`);
const tmp = join(ROOT, '.cache', 'city-tmp', city.id);
rmSync(tmp, {recursive: true, force: true}); mkdirSync(tmp, {recursive: true});
const raw = {}; let vintage = null; const sources = [];
for (const layer of Object.keys(LAYERS)) {
  const {zips, vintage: v} = await fetchLayer(layer, geoids);
  if (v) vintage = vintage ?? v;
  raw[layer] = clipToGeoJson(zips, layer, tmp);
  sources.push({layer, vintage: v, files: zips.length});
  console.log(`  ${layer}: ${raw[layer].features.length} features in box (TIGER${v ?? '-'})`);
}
mkdirSync(OUT_DIR, {recursive: true});
const rows = []; const unmapped = {};
for (const detail of DETAIL === 'both' ? ['light', 'rich'] : [DETAIL]) {
  const {out, counts} = assemble(raw, detail, vintage);
  for (const [code, n] of Object.entries(counts)) if (!MTFCC[code]) unmapped[code] = n;
  const file = join(OUT_DIR, detail === 'rich' ? `${city.id}.json` : `${city.id}.light.json`);
  writeFileSync(file, JSON.stringify(out));
  const bytes = statSync(file).size;
  const row = {city: city.id, detail, kb: +(bytes / 1024).toFixed(1), budget: out.budget};
  for (const [c, p] of Object.entries(out.classes)) row[c] = p.length;
  row.waterPolys = out.polygons.water.length; row.parks = out.polygons.parks.length;
  rows.push(row);
}
console.table(rows);
if (Object.keys(unmapped).length) console.warn('MTFCC codes in the data but not in the table (audit against the official list):', unmapped);
writeFileSync(join(OUT_DIR, `${city.id}.report.json`), JSON.stringify({rows, unmapped, counties: geoids, sources}, null, 1));
