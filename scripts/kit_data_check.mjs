// Validates data.manifest.json: required fields, file present, sha256 matches (fail); retrieved date older than N days (warn).
//   node scripts/kit_data_check.mjs [--root .] [--manifest data.manifest.json] [--stale-days 365] [--today YYYY-MM-DD] [--write-hashes]
// Exit code: 0 ok (warnings allowed), 1 problems, 2 could not run.
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const root = path.resolve(opt('--root') ?? '.');
const mpath = path.resolve(root, opt('--manifest') ?? 'data.manifest.json');
const FIELDS = ['id', 'file', 'sourceName', 'url', 'retrievedDate', 'dataYear', 'units', 'geography', 'notes', 'license', 'sha256'];
const EMPTY_OK = new Set(['notes']);
if (!existsSync(mpath)) { console.error(`could not run: ${mpath} not found`); process.exit(2); }
let manifest;
try { manifest = JSON.parse(readFileSync(mpath, 'utf8')); } catch (e) { console.error(`could not run: ${e.message}`); process.exit(2); }
const staleDays = Number(opt('--stale-days') ?? manifest.staleDays ?? 365);
const today = new Date(opt('--today') ?? new Date().toISOString().slice(0, 10));
const write = argv.includes('--write-hashes');
const problems = []; const warnings = []; const seen = new Set();
if (!Array.isArray(manifest.datasets)) { console.error('FAIL: "datasets" must be an array'); process.exit(1); }
for (const [i, d] of manifest.datasets.entries()) {
  const id = d.id ?? `#${i}`;
  for (const f of FIELDS) if (d[f] === undefined || d[f] === null || (String(d[f]).trim() === '' && !EMPTY_OK.has(f) && !(write && f === 'sha256'))) problems.push(`${id}: missing field "${f}"`);
  if (d.id) { if (seen.has(d.id)) problems.push(`${id}: duplicate id`); seen.add(d.id); }
  if (d.url && !/^https?:\/\//.test(d.url)) problems.push(`${id}: url must start with http(s)://`);
  const when = new Date(d.retrievedDate);
  if (d.retrievedDate && Number.isNaN(when.getTime())) problems.push(`${id}: retrievedDate "${d.retrievedDate}" is not YYYY-MM-DD`);
  else if (d.retrievedDate) { const age = Math.floor((today - when) / 864e5); if (age > staleDays) warnings.push(`${id}: retrieved ${age} days ago (limit ${staleDays})`); }
  if (d.file) {
    const file = path.resolve(root, d.file);
    if (!existsSync(file)) problems.push(`${id}: file ${d.file} not found`);
    else {
      const sha = createHash('sha256').update(readFileSync(file)).digest('hex');
      if (write) d.sha256 = sha;
      else if (d.sha256 && d.sha256.toLowerCase() !== sha) problems.push(`${id}: sha256 mismatch for ${d.file} (manifest ${String(d.sha256).slice(0, 12)}..., file ${sha.slice(0, 12)}...)`);
    }
  }
}
if (write) { writeFileSync(mpath, `${JSON.stringify(manifest, null, 2)}\n`); console.log(`hashes written to ${path.relative(process.cwd(), mpath)}`); }
for (const w of warnings) console.warn(`warn  ${w}`);
for (const p of problems) console.error(`FAIL  ${p}`);
console.log(problems.length ? `FAIL: ${problems.length} problem(s), ${warnings.length} warning(s)` : `PASS: ${manifest.datasets.length} dataset(s), ${warnings.length} warning(s)`);
process.exit(problems.length ? 1 : 0);
