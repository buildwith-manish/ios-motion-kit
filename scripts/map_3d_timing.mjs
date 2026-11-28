#!/usr/bin/env node
/**
 * Timing spike for the optional 3D region insert (Kit-Region3D-*): seconds per frame at 1080p and 4K (scale 2), software GL
 * (swangle), reused browser, several states. Dev/CI only (needs a browser: run the "Map 3D" workflow).
 *
 *   node scripts/map_3d_timing.mjs [--out=docs/previews/kit-map/three] [--repeat=3]
 *
 * Writes <out>/*.png (review stills) and <out>/perf.json. Budget: 1.5 s per frame at 1080p.
 */
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=').slice(1).join('=');
const OUT = join(ROOT, arg('out', 'docs/previews/kit-map/three'));
const REPEAT = Number(arg('repeat', 3));
const FPS = 60;
const STATES = {CO: '08', MI: '26', FL: '12', TX: '48'}; // simple outline, many islands/lakes, long coast, large
const TIMES = [0.3, 1.0, 2.0, 2.9];
mkdirSync(OUT, {recursive: true});

const chromiumOptions = {gl: 'swangle'};
const serveUrl = await bundle({entryPoint: join(ROOT, 'src/kit/demo/entry3d.tsx'), publicDir: join(ROOT, 'public')});
const browser = await openBrowser('chrome', {browserExecutable: null, chromiumOptions});
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const still = async (comp, id, t, output, scale = 1) => {
  const inputProps = {theme: 'midnight', id};
  const c = await selectComposition({serveUrl, id: comp, inputProps, puppeteerInstance: browser, chromiumOptions});
  const t0 = performance.now();
  await renderStill({composition: c, serveUrl, output, frame: Math.round(t * FPS), scale, inputProps, puppeteerInstance: browser, chromiumOptions, imageFormat: 'png', overwrite: true});
  return (performance.now() - t0) / 1000;
};

await still('Kit-Region3D-Landscape', '08', 1, join(OUT, '_warm.png')); // warm-up
const perf = {note: 'seconds per still, reused browser, software GL (swangle), GitHub-hosted runner; median of repeats', budget1080: 1.5, results: {}};
for (const [name, id] of Object.entries(STATES)) {
  for (const [shape, comp] of [['landscape', 'Kit-Region3D-Landscape'], ['portrait', 'Kit-Region3D-Portrait']]) {
    for (const [res, scale] of [['1080p', 1], ['4k', 2]]) {
      const per = {};
      for (const t of TIMES) {
        const runs = [];
        for (let r = 0; r < REPEAT; r++) runs.push(await still(comp, id, t, join(OUT, `${name}-${shape}-${res}-t${String(t).replace('.', 'p')}.png`), scale));
        per[t] = +median(runs).toFixed(3);
      }
      const v = Object.values(per);
      perf.results[`${name}-${shape}-${res}`] = {perTime: per, median: +median(v).toFixed(3), max: Math.max(...v)};
      console.log(name, shape, res, 'median', median(v).toFixed(3), 'max', Math.max(...v));
    }
  }
}
rmSync(join(OUT, '_warm.png'), {force: true});
writeFileSync(join(OUT, 'perf.json'), JSON.stringify(perf, null, 2));
await browser.close({silent: true});
