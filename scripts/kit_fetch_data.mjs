#!/usr/bin/env node
// Downloads the large generated files that are kept out of git (see data-manifest.json) and verifies their SHA-256.
//   node scripts/kit_fetch_data.mjs                 fetch everything missing
//   node scripts/kit_fetch_data.mjs --only map      only files tagged "map" (or "audio"); comma list allowed
//   node scripts/kit_fetch_data.mjs --check         verify local files only, never download (exit 1 if missing/different)
//   node scripts/kit_fetch_data.mjs --dest-root .   write under another project's root (kit used as a submodule)
// Env: KIT_DATA_BASE_URL overrides the manifest's baseUrl (e.g. a mirror).
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
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

let failed = 0;
for (const f of manifest.files) {
  if (only && !only.includes(f.needs)) continue;
  const dest = join(root, f.dest);
  if (existsSync(dest) && sha(readFileSync(dest)) === f.sha256) { console.log(`ok       ${f.dest}`); continue; }
  if (check) { console.error(`MISSING/DIFFERENT ${f.dest}`); failed++; continue; }
  let done = false;
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    try {
      const res = await fetch(`${base}/${f.name}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
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
