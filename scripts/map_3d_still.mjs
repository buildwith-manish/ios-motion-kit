#!/usr/bin/env node
/**
 * Renders stills of the 3D region insert (Kit-Region3D-*) for ONE state and shape; run several in parallel (one CI job each).
 *   node scripts/map_3d_still.mjs --id=08 --name=Colorado --shape=landscape|portrait [--times=0.6,1.2,2.8] [--scale=2] [--out=docs/previews/kit-map/three-premium]
 * Writes <out>/<name>-<shape>-<scale>x-t<time>.png and prints seconds per still (page load included). Software GL (swangle).
 */
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=').slice(1).join('=');
const ID = arg('id', '08'), NAME = arg('name', 'Colorado'), SHAPE = arg('shape', 'landscape');
const TIMES = arg('times', '0.6,1.2,2.8').split(',').map(Number);
const SCALE = Number(arg('scale', 2));
const OUT = join(ROOT, arg('out', 'docs/previews/kit-map/three-premium'));
mkdirSync(OUT, {recursive: true});
const comp = SHAPE === 'portrait' ? 'Kit-Region3D-Portrait' : 'Kit-Region3D-Landscape';
const chromiumOptions = {gl: 'swangle'};
const serveUrl = await bundle({entryPoint: join(ROOT, 'src/kit/demo/entry3d.tsx'), publicDir: join(ROOT, 'public')});
const browser = await openBrowser('chrome', {browserExecutable: null, chromiumOptions});
const inputProps = {theme: 'midnight', id: ID, name: NAME};
const c = await selectComposition({serveUrl, id: comp, inputProps, puppeteerInstance: browser, chromiumOptions});
for (const t of TIMES) {
  const output = join(OUT, `${NAME}-${SHAPE}-${SCALE}x-t${String(t).replace('.', 'p')}.png`);
  const t0 = performance.now();
  await renderStill({composition: c, serveUrl, output, frame: Math.round(t * c.fps), scale: SCALE, inputProps, puppeteerInstance: browser, chromiumOptions, imageFormat: 'png', overwrite: true});
  console.log(NAME, SHAPE, `${SCALE}x`, `t=${t}`, ((performance.now() - t0) / 1000).toFixed(2), 's');
}
await browser.close({silent: true});
