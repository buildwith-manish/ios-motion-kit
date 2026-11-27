#!/usr/bin/env node
/**
 * Renders the kit-map demo stills + measures seconds per frame (software GL, the default headless Chrome on Linux).
 * Dev/CI only (needs a browser: run in GitHub Actions, workflow "Map stills").
 *
 *   node scripts/map_stills.mjs [--out=docs/previews/kit-map] [--cities=washington,new-york,...] [--repeat=3]
 *                              [--only=all|base|highlight] [--browser=<headless chrome path>]
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

const ONLY = arg('only', 'all'); // all | base (M1 scenes + cities) | highlight (M2: highlight + choropleth)
const BROWSER = arg('browser', '') || null; // path to a local headless Chrome (otherwise Remotion's own)
const serveUrl = await bundle({entryPoint: join(ROOT, 'src/kit/demo/entry.tsx'), publicDir: join(ROOT, 'public')});
const browser = await openBrowser('chrome', {browserExecutable: BROWSER});
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const perf = {note: 'seconds per still on a reused browser (no launch cost), software GL, GitHub-hosted runner; median of repeats', scenes: {}};

const still = async (id, frame, output, {scale = 1, inputProps = {}} = {}) => {
  const comp = await selectComposition({serveUrl, id, inputProps, puppeteerInstance: browser, browserExecutable: BROWSER});
  const t0 = performance.now();
  await renderStill({composition: comp, serveUrl, output, frame, scale, inputProps, puppeteerInstance: browser, imageFormat: 'png', overwrite: true});
  return (performance.now() - t0) / 1000;
};
const crop = (src, dst, w, h) => execFileSync('convert', [src, '-gravity', 'center', '-crop', `${w}x${h}+0+0`, '+repage', dst]);

const SCENES = [['us', 1.5], ['state', 4.5], ['metro', 7.5]];
for (const style of ONLY === 'highlight' ? [] : ['night', 'light', 'mono']) for (const shape of ['landscape', 'portrait']) {
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
for (const cid of ONLY === 'highlight' ? [] : cityIds) for (const detail of ['light', 'rich']) {
  const s = await still('Kit-Map-City', 0, join(OUT, `city-${cid}-${detail}.png`), {inputProps: {cityId: cid, detail, theme: 'midnight'}});
  perf.scenes[`city-${cid}-${detail}`] = +s.toFixed(2);
  console.log('city', cid, detail, `${s.toFixed(2)} s/frame`);
}
// M2: three highlight moments + one mid-handover, and the choropleth mid fill-in + settled
const M2 = [];
for (const shape of ['Landscape', 'Portrait']) for (const theme of ['midnight', 'light', 'mono']) {
  const s = shape.toLowerCase();
  for (const [name, sec] of [['co', 2.4], ['handover', 3.55], ['mo', 5.2], ['ga', 8.0]]) M2.push({key: `highlight-${theme}-${s}-${name}`, id: `Kit-Map-Highlight-${shape}`, sec, inputProps: {theme}, crop: theme !== 'mono' && shape === 'Landscape' && name === 'co'});
  for (const scale of ['sequential', 'diverging']) for (const [name, sec] of [['filling', 1.3], ['settled', 5]]) {
    if (name === 'filling' && (theme !== 'midnight' || scale !== 'sequential')) continue;
    M2.push({key: `choropleth-${theme}-${s}-${scale}-${name}`, id: `Kit-Map-Choropleth-${shape}`, sec, inputProps: {theme, scale}, crop: shape === 'Landscape' && name === 'settled' && scale === 'sequential' && theme !== 'mono'});
  }
}
for (const m of ONLY === 'base' ? [] : M2) {
  const frame = Math.round(m.sec * 60);
  const out = join(OUT, `${m.key}.png`);
  const times = [];
  for (let i = 0; i < REPEAT; i++) times.push(await still(m.id, frame, out, {inputProps: m.inputProps}));
  perf.scenes[m.key] = +median(times).toFixed(2);
  console.log(m.key, `${median(times).toFixed(2)} s/frame`);
  if (m.crop) {
    const big = join(OUT, `_4k-${m.key}.png`);
    perf.fourK = {...perf.fourK, [m.key]: +(await still(m.id, frame, big, {scale: 2, inputProps: m.inputProps})).toFixed(2)};
    crop(big, join(OUT, `crop4k-${m.key}.png`), 1280, 720);
    execFileSync('rm', ['-f', big]);
  }
}
const v = Object.values(perf.scenes);
perf.max = Math.max(...v); perf.median = median(v);
writeFileSync(join(OUT, ONLY === 'all' ? 'perf.json' : `perf-${ONLY}.json`), JSON.stringify(perf, null, 1) + '\n');
console.log(`max ${perf.max} s/frame, median ${perf.median} s/frame (budget 1.5 s)`);
await browser.close({silent: false});
