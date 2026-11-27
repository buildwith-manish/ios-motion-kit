#!/usr/bin/env node
/**
 * Bakes US Census cartographic boundary files (500k generalised) to simplified, quantised TopoJSON for
 * src/kit/map/. Dev/CI only — nothing here is imported at runtime. The render never touches the network;
 * this script is the only place that does.
 *
 *   node scripts/map_bake_regions.mjs                         # states, counties, cbsa, zcta, outline
 *   node scripts/map_bake_regions.mjs --layers=states,outline # just these
 *   node scripts/map_bake_regions.mjs --tracts=06,36          # tracts for CA + NY only (on demand, per state)
 *   node scripts/map_bake_regions.mjs --vintage=2023 --force  # pin a vintage, ignore the download cache
 *
 * DATA RULE: US Census Bureau cartographic boundary files only (public domain, US Government Work). No OSM,
 * no Overpass, no Mapbox/Google, no tile server or API key, no network access at render time — everything
 * here is baked once and committed (or produced by the "Bake map regions" GitHub Action).
 *
 * Output: public/kit/map/regions/{states,counties,cbsa,zcta,outline}.json (TopoJSON), tracts/<STATEFP>.json
 * (on demand), manifest.json (vintage + per-layer stats) and credits.json (courtesy line for <MapSourceLine>).
 *
 * Census servers can be flaky or unreachable from a sandbox: downloads are cached under .cache/census/<vintage>/
 * and retried with exponential backoff. Run for real in GitHub Actions (workflow_dispatch), not in a
 * network-restricted sandbox — see .github/workflows/map-bake-regions.yml.
 */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'kit', 'map', 'regions');
const CACHE_DIR = join(ROOT, '.cache', 'census');

// ---- CLI args ---------------------------------------------------------------------------------------------
const usage = `usage: node scripts/map_bake_regions.mjs [--layers=states,counties,cbsa,zcta,outline] [--tracts=FIPS,FIPS] [--vintage=2023] [--force]`;
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) throw new Error(`${usage}\nunrecognised arg: ${a}`);
    return [m[1], m[2] ?? true];
  }),
);
/** Newest vintage that answers: probes GENZ<year> states file (2026 down to 2022) unless --vintage pins one. Recorded in manifest.json. */
async function pickVintage() {
  if (args.vintage) return String(args.vintage);
  for (const y of ['2026', '2025', '2024', '2023', '2022']) {
    try {
      const r = await fetch(`https://www2.census.gov/geo/tiger/GENZ${y}/shp/cb_${y}_us_state_500k.zip`, {method: 'HEAD'});
      if (r.ok) { console.log(`vintage ${y}`); return y; }
    } catch { /* try older */ }
  }
  return '2023';
}
const VINTAGE = await pickVintage();
const FORCE = Boolean(args.force);
const LAYER_NAMES = args.layers ? String(args.layers).split(',') : ['states', 'counties', 'cbsa', 'zcta', 'outline'];
const TRACT_FIPS = args.tracts ? String(args.tracts).split(',') : [];

// ---- download with cache + retry/backoff -------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Downloads `url` to `cachePath` unless already cached (and not --force). Retries with exponential backoff. */
async function download(url, cachePath, {retries = 4, baseDelayMs = 1000} = {}) {
  if (existsSync(cachePath) && !FORCE && statSync(cachePath).size > 0) {
    console.log(`cache hit  ${cachePath}`);
    return cachePath;
  }
  mkdirSync(dirname(cachePath), {recursive: true});
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`downloading ${url} (attempt ${attempt + 1}/${retries + 1})`);
      const res = await fetch(url);
      if (res.status === 404) { const e = new Error('HTTP 404'); e.notFound = true; throw e; }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 100) throw new Error(`suspiciously small response (${buf.length} bytes)`);
      writeFileSync(cachePath, buf);
      return cachePath;
    } catch (err) {
      lastErr = err;
      console.warn(`  failed: ${err.message}`);
      if (err.notFound) break; // a missing file will not appear on retry
      if (attempt < retries) await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw Object.assign(new Error(`giving up on ${url}: ${lastErr?.message}`), {notFound: lastErr?.notFound});
}

/** Runs the mapshaper CLI (via its local bin) with an argv array — never a shell string, so no quoting issues. */
function mapshaper(argv) {
  const bin = join(ROOT, 'node_modules', '.bin', 'mapshaper');
  execFileSync(bin, argv, {stdio: 'inherit'});
}

