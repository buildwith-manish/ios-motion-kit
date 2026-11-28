#!/usr/bin/env node
/**
 * Bakes public/kit/map/cities/alignment.json: for each city in cities.json, where its street-plane centre lands on the
 * 1600 x 1000 US-outline plane and how a city file (local metres, x EAST, y SOUTH) must be transformed to sit on it:
 *   { [id]: { x, y, unitsPerMetre, unitsPerMetreNorth, rotationDeg } }
 * Same method as PayRanked's build_city_alignment.ts: project the centre, a point D m east and D m north (street-plane
 * metres, converted back to lon/lat with the baker's formulas); east/north vectors give scale and rotation; the grid maps
 * to the outline plane as  translate(x, y) rotate(rotationDeg) scale(unitsPerMetre, unitsPerMetreNorth).
 *
 *   node scripts/map_bake_alignment.mjs
 *
 * The projection is NOT re-implemented here: src/kit/map/projection.ts (fitUsOutline) is bundled with esbuild and used as is,
 * so the alignment cannot drift from what <MapCanvas> draws. Inputs: public/kit/map/regions/outline.json (baked) and cities.json.
 * Checks before writing (it throws, writes nothing): every centre projects inside the plane and onto the contiguous-US
 * landmass (or within 6 units of it, for coastal cities against a generalised coastline); east/north are perpendicular
 * (< 0.01 deg); a 6 km diagonal agrees with the linear model (< 0.02 units); for baked city files, the 14 km box
 * is centred on {0,0} and its four corners land inside the plane.
 */
import {buildSync} from 'esbuild';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {geoContains, geoDistance} from 'd3-geo';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(ROOT, '.cache', 'projection.bundle.mjs');
mkdirSync(dirname(tmp), {recursive: true});
buildSync({entryPoints: [join(ROOT, 'src/kit/map/projection.ts')], bundle: true, format: 'esm', platform: 'node', packages: 'external', outfile: tmp, logLevel: 'error'});
const {fitUsOutline, outlineLand, OUTLINE_W, OUTLINE_H} = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);

const outlineFile = join(ROOT, 'public/kit/map/regions/outline.json');
if (!existsSync(outlineFile)) throw new Error('regions/outline.json missing: run the "Bake map regions" workflow first');
const topo = JSON.parse(readFileSync(outlineFile, 'utf8'));
const projection = fitUsOutline(topo);
const land = outlineLand(topo);
const cities = JSON.parse(readFileSync(join(ROOT, 'public/kit/map/cities.json'), 'utf8'));

const M_LAT = 110574, M_LON_EQ = 111320, D = 1000;
const proj = (lon, lat) => { const p = projection([lon, lat]); if (!p) throw new Error(`no projection for ${lon},${lat}`); return p; };
const num = (v, d) => Number(v.toFixed(d));
const out = {}; const report = [];
for (const c of cities) {
  const k = Math.cos((c.lat * Math.PI) / 180) * M_LON_EQ;
  const at = (X, Y) => proj(c.lng + X / k, c.lat - Y / M_LAT); // street (X east, Y south) -> outline plane
  const p0 = at(0, 0);
  if (p0[0] < 0 || p0[0] > OUTLINE_W || p0[1] < 0 || p0[1] > OUTLINE_H) throw new Error(`${c.id}: centre outside the ${OUTLINE_W}x${OUTLINE_H} plane`);
  const onLand = geoContains(land, [c.lng, c.lat]);
  if (!onLand) {
    // distance to the landmass boundary in plane units (rough: sample the ring vertices)
    const rings = land.geometry.type === 'Polygon' ? land.geometry.coordinates : land.geometry.coordinates.flat();
    let best = Infinity;
    for (const r of rings) for (const v of r) { const [x, y] = proj(v[0], v[1]); best = Math.min(best, Math.hypot(x - p0[0], y - p0[1])); }
    if (best > 6) throw new Error(`${c.id}: centre is ${best.toFixed(1)} units off the US landmass`);
    console.warn(`${c.id}: centre falls just outside the generalised landmass (${best.toFixed(1)} units): coastal`);
  }
  void geoDistance;
  const pe = at(D, 0), pn = at(0, -D);
  const e = [(pe[0] - p0[0]) / D, (pe[1] - p0[1]) / D], n = [(pn[0] - p0[0]) / D, (pn[1] - p0[1]) / D];
  const u = Math.hypot(...e), uN = Math.hypot(...n);
  const rot = (Math.atan2(e[1], e[0]) * 180) / Math.PI;
  const skew = (Math.atan2(n[0], -n[1]) * 180) / Math.PI - rot;
  if (Math.abs(skew) > 0.01) throw new Error(`${c.id}: east and north not perpendicular (skew ${skew.toFixed(4)} deg)`);
  const far = at(6000, -6000);
  const dev = Math.hypot(far[0] - (p0[0] + 6000 * e[0] + 6000 * n[0]), far[1] - (p0[1] + 6000 * e[1] + 6000 * n[1]));
  if (dev > 0.02) throw new Error(`${c.id}: 6 km corner deviates ${dev.toFixed(4)} units from the linear model`);
  const cf = join(ROOT, 'public/kit/map/cities', `${c.id}.json`);
  if (existsSync(cf)) {
    const s = JSON.parse(readFileSync(cf, 'utf8'));
    if (s.centre.x !== 0 || s.centre.y !== 0 || Math.abs(s.bbox.minX + s.bbox.maxX) > 1 || Math.abs(s.bbox.minY + s.bbox.maxY) > 1) throw new Error(`${c.id}: city box is not centred on {0,0}`);
    for (const [X, Y] of [[s.bbox.minX, s.bbox.minY], [s.bbox.maxX, s.bbox.minY], [s.bbox.minX, s.bbox.maxY], [s.bbox.maxX, s.bbox.maxY]]) {
      const [x, y] = at(X, Y); if (x < 0 || x > OUTLINE_W || y < 0 || y > OUTLINE_H) throw new Error(`${c.id}: box corner outside the plane`);
    }
  }
  out[c.id] = {x: num(p0[0], 4), y: num(p0[1], 4), unitsPerMetre: num(u, 10), unitsPerMetreNorth: num(uN, 10), rotationDeg: num(rot, 4)};
  report.push(`${c.id.padEnd(14)} x=${out[c.id].x} y=${out[c.id].y} upm=${out[c.id].unitsPerMetre} aniso=${((uN / u - 1) * 100).toFixed(2)}% rot=${out[c.id].rotationDeg}deg skew=${skew.toFixed(5)} corner-dev=${dev.toFixed(5)}u (${(dev / u).toFixed(1)} m) land=${onLand}`);
}
mkdirSync(join(ROOT, 'public/kit/map/cities'), {recursive: true});
writeFileSync(join(ROOT, 'public/kit/map/cities/alignment.json'), JSON.stringify(out, null, 1) + '\n');
console.log('wrote public/kit/map/cities/alignment.json'); for (const l of report) console.log(l);
