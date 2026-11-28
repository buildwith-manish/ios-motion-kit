#!/usr/bin/env node
// Rewrites data-manifest.json from the large generated files present locally (SHA-256 + size).
//   node scripts/kit_data_manifest.mjs --release data-v3
// Entries whose file is not present locally are kept as they are, so a partial bake cannot drop data.
import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'data-manifest.json');
const old = JSON.parse(readFileSync(path, 'utf8'));
const i = process.argv.indexOf('--release');
const release = i >= 0 ? process.argv[i + 1] : old.release;
const list = (dir, re) => (existsSync(join(root, dir)) ? readdirSync(join(root, dir)).filter((f) => re.test(f)).sort().map((f) => `${dir}/${f}`) : []);
const found = [
  ...['states', 'counties', 'cbsa', 'outline', 'zcta'].map((n) => `public/kit/map/regions/${n}.json`),
  ...list('public/kit/map/regions/tracts', /^\d{2}\.json$/),
  ...list('public/kit/map/regions/zcta-metro', /^\d{5}\.json$/),
  // baked city planes: <id>.json and <id>.light.json (reports, credits and alignment are small and stay in git)
  ...list('public/kit/map/cities', /\.json$/).filter((f) => !/(\.report|credits|alignment)\.json$/.test(f)),
  'public/kit/music/pad-loop.wav',
].filter((f) => existsSync(join(root, f)));

/** Asset name (flat, unique) and the tags `kit_fetch_data.mjs --only` matches. */
const describe = (dest) => {
  let m;
  if (dest.endsWith('pad-loop.wav')) return {name: 'pad-loop.wav', tags: ['audio']};
  if ((m = /regions\/(\w+)\.json$/.exec(dest))) return {name: `${m[1]}.json`, tags: ['map', 'regions', m[1]]};
  if ((m = /regions\/(tracts|zcta-metro)\/(\d+)\.json$/.exec(dest))) return {name: `${m[1]}-${m[2]}.json`, tags: ['map', m[1], `${m[1]}/${m[2]}`]};
  m = /cities\/(.+?)(\.light)?\.json$/.exec(dest);
  return {name: `city-${m[1]}${m[2] ?? ''}.json`, tags: ['map', 'cities', `city/${m[1]}`]};
};
const byDest = new Map(old.files.map((f) => [f.dest, f]));
for (const dest of found) {
  const buf = readFileSync(join(root, dest));
  byDest.set(dest, {dest, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex')});
}
const files = [...byDest.values()].map(({dest, bytes, sha256}) => ({...describe(dest), dest, bytes, sha256})).sort((a, b) => a.dest.localeCompare(b.dest));
const repo = 'https://github.com/buildwith-manish/ios-motion-kit';
writeFileSync(path, `{
  "release": "${release}",
  "baseUrl": "${repo}/releases/download/${release}",
  "note": "Large generated files kept out of git. Fetch with: npm run kit:fetch-data -- --only <tags>",
  "files": [
${files.map((f) => `    ${JSON.stringify(f)}`).join(',\n')}
  ]
}
`);
console.log(`data-manifest.json: ${files.length} files, ${(files.reduce((a, f) => a + f.bytes, 0) / 1048576).toFixed(1)} MB, release ${release}`);
