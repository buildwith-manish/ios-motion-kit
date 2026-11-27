#!/usr/bin/env node
/**
 * Renders the kit-map demo stills + measures seconds per frame (software GL, the default headless Chrome on Linux).
 * Dev/CI only (needs a browser: run in GitHub Actions, workflow "Map stills").
 *
 *   node scripts/map_stills.mjs [--out=docs/previews/kit-map] [--cities=washington,new-york,...] [--repeat=3]
 *
 * Writes: <out>/<style>-<landscape|portrait>-<us|state|metro>.png (1080p / 1920x1080 and 1080x1920),
 *         <out>/crop4k-<style>-<state|metro>.png (4K render via scale=2, 1280x720 centre crop),
 *         <out>/city-<id>-<light|rich>.png and <out>/perf.json (median seconds/frame per scene, per canvas).
 */
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=').slice(1).join('=');
const OUT = join(ROOT, arg('out', 'docs/previews/kit-map'));
const REPEAT = Number(arg('repeat', 3));
const cityIds = arg('cities', JSON.parse(readFileSync(join(ROOT, 'public/kit/map/cities.json'), 'utf8')).map((c) => c.id).join(',')).split(',').filter(Boolean);
mkdirSync(OUT, {recursive: true});

const serveUrl = await bundle({entryPoint: join(ROOT, 'src/kit/demo/entry.tsx'), publicDir: join(ROOT, 'public')});
const browser = await openBrowser('chrome');
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const perf = {note: 'seconds per still on a reused browser (no launch cost), software GL, GitHub-hosted runner; median of repeats', scenes: {}};

const still = async (id, frame, output, {scale = 1, inputProps = {}} = {}) => {
  const comp = await selectComposition({serveUrl, id, inputProps, puppeteerInstance: browser});
  const t0 = performance.now();
  await renderStill({composition: comp, serveUrl, output, frame, scale, inputProps, puppeteerInstance: browser, imageFormat: 'png', overwrite: true});
  return (performance.now() - t0) / 1000;
};
const crop = (src, dst, w, h) => execFileSync('convert', [src, '-gravity', 'center', '-crop', `${w}x${h}+0+0`, '+repage', dst]);

const SCENES = [['us', 1.5], ['state', 4.5], ['metro', 7.5]];
for (const style of ['night', 'light', 'mono']) for (const shape of ['landscape', 'portrait']) {
  const id = `Kit-Map-${style[0].toUpperCase()}${style.slice(1)}-${shape[0].toUpperCase()}${shape.slice(1)}`;
  for (const [scene, sec] of SCENES) {
    const frame = Math.round(sec * 60);
    const out = join(OUT, `${style}-${shape}-${scene}.png`);
    const times = [];
    for (let i = 0; i < REPEAT; i++) times.push(await still(id, frame, out));
    perf.scenes[`${style}-${shape}-${scene}`] = +median(times).toFixed(2);
    console.log(id, scene, `${median(times).toFixed(2)} s/frame`);
    if (shape === 'landscape' && scene !== 'us') { // 4K crop: render at scale 2, keep a 1280x720 centre crop (hairlines + edges at native 4K pixels)
      const big = join(OUT, `_4k-${style}-${scene}.png`);
      await still(id, frame, big, {scale: 2});
      crop(big, join(OUT, `crop4k-${style}-${scene}.png`), 1280, 720);
      execFileSync('rm', ['-f', big]);
    }
  }
}
for (const cid of cityIds) for (const detail of ['light', 'rich']) {
  const s = await still('Kit-Map-City', 0, join(OUT, `city-${cid}-${detail}.png`), {inputProps: {cityId: cid, detail, theme: 'midnight'}});
  perf.scenes[`city-${cid}-${detail}`] = +s.toFixed(2);
  console.log('city', cid, detail, `${s.toFixed(2)} s/frame`);
}
const v = Object.values(perf.scenes);
perf.max = Math.max(...v); perf.median = median(v);
writeFileSync(join(OUT, 'perf.json'), JSON.stringify(perf, null, 1) + '\n');
console.log(`max ${perf.max} s/frame, median ${perf.median} s/frame (budget 1.5 s)`);
await browser.close({silent: false});
