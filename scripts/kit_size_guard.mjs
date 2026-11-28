#!/usr/bin/env node
// Keeps the repo small. Fails (exit 1) if a tracked file is too big or docs/previews grows too large.
// Why: this repo is used as a submodule in every video repo, so every clone pays for what is committed.
import {execSync} from 'node:child_process';
import {readFileSync, statSync} from 'node:fs';

const MAX_FILE = 1024 * 1024;            // 1 MB per tracked file
const MAX_PREVIEWS = 5 * 1024 * 1024;    // 5 MB total under docs/previews
const MAX_PREVIEW_WIDTH = 960;
const FORBIDDEN_PREVIEW_EXT = /\.(png|mp4|mov|webm|wav)$/i; // previews are small JPGs; big outputs are CI artifacts
// generated data that belongs in a Release (data-manifest.json), never in git
const FETCHED = new Set(JSON.parse(readFileSync('data-manifest.json', 'utf8')).files.map((f) => f.dest));
const BAKED = /^public\/kit\/(map\/regions\/(states|counties|cbsa|outline|zcta|tracts\/\d+|zcta-metro\/\d+)\.json|music\/.*\.wav)$/;

/** Pixel width from a JPEG's start-of-frame marker (null if not found). */
const jpegWidth = (buf) => {
  for (let i = 2; i + 9 < buf.length && buf[i] === 0xff; i += 2 + buf.readUInt16BE(i + 2)) {
    if (buf[i + 1] >= 0xc0 && buf[i + 1] <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(buf[i + 1])) return buf.readUInt16BE(i + 7);
  }
  return null;
};

const files = execSync('git ls-files -z', {encoding: 'utf8', maxBuffer: 1 << 28}).split('\0').filter(Boolean);
const problems = [];
let previews = 0;
for (const f of files) {
  let size;
  try { size = statSync(f).size; } catch { continue; }
  if (f.startsWith('docs/previews/')) {
    previews += size;
    if (FORBIDDEN_PREVIEW_EXT.test(f)) problems.push(`${f}: ${(size / 1024).toFixed(0)} KB, previews must be JPG (use workflow artifacts for PNG/video)`);
    else if (/\.jpe?g$/i.test(f) && jpegWidth(readFileSync(f)) > MAX_PREVIEW_WIDTH) problems.push(`${f}: wider than ${MAX_PREVIEW_WIDTH} px (run npm run kit:shrink-previews)`);
  }
  if (FETCHED.has(f) || BAKED.test(f)) problems.push(`${f}: generated data must not be committed (see data-manifest.json)`);
  if (size > MAX_FILE) problems.push(`${f}: ${(size / 1048576).toFixed(1)} MB is over the 1 MB limit`);
}
if (previews > MAX_PREVIEWS) problems.push(`docs/previews: ${(previews / 1048576).toFixed(1)} MB is over the 5 MB budget`);

console.log(`size guard: ${files.length} tracked files, docs/previews ${(previews / 1048576).toFixed(1)} MB`);
if (problems.length) { console.error('FAIL\n' + problems.map((p) => ' - ' + p).join('\n')); process.exit(1); }
console.log('PASS');
