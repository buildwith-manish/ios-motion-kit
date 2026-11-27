#!/usr/bin/env node
/**
 * Renders review stills of the fly-through demo (Kit-Fly-*) and measures seconds per frame (software GL, reused
 * browser) over a sweep of the whole timeline, including the country-to-metro dissolve. Dev/CI only (needs a browser:
 * run the "Map fly" workflow).
 *
 *   node scripts/map_fly_stills.mjs [--out=docs/previews/kit-map/fly] [--step=0.5] [--repeat=2]
 *
 * Writes <out>/*.png (stills, a 1280x720 centre crop of a true-4K render) and <out>/perf.json.
 */
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=').slice(1).join('=');
const OUT = join(ROOT, arg('out', 'docs/previews/kit-map/fly'));
const STEP = Number(arg('step', 0.5));
const REPEAT = Number(arg('repeat', 2));
const SECONDS = 13;
const FPS = 60;
mkdirSync(OUT, {recursive: true});

const serveUrl = await bundle({entryPoint: join(ROOT, 'src/kit/demo/entry.tsx'), publicDir: join(ROOT, 'public')});
const browser = await openBrowser('chrome', {browserExecutable: null});
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const still = async (id, t, output, {scale = 1, inputProps = {theme: 'midnight'}} = {}) => {
  const comp = await selectComposition({serveUrl, id, inputProps, puppeteerInstance: browser});
  const t0 = performance.now();
  await renderStill({composition: comp, serveUrl, output, frame: Math.min(Math.round(t * FPS), SECONDS * FPS - 1), scale, inputProps, puppeteerInstance: browser, imageFormat: 'png', overwrite: true});
  return (performance.now() - t0) / 1000;
};
const slug = (t) => String(t).replace('.', 'p');

// review moments: start, mid-flight, landed on the country, arc/callouts, metro dissolve, landed on the metro, callouts
const MOMENTS = [0.4, 1.6, 2.6, 4.0, 5.2, 6.8, 7.6, 8.2, 9.4, 11.0, 12.5];
for (const t of MOMENTS) await still('Kit-Fly-Landscape', t, join(OUT, `landscape-t${slug(t)}.png`));
for (const t of [2.6, 5.2, 8.2, 12.5]) await still('Kit-Fly-Portrait', t, join(OUT, `portrait-t${slug(t)}.png`));
// true 4K (scale 2), centre crop to check hairlines and edges at pixel size
for (const t of [5.2, 12.5]) {
  const full = join(OUT, `_4k-t${slug(t)}.png`);
  await still('Kit-Fly-Landscape', t, full, {scale: 2});
  execFileSync('convert', [full, '-gravity', 'center', '-crop', '1280x720+0+0', '+repage', join(OUT, `crop4k-t${slug(t)}.png`)]);
  execFileSync('rm', [full]);
}

// timing sweep over the whole timeline, 1080p, discarding the first (warm-up) render
const perf = {note: 'seconds per still on a reused browser (no launch cost), software GL, GitHub-hosted runner; 1920x1080 landscape and 1080x1920 portrait, median of repeats per time', landscape: {}, portrait: {}};
await still('Kit-Fly-Landscape', 0, join(OUT, '_warm.png'));
for (const [key, id] of [['landscape', 'Kit-Fly-Landscape'], ['portrait', 'Kit-Fly-Portrait']]) {
  for (let t = 0; t < SECONDS; t += STEP) {
    const runs = [];
    for (let r = 0; r < REPEAT; r++) runs.push(await still(id, t, join(OUT, '_t.png')));
    perf[key][t.toFixed(1)] = +median(runs).toFixed(3);
  }
  const v = Object.values(perf[key]);
  perf[`${key}Summary`] = {median: +median(v).toFixed(3), max: Math.max(...v), maxAt: Object.entries(perf[key]).find(([, s]) => s === Math.max(...v))[0], budget: 1.5};
}
execFileSync('rm', ['-f', join(OUT, '_warm.png'), join(OUT, '_t.png')]);
writeFileSync(join(OUT, 'perf.json'), JSON.stringify(perf, null, 2));
console.log(JSON.stringify({landscape: perf.landscapeSummary, portrait: perf.portraitSummary}, null, 2));
await browser.close({silent: true});
