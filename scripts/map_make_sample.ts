/**
 * Writes the SYNTHETIC choropleth sample for the kit demo: ZIP areas (ZCTAs) of one metro with made-up values.
 * Deterministic. Not real statistics.
 *   npx esbuild scripts/map_make_sample.ts --bundle --platform=node | node
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {geoCentroid, geoDistance} from 'd3-geo';
import {idsWithin, topoFeatures} from '../src/kit/map/regions';

const CBSA = '19740'; // Denver-Aurora-Centennial, the kit's generic sample metro
const topo = (f: string) => JSON.parse(readFileSync(`public/kit/map/regions/${f}.json`, 'utf8'));
const zcta = topo('zcta');
const metro = topoFeatures(topo('cbsa')).get(CBSA);
const ids = idsWithin(zcta, metro);
const centre: [number, number] = [-104.99, 39.74];
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 2 ** 32; };
const index: Record<string, number | null> = {};
for (const id of ids) {
  if (hash(`${id}gap`) < 0.08) continue; // deliberate gaps: shows the "No data" treatment
  const c = geoCentroid(topoFeatures(zcta).get(id)) as [number, number];
  const km = geoDistance(c, centre) * 6371;
  const v = 20 + 70 * Math.exp(-km / 38) + 10 * Math.sin(c[0] * 9) * Math.cos(c[1] * 11) + 8 * (hash(id) - 0.5);
  index[id] = Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
}
const sorted = Object.values(index).map(Number).sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
const change = Object.fromEntries(Object.entries(index).map(([k, v]) => [k, Math.round((Number(v) - median) * 0.4 * 10) / 10]));
writeFileSync('src/kit/demo/data/map-sample-zcta.json', JSON.stringify({note: 'SYNTHETIC sample values for the kit demo, not real statistics', cbsa: CBSA, index, change}) + '\n');
console.log(`${ids.length} ZCTAs in ${CBSA}, ${Object.keys(index).length} with values`);