const censusUrl = (path, y = VINTAGE) => `https://www2.census.gov/geo/tiger/GENZ${y}/shp/${path}`;
const YEAR_LIST = ['2026', '2025', '2024', '2023', '2022'].filter((y) => y <= VINTAGE);
/** Downloads a cartographic file for the newest vintage that publishes it (<= the picked vintage; e.g. ZCTAs lag one year). */
async function getZip(fileFor) {
  for (const y of YEAR_LIST) {
    const file = fileFor(y);
    try { const zipPath = await download(censusUrl(file, y), join(CACHE_DIR, y, file)); return {zipPath, year: y, url: censusUrl(file, y)}; }
    catch (e) { if (!e.notFound) throw e; console.log(`  ${file}: not published for ${y}, trying older`); }
  }
  throw new Error(`no vintage <= ${VINTAGE} publishes ${fileFor(VINTAGE)}`);
}

// ---- layer definitions --------------------------------------------------------------------------------------
// Census state FIPS to exclude from the contiguous-US outline: AK, HI, territories (AS, GU, MP, PR, VI).
const NON_CONTIGUOUS = ['02', '15', '60', '66', '69', '72', '78'];

const LAYERS = {
  states: {
    file: (y) => `cb_${y}_us_state_500k.zip`,
    fields: 'STATEFP,NAME,STUSPS',
    idField: 'STATEFP',
    simplifyPct: '10%',
    quantization: 1e5,
  },
  counties: {
    file: (y) => `cb_${y}_us_county_500k.zip`,
    fields: 'STATEFP,COUNTYFP,GEOID,NAME',
    idField: 'GEOID',
    simplifyPct: '6%',
    quantization: 1e5,
  },
  cbsa: {
    file: (y) => `cb_${y}_us_cbsa_500k.zip`,
    fields: 'CBSAFP,GEOID,NAME,LSAD',
    idField: 'CBSAFP',
    simplifyPct: '8%',
    quantization: 1e5,
  },
  zcta: {
    // National ZCTA file is large even generalised; simplified harder and documented as an approximation (see README).
    file: (y) => `cb_${y}_us_zcta520_500k.zip`,
    fields: 'ZCTA5CE20,GEOID20',
    idField: 'GEOID20',
    simplifyPct: '4%',
    quantization: 1e5,
  },
};

function statsFor(outFile) {
  const bytes = statSync(outFile).size;
  const topo = JSON.parse(readFileSync(outFile, 'utf8'));
  const objectName = Object.keys(topo.objects)[0];
  const features = topo.objects[objectName]?.geometries?.length ?? 0;
  return {bytes, features};
}

async function bakeNamedLayer(name) {
  const def = LAYERS[name];
  if (!def) throw new Error(`unknown layer: ${name}`);
  const {zipPath, year, url} = await getZip(def.file);
  const outFile = join(OUT_DIR, `${name}.json`);
  mkdirSync(OUT_DIR, {recursive: true});
  mapshaper([
    '-i', zipPath, `name=${name}`,
    '-proj', 'wgs84', // cartographic boundary files already ship EPSG:4269/4326-ish lon/lat; this is a no-op safety net
    '-filter-fields', def.fields,
    '-simplify', 'dp', def.simplifyPct, 'keep-shapes',
    '-clean',
    '-o', 'format=topojson', `quantization=${def.quantization}`, `id-field=${def.idField}`, `target=${name}`,
    outFile,
  ]);
  const stats = statsFor(outFile);
  console.log(`baked ${name}: ${(stats.bytes / 1024).toFixed(1)} KB, ${stats.features} features`);
  return {name, file: `${name}.json`, vintage: year, simplifyPct: def.simplifyPct, quantization: def.quantization, ...stats, source: url};
}

/** Contiguous-US land outline (states dissolved into one shape, AK/HI/territories excluded) plus AK and HI as
 * separate small topologies for an optional inset composite — kept in lon/lat, same source geometry as `states`,
 * never pre-projected: the kit projects to the theme's canvas at render time (see src/kit/map/projection.ts). */
