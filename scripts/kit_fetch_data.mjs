#!/usr/bin/env node
// Downloads the large generated files that are kept out of git (see data-manifest.json) and verifies their SHA-256.
//   node scripts/kit_fetch_data.mjs                 fetch everything missing
//   node scripts/kit_fetch_data.mjs --only states,city/chicago    only files carrying any of these tags
//        tags: map, audio, regions, states, counties, cbsa, outline, zcta, tracts, tracts/<FIPS>,
//              zcta-metro, zcta-metro/<CBSA>, cities, city/<id>     (--list shows every file)
//   node scripts/kit_fetch_data.mjs --check         verify local files only, never download (exit 1 if missing/different)
//   node scripts/kit_fetch_data.mjs --dest-root .   write under another project's root (kit used as a submodule)
// Env: KIT_DATA_BASE_URL overrides the manifest's baseUrl (e.g. a mirror).
//      KIT_TOKEN (or GH_TOKEN / GITHUB_TOKEN): needed when the kit repo is private; release assets are then fetched through the GitHub API.
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, '..', 'data-manifest.json'), 'utf8'));
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const only = opt('--only')?.split(',').map((s) => s.trim());
const check = args.includes('--check');
const root = resolve(opt('--dest-root') ?? join(here, '..'));
const base = (process.env.KIT_DATA_BASE_URL ?? manifest.baseUrl).replace(/\/$/, '');
const token = process.env.KIT_TOKEN ?? process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
const rel = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)$/.exec(base);
let assets;
const download = async (name) => {
  if (token && rel) {
    const api = `https://api.github.com/repos/${rel[1]}/${rel[2]}`;
    const auth = {Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28'};
    if (!assets) {
      const r = await fetch(`${api}/releases/tags/${rel[3]}`, {headers: {...auth, Accept: 'application/vnd.github+json'}});
      if (!r.ok) throw new Error(`HTTP ${r.status} reading release ${rel[3]} (is KIT_TOKEN valid and allowed to read the kit repo?)`);
      assets = new Map((await r.json()).assets.map((a) => [a.name, a.id]));
    }
    if (!assets.has(name)) throw new Error(`asset ${name} is not in release ${rel[3]}`);
    const res = await fetch(`${api}/releases/assets/${assets.get(name)}`, {headers: {...auth, Accept: 'application/octet-stream'}, redirect: 'follow'});
    if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${name}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const res = await fetch(`${base}/${name}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 404 && !token ? ' (private kit repo? set KIT_TOKEN)' : ''}`);
  return Buffer.from(await res.arrayBuffer());
};
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

const unknown = (only ?? []).filter((t) => !manifest.files.some((f) => f.tags.includes(t)));
if (unknown.length || (args.includes('--only') && !only)) { console.error(`FAIL: unknown or missing --only tag: ${unknown.join(', ')} (see --list)`); process.exit(1); }
const wanted = manifest.files.filter((f) => !only || f.tags.some((t) => only.includes(t)));
if (args.includes('--list')) {
  for (const f of wanted) console.log(`${(f.bytes / 1048576).toFixed(2).padStart(6)} MB  ${f.dest}  [${f.tags.join(' ')}]`);
  process.exit(0);
}

let failed = 0;
for (const f of wanted) {
  const dest = join(root, f.dest);
  if (existsSync(dest) && sha(readFileSync(dest)) === f.sha256) { console.log(`ok       ${f.dest}`); continue; }
  if (check) { console.error(`MISSING/DIFFERENT ${f.dest}`); failed++; continue; }
  let done = false;
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    try {
      const buf = await download(f.name);
      if (sha(buf) !== f.sha256) throw new Error('checksum mismatch');
      mkdirSync(dirname(dest), {recursive: true});
      writeFileSync(dest + '.part', buf); renameSync(dest + '.part', dest);
      console.log(`fetched  ${f.dest} (${(buf.length / 1048576).toFixed(1)} MB)`); done = true;
    } catch (e) {
      console.error(`attempt ${attempt} failed for ${f.name}: ${e.message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  if (!done) failed++;
}
if (failed) { console.error(`FAIL: ${failed} file(s)`); process.exit(1); }
console.log('PASS');
