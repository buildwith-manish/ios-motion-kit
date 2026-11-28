// Glass tier cost in software GL: same still set rendered with card, liquid and no glass. Reports ms/frame (gross and
// net of the glass-free scene) in the log and $GITHUB_STEP_SUMMARY. Always exits 0 (a report, not a gate); warns above target.
//   node scripts/kit_glass_perf.mjs [--entry src/kit/demo/entry.tsx] [--reps 3] [--target 1.3]
import {appendFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {renderStill, selectComposition} from '@remotion/renderer';
import {DEFAULT_ENTRY, ensureDir, getBundle, openRemotionBrowser, parseArgs} from './kit_qa_common.mjs';

const args = parseArgs({entry: 'string', reps: 'string', target: 'string', out: 'string'}, 'node scripts/kit_glass_perf.mjs [--entry file] [--reps n] [--target ratio] [--out dir]');
const reps = Number(args.reps ?? 3);
const target = Number(args.target ?? 1.3);
const out = ensureDir(args.out ?? 'out/glass-perf');
const FRAMES = [0, 15, 30, 45, 60, 75, 90, 105];
const IDS = {none: 'Kit-Liquid-Perf-None', card: 'Kit-Liquid-Perf-Card', liquid: 'Kit-Liquid-Perf-Liquid'};

const serveUrl = await getBundle({entry: args.entry ?? DEFAULT_ENTRY});
const puppeteerInstance = await openRemotionBrowser();
const comps = {};
for (const [k, id] of Object.entries(IDS)) comps[k] = await selectComposition({serveUrl, id, puppeteerInstance, logLevel: 'error'});
const still = async (k, frame) => {
  const t0 = performance.now();
  await renderStill({composition: comps[k], serveUrl, output: path.join(out, `${k}.jpg`), frame, imageFormat: 'jpeg', jpegQuality: 90, puppeteerInstance, logLevel: 'error'});
  return performance.now() - t0;
};
for (const k of Object.keys(IDS)) await still(k, 0); // warm-up
const samples = {none: [], card: [], liquid: []};
for (let r = 0; r < reps; r++) {
  for (const f of FRAMES) {
    // Rotate the order each time so drift and cache state do not favour one tier.
    const order = ['none', 'card', 'liquid'];
    const shift = (r * FRAMES.length + FRAMES.indexOf(f)) % 3;
    for (const k of [...order.slice(shift), ...order.slice(0, shift)]) samples[k].push(await still(k, f));
  }
}
await puppeteerInstance.close({silent: true});
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const ms = Object.fromEntries(Object.entries(samples).map(([k, a]) => [k, median(a)]));
const netCard = Math.max(1, ms.card - ms.none);
const netLiquid = Math.max(1, ms.liquid - ms.none);
const res = {frames: FRAMES.length, reps, ms, gross_ratio: ms.liquid / ms.card, net_ms: {card: netCard, liquid: netLiquid}, net_ratio: netLiquid / netCard, target};
writeFileSync(path.join(out, 'perf.json'), JSON.stringify(res, null, 2));
const f1 = (n) => n.toFixed(1);
const lines = [
  '### Glass perf (software GL, 1080p, 3 hero cards per still)',
  '| scene | ms/frame (median) | net of glass-free scene |',
  '|---|---|---|',
  `| no glass | ${f1(ms.none)} | - |`,
  `| card | ${f1(ms.card)} | ${f1(netCard)} |`,
  `| liquid | ${f1(ms.liquid)} | ${f1(netLiquid)} |`,
  '',
  `liquid/card: gross ${res.gross_ratio.toFixed(2)}x, net ${res.net_ratio.toFixed(2)}x (target <= ${target}x)`,
];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
if (res.net_ratio > target) console.log(`::warning::liquid net cost ${res.net_ratio.toFixed(2)}x card exceeds target ${target}x`);
