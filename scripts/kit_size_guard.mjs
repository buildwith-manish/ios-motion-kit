#!/usr/bin/env node
// Keeps the repo small. Fails (exit 1) if a tracked file is too big or docs/previews grows too large.
// Why: this repo is used as a submodule in every video repo, so every clone pays for what is committed.
import {execSync} from 'node:child_process';
import {statSync} from 'node:fs';

const MAX_FILE = 1024 * 1024;            // 1 MB per tracked file
const MAX_PREVIEWS = 15 * 1024 * 1024;   // 15 MB total under docs/previews
const FORBIDDEN_PREVIEW_EXT = /\.(png|mp4|mov|webm|wav)$/i; // previews are small JPGs; big outputs are CI artifacts
const ALLOW = new Set([
  'public/kit/map/regions/zcta.json',
  'public/kit/music/pad-loop.wav',
]);

const files = execSync('git ls-files -z', {encoding: 'utf8', maxBuffer: 1 << 28}).split('\0').filter(Boolean);
const problems = [];
let previews = 0;
for (const f of files) {
  let size;
  try { size = statSync(f).size; } catch { continue; }
  if (f.startsWith('docs/previews/')) {
    previews += size;
    if (FORBIDDEN_PREVIEW_EXT.test(f)) problems.push(`${f}: ${(size / 1024).toFixed(0)} KB, previews must be JPG (use workflow artifacts for PNG/video)`);
  }
  if (size > MAX_FILE && !ALLOW.has(f)) problems.push(`${f}: ${(size / 1048576).toFixed(1)} MB is over the 1 MB limit`);
}
if (previews > MAX_PREVIEWS) problems.push(`docs/previews: ${(previews / 1048576).toFixed(1)} MB is over the 15 MB budget`);

console.log(`size guard: ${files.length} tracked files, docs/previews ${(previews / 1048576).toFixed(1)} MB`);
if (problems.length) { console.error('FAIL\n' + problems.map((p) => ' - ' + p).join('\n')); process.exit(1); }
console.log('PASS');