async function bakeOutline() {
  const {zipPath, year, url} = await getZip(LAYERS.states.file);
  const outFile = join(OUT_DIR, 'outline.json');
  mkdirSync(OUT_DIR, {recursive: true});
  const excludeFilter = NON_CONTIGUOUS.map((fp) => `STATEFP != '${fp}'`).join(' && ');
  // `+` clones a layer instead of filtering the target in place, so `states_src` stays around for the next
  // -filter; `-each kind=...` tags each piece so the kit can tell outline/alaska/hawaii apart after the merge.
  mapshaper([
    '-i', zipPath, 'name=states_src',
    '-filter-fields', 'STATEFP',
    '-simplify', 'dp', '10%', 'keep-shapes',
    '-clean',
    '-filter', excludeFilter, 'target=states_src', 'name=mainland', '+',
    '-dissolve', 'target=mainland', 'name=outline',
    '-each', "kind='outline'", 'target=outline',
    '-filter', `STATEFP == '02'`, 'target=states_src', 'name=alaska', '+',
    '-each', "kind='alaska'", 'target=alaska',
    '-filter', `STATEFP == '15'`, 'target=states_src', 'name=hawaii', '+',
    '-each', "kind='hawaii'", 'target=hawaii',
    '-merge-layers', 'target=outline,alaska,hawaii', 'force', 'name=combined',
    '-o', 'format=topojson', 'quantization=1e5', 'id-field=kind', 'target=combined',
    outFile,
  ]);
  const stats = statsFor(outFile);
  console.log(`baked outline (+AK/HI inset composite): ${(stats.bytes / 1024).toFixed(1)} KB`);
  return {name: 'outline', file: 'outline.json', vintage: year, ...stats, source: url, note: 'objects.combined holds 3 pieces keyed by id: outline (contiguous US, dissolved), alaska, hawaii — the last two are the optional inset'};
}

/** One state's census tracts, baked on demand (not part of the default run — this is a per-state file). */
async function bakeTracts(stateFips) {
  const {zipPath, year, url} = await getZip((y) => `cb_${y}_${stateFips}_tract_500k.zip`);
  const outDir = join(OUT_DIR, 'tracts');
  mkdirSync(outDir, {recursive: true});
  const outFile = join(outDir, `${stateFips}.json`);
  const layerName = `tracts_${stateFips}`;
  mapshaper([
    '-i', zipPath, `name=${layerName}`,
    '-proj', 'wgs84',
    '-filter-fields', 'STATEFP,COUNTYFP,TRACTCE,GEOID',
    '-simplify', 'dp', '8%', 'keep-shapes',
    '-clean',
    '-o', 'format=topojson', 'quantization=1e5', 'id-field=GEOID', `target=${layerName}`,
    outFile,
  ]);
  const stats = statsFor(outFile);
  console.log(`baked tracts/${stateFips}: ${(stats.bytes / 1024).toFixed(1)} KB, ${stats.features} features`);
  return {name: `tracts/${stateFips}`, file: `tracts/${stateFips}.json`, vintage: year, ...stats, source: url};
}

// ---- main ----------------------------------------------------------------------------------------------------
async function main() {
  mkdirSync(OUT_DIR, {recursive: true});
  const baked = [];
  for (const name of LAYER_NAMES) {
    if (name === 'outline') baked.push(await bakeOutline());
    else baked.push(await bakeNamedLayer(name));
  }
  for (const fips of TRACT_FIPS) baked.push(await bakeTracts(fips));

  // manifest.json: what's baked, which vintage, so RegionLayer / docs can report it without opening every file.
  const manifestPath = join(OUT_DIR, 'manifest.json');
  const existing = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {layers: {}};
  const layers = {...existing.layers};
  for (const b of baked) layers[b.name] = b;
  const manifest = {
    vintage: VINTAGE,
    vintageNote: 'newest vintage probed; each layer records the vintage actually used (a layer can lag, e.g. ZCTAs)',
    generatedAt: new Date().toISOString(),
    source: 'US Census Bureau cartographic boundary files (500k generalised)',
    layers,
    tractsNote: 'Tracts are baked per state on demand: node scripts/map_bake_regions.mjs --tracts=<STATEFP,...>. Not all states are necessarily present.',
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  // credits.json: no on-screen credit is required, but <MapSourceLine> can read this.
  const creditsPath = join(OUT_DIR, 'credits.json');
  writeFileSync(
    creditsPath,
    JSON.stringify(
      {
        courtesy: 'Source: U.S. Census Bureau',
        license: 'Public domain (U.S. Government Work)',
        vintage: VINTAGE,
        layers: Object.values(layers).map((l) => ({name: l.name, source: l.source})),
        note: 'ZCTAs (ZIP Code Tabulation Areas) approximate ZIP codes; they are not exact ZIP boundaries (the Postal Service does not publish ZIP boundary data). See src/kit/map/README.md.',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`\nwrote ${manifestPath}\nwrote ${creditsPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
