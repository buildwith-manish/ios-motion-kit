// One-command scene review: stills + contact sheet + merged QA flags for one composition.
//   npm run kit:review -- --comp <id> [--times 1,3,5] [--portrait] [--entry file] [--loudness] [--out dist/review]
// Writes <out>/<comp>/{still-<t>s.png, contact-sheet.png, review.md, qa/*}. Report only: exits 0 unless it cannot run (2).
// --portrait reviews <comp>-Vertical. --loudness also runs kit_loudness (renders the composition's mix; needs ffmpeg).
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {renderStill, selectComposition} from '@remotion/renderer';
import {DEFAULT_ENTRY, ensureDir, fail, getBundle, openRemotionBrowser, parseArgs} from './kit_qa_common.mjs';
import {mergeReview} from './kit_review_merge.mjs';

// CI can only read annotations here, so surface failures as ::error:: lines too.
const annotate = (level, title, msg) => console.log(`::${level} title=${title}::${String(msg).split('\n').slice(0, 3).join(' | ').slice(0, 500)}`);
const origError = console.error;
console.error = (...a) => { annotate('error', 'kit:review', a.join(' ')); origError(...a); };
process.on('uncaughtException', (e) => { annotate('error', 'kit:review', e?.stack ?? e); process.exit(1); });
process.on('unhandledRejection', (e) => { annotate('error', 'kit:review', e?.stack ?? e); process.exit(1); });
const args = parseArgs({comp: 'string', times: 'string', portrait: 'flag', entry: 'string', out: 'string', loudness: 'flag'}, 'node scripts/kit_review.mjs --comp <id> [--times 1,3,5] [--portrait] [--entry file] [--loudness] [--out dir]');
if (!args.comp || args.comp.includes(',')) fail('--comp <one composition id> is required');
const here = path.dirname(fileURLToPath(import.meta.url));
const entry = args.entry ?? DEFAULT_ENTRY;
const id = args.portrait && !args.comp.endsWith('-Vertical') ? `${args.comp}-Vertical` : args.comp;
const out = ensureDir(path.join(args.out ?? 'dist/review', id));
const serveUrl = await getBundle({entry});

const puppeteerInstance = await openRemotionBrowser();
let comp;
try { comp = await selectComposition({serveUrl, id, puppeteerInstance, logLevel: 'error'}); } catch (e) { await puppeteerInstance.close({silent: true}); fail(`composition ${id} not found in ${entry}: ${e.message.split('\n')[0]}`); }
const seconds = comp.durationInFrames / comp.fps;
const times = (args.times ? args.times.split(',').map(Number) : [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => Math.round(f * seconds * 10) / 10)).filter(Number.isFinite);
if (!times.length) fail('--times needs numbers in seconds');

// 1. Stills (one browser, rendered in sequence).
const stills = [];
for (const t of times) {
  const file = path.join(out, `still-${t}s.png`);
  await renderStill({composition: comp, serveUrl, output: file, frame: Math.min(comp.durationInFrames - 1, Math.round(t * comp.fps)), imageFormat: 'png', puppeteerInstance, logLevel: 'error'});
  stills.push(file);
}
await puppeteerInstance.close({silent: true});

// 2. Contact sheet (labelled tiles). sharp is loaded with CommonJS require: tile.mjs's ESM import fails on CI runners.
const cjs = createRequire(path.join(process.cwd(), 'x.js'));
const loadSharp = () => {
  try { return cjs('sharp'); } catch {
    const r = spawnSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', 'sharp'], {stdio: 'inherit'});
    if (r.status !== 0) fail('could not install sharp (needed for the contact sheet)');
    try { return cjs('sharp'); } catch (e) {
      const dir = path.join(process.cwd(), 'node_modules', 'sharp');
      fail(`sharp unusable after install: ${e.message.split('\n')[0]}; dir: ${existsSync(dir) ? readdirSync(dir).join(',') : 'missing'}`);
    }
  }
};
const portrait = comp.height > comp.width;
const sharp = loadSharp();
const tileW = portrait ? 270 : 480, cols = Math.min(portrait ? 5 : 3, stills.length), gap = 16;
const tileH = Math.round(tileW * (comp.height / comp.width)), labelH = Math.round(tileW * 0.1), cellH = tileH + labelH;
const rows = Math.ceil(stills.length / cols);
const parts = [];
for (let i = 0; i < stills.length; i++) {
  const left = gap + (i % cols) * (tileW + gap), top = gap + Math.floor(i / cols) * (cellH + gap);
  parts.push({input: await sharp(stills[i]).resize({width: tileW, height: tileH, fit: 'fill'}).png().toBuffer(), left, top});
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileW}" height="${labelH}"><text x="${tileW / 2}" y="${Math.round(labelH * 0.74)}" text-anchor="middle" fill="#e8eef7" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(labelH * 0.62)}">${times[i]}s</text></svg>`;
  parts.push({input: Buffer.from(svg), left, top: top + tileH});
}
await sharp({create: {width: gap + cols * (tileW + gap), height: gap + rows * (cellH + gap), channels: 3, background: '#0b1426'}}).composite(parts).png().toFile(path.join(out, 'contact-sheet.png'));

// 3. QA scripts (report only; each writes JSON into qa/<name>/).
const run = (script, extra, name, jsonName) => {
  const dir = path.join(out, 'qa', name);
  const r = spawnSync(process.execPath, [path.join(here, script), '--comp', id, '--entry', entry, '--serve-url', serveUrl, ...(script === 'kit_motion_audit.mjs' ? [] : ['--no-images']), '--no-fail', '--out', dir, ...extra], {stdio: ['ignore', 'ignore', 'inherit']});
  const file = path.join(dir, jsonName);
  if (r.status !== 0 || !existsSync(file)) return {reason: `exit ${r.status ?? 'signal'}`};
  return {report: JSON.parse(readFileSync(file, 'utf8'))};
};
const t = ['--times', times.join(',')];
const jobs = {
  contrast: ['kit_contrast_check.mjs', t, 'contrast', 'contrast.json'],
  safeArea: ['kit_safe_area_check.mjs', t, 'safe-area', 'safe-area.json'],
  layout: ['kit_layout_lint.mjs', t, 'layout', 'layout-lint.json'],
  motion: ['kit_motion_audit.mjs', ['--fps', '5', '--scale', '0.15', '--min-static', '2'], 'motion', 'motion-audit.json'],
};
if (args.loudness) jobs.loudness = ['kit_loudness.mjs', [], 'loudness', 'loudness.json'];
const reports = {};
const skipped = {};
for (const [key, [script, extra, name, jsonName]] of Object.entries(jobs)) {
  const r = run(script, extra, name, jsonName);
  if (r.report) reports[key] = r.report; else { skipped[key] = r.reason; annotate('warning', 'review skipped', `${key}: ${r.reason}`); }
}

// 4. review.md
const rel = (f) => path.relative(out, f);
const {markdown, counts, total} = mergeReview({comp: id, times, reports, skipped, files: {stills: stills.map(rel), sheet: 'contact-sheet.png'}});
writeFileSync(path.join(out, 'review.md'), markdown);
console.log(`review: ${path.relative(process.cwd(), out)}/review.md  ${total} flag(s)  ${JSON.stringify(counts)}`);
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, markdown, {flag: 'a'});
