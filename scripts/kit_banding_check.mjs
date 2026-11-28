// Banding check: render one frame of Kit-Banding-Gradient (dark gradient + vignette), encode it with each render preset
// through ffmpeg, and measure the longest run of identical luma along the gradient (x) and the distinct luma levels,
// with dither off and on. Report only unless --enforce is given.
//   node scripts/kit_banding_check.mjs [--out out/banding] [--enforce] [--max-run-pct <n>] [--min-levels <n>]
import {renderStill, selectComposition} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ensureDir, fail, getBundle, openRemotionBrowser, parseArgs, remotionBrowserOptions} from './kit_qa_common.mjs';

// Thresholds apply to dither-ON rows only (longest identical-luma run as % of width; distinct levels on the row).
// Set from measured values: see docs/export-quality.md.
const THRESHOLDS = {maxRunPct: null, minLevels: null};

const usage = 'usage: node scripts/kit_banding_check.mjs [--out <dir>] [--enforce] [--max-run-pct <n>] [--min-levels <n>] [--frame <n>]';
const args = parseArgs({out: 'string', enforce: 'flag', 'max-run-pct': 'number', 'min-levels': 'number', frame: 'number'}, usage);
const maxRunPct = args['max-run-pct'] ?? THRESHOLDS.maxRunPct;
const minLevels = args['min-levels'] ?? THRESHOLDS.minLevels;
const presets = JSON.parse(readFileSync(new URL('../render-presets.json', import.meta.url), 'utf8')).presets;
const outDir = ensureDir(path.resolve(args.out ?? 'out/banding'));

const run = (cmd, argv, opts = {}) => {
  const r = spawnSync(cmd, argv, {maxBuffer: 1 << 28, ...opts});
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.error?.message ?? String(r.stderr).slice(-400)}`);
  return r.stdout;
};

/** Luma stats of one row: longest identical run (px) and distinct levels. Exported shape is pure so it is easy to test. */
export const rowStats = (row) => {
  let longest = 1, cur = 1;
  for (let i = 1; i < row.length; i++) { cur = row[i] === row[i - 1] ? cur + 1 : 1; if (cur > longest) longest = cur; }
  return {longest, levels: new Set(row).size};
};

const serveUrl = await getBundle({entry: 'src/kit/demo/bandingEntry.tsx'});
const puppeteerInstance = await openRemotionBrowser();
const tmp = mkdtempSync(path.join(tmpdir(), 'kit-banding-'));
const rows = [];
try {
  for (const [name, p] of Object.entries(presets)) {
    for (const [dither, ditherValue] of [['off', 'off'], ['banding-safe', 'banding-safe'], ['amount-2.5', {amount: 2.5}]]) {
      const inputProps = {dither: ditherValue};
      const comp = await selectComposition({serveUrl, id: 'Kit-Banding-Gradient', inputProps, puppeteerInstance, ...(await remotionBrowserOptions())});
      const png = path.join(tmp, `${name}-${dither}.png`);
      await renderStill({composition: comp, serveUrl, inputProps, frame: args.frame ?? 0, output: png, scale: p.scale, imageFormat: 'png', puppeteerInstance, ...(await remotionBrowserOptions())});
      const mp4 = path.join(tmp, `${name}-${dither}.mp4`);
      run('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-crf', String(p.crf), '-preset', p.x264Preset,
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-frames:v', '1', mp4]);
      const w = Math.round(comp.width * p.scale), h = Math.round(comp.height * p.scale);
      const y = run('ffmpeg', ['-v', 'error', '-i', mp4, '-vf', 'extractplanes=y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-frames:v', '1', '-']);
      if (y.length !== w * h) throw new Error(`${name}: expected ${w * h} luma bytes, got ${y.length}`);
      // Rows at 40 / 50 / 60 % of the height; the worst run and the fewest levels are reported.
      const src = run('ffmpeg', ['-v', 'error', '-i', png, '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p,extractplanes=y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-frames:v', '1', '-']); // before x264: separates "noise not applied" from "noise removed by the encoder"
      const srcStats = rowStats(src.subarray(Math.floor(h * 0.5) * w, Math.floor(h * 0.5) * w + w));
      const stats = [0.4, 0.5, 0.6].map((f) => rowStats(y.subarray(Math.floor(h * f) * w, Math.floor(h * f) * w + w)));
      const longest = Math.max(...stats.map((s) => s.longest));
      rows.push({preset: name, dither, width: w, height: h, crf: p.crf, x264Preset: p.x264Preset, lumaLevels: Math.min(...stats.map((s) => s.levels)), longestRunPx: longest, longestRunPct: Number(((100 * longest) / w).toFixed(2)), sourceLevels: srcStats.levels, sourceRunPct: Number(((100 * srcStats.longest) / w).toFixed(2))});
    }
  }
} catch (e) {
  // GitHub annotation: readable through the API when job logs are not downloadable.
  console.log(`::error title=banding-script::${String(e?.stack ?? e).slice(0, 900).replace(/\n/g, ' | ')}`);
  process.exitCode = 1;
} finally {
  await puppeteerInstance.close({silent: true});
  rmSync(tmp, {recursive: true, force: true});
}

if (process.exitCode) process.exit(process.exitCode);
const header = ['preset', 'dither', 'size', 'luma levels', 'longest run px', 'run % width', 'src levels', 'src run %'];
const cells = rows.map((r) => [r.preset, r.dither, `${r.width}x${r.height}`, String(r.lumaLevels), String(r.longestRunPx), r.longestRunPct.toFixed(2), String(r.sourceLevels), r.sourceRunPct.toFixed(2)]);
const widths = header.map((h, i) => Math.max(h.length, ...cells.map((c) => c[i].length)));
const line = (c) => c.map((v, i) => v.padEnd(widths[i])).join('  ');
console.log(`\nBanding (dark gradient + vignette, one frame, luma along x)\n${line(header)}\n${cells.map(line).join('\n')}`);
const reportPath = path.join(outDir, 'banding-report.json');
writeFileSync(reportPath, JSON.stringify({note: 'Luma = decoded Y plane (tv range) after x264 at the preset crf/preset. Rows at 40/50/60% height: longest run is the worst, levels the fewest.', thresholds: {maxRunPct, minLevels}, rows}, null, 2));
console.log(`\nJSON: ${path.relative(process.cwd(), reportPath)}`);

if (args.enforce) {
  const bad = rows.filter((r) => r.dither === 'banding-safe' && ((maxRunPct != null && r.longestRunPct > maxRunPct) || (minLevels != null && r.lumaLevels < minLevels)));
  if (bad.length) fail(`banding above threshold with dither on: ${bad.map((r) => `${r.preset} run ${r.longestRunPct}% levels ${r.lumaLevels}`).join('; ')}`);
}
