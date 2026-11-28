#!/usr/bin/env node
/**
 * Renders the <MetroMap> review stills and measures seconds per frame (software GL) at 1080p and 4K for the light and
 * rich tiers, plus the path/point budget of each frame. Dev/CI only (needs a browser: run the "Map metro" workflow).
 *
 *   node scripts/map_metro_stills.mjs [--out=docs/previews/kit-map/metro] [--only=all|review|perf] [--repeat=3] [--cities=a,b]
 *
 * Writes <out>/*.png (review stills + 1280x720 centre crops of true-4K renders) and <out>/perf.json.
 */
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {buildSync} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=').slice(1).join('=');
const OUT = join(ROOT, arg('out', 'docs/previews/kit-map/metro'));
const ONLY = arg('only', 'all');
const REPEAT = Number(arg('repeat', 3));
const allCities = JSON.parse(readFileSync(join(ROOT, 'public/kit/map/cities.json'), 'utf8')).map((c) => c.id);
const cityIds = arg('cities', allCities.join(',')).split(',').filter(Boolean);
mkdirSync(OUT, {recursive: true});

// the geometry/LOD modules are pure TS: bundle them for node to compute budgets without a browser
const tmp = join(ROOT, '.cache', 'metro.bundle.mjs');
mkdirSync(dirname(tmp), {recursive: true});
buildSync({stdin: {contents: "export * from './src/kit/map/metroIndex'; export * from './src/kit/map/metroLod';", resolveDir: ROOT, loader: 'ts'}, bundle: true, format: 'esm', platform: 'node', outfile: tmp, logLevel: 'error'});
const {metroGeometry, metroLod} = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);
const cityFile = (id, detail) => JSON.parse(readFileSync(join(ROOT, `public/kit/map/cities/${detail === 'rich' ? `${id}.json` : `${id}.light.json`}`), 'utf8'));
const budgetOf = (id, detail, zoom, mode, w, h) => metroGeometry(cityFile(id, detail), {width: w, height: h, zoom}, metroLod(zoom), mode === 'hero').budget;

const serveUrl = await bundle({entryPoint: join(ROOT, 'src/kit/demo/entry.tsx'), publicDir: join(ROOT, 'public')});
const browser = await openBrowser('chrome', {browserExecutable: null});
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const still = async (id, frame, output, {scale = 1, inputProps = {}} = {}) => {
  const comp = await selectComposition({serveUrl, id, inputProps, puppeteerInstance: browser});
  const t0 = performance.now();
  await renderStill({composition: comp, serveUrl, output, frame, scale, inputProps, puppeteerInstance: browser, imageFormat: 'png', overwrite: true});
  return (performance.now() - t0) / 1000;
};
const crop = (src, dst, w, h) => execFileSync('convert', [src, '-gravity', 'center', '-crop', `${w}x${h}+0+0`, '+repage', dst]);
const STILL = {Landscape: 'Kit-Metro-Still-Landscape', Portrait: 'Kit-Metro-Still-Portrait'};
const ZOOMS = [1, 2.2, 4.5];
const slug = (z) => String(z).replace('.', 'p');

const perf = {note: 'seconds per still on a reused browser (no launch cost), software GL, GitHub-hosted runner; hd = 1920x1080, uhd = 3840x2160 (scale 2); median of repeats for hd, single run for uhd', scenes: {}};

if (ONLY !== 'perf') {
  // hero/dim at three zooms, two cities (the PayRanked comparison cities), midnight landscape
  for (const cityId of ['chicago', 'new-york']) for (const mode of ['hero', 'dim']) for (const zoom of ZOOMS)
    await still(STILL.Landscape, 0, join(OUT, `${cityId}-${mode}-z${slug(zoom)}.png`), {inputProps: {theme: 'midnight', cityId, detail: 'rich', zoom, mode, boundary: false}});
  // portrait, other themes, the light tier (no local roads), boundary
  for (const zoom of ZOOMS) await still(STILL.Portrait, 0, join(OUT, `chicago-hero-z${slug(zoom)}-portrait.png`), {inputProps: {theme: 'midnight', cityId: 'chicago', detail: 'rich', zoom, mode: 'hero', boundary: false}});
  await still(STILL.Portrait, 0, join(OUT, 'chicago-dim-z2p2-portrait.png'), {inputProps: {theme: 'midnight', cityId: 'chicago', detail: 'rich', zoom: 2.2, mode: 'dim', boundary: false}});
  for (const theme of ['light', 'mono']) for (const mode of ['hero', 'dim'])
    await still(STILL.Landscape, 0, join(OUT, `chicago-${theme}-${mode}-z2p2.png`), {inputProps: {theme, cityId: 'chicago', detail: 'rich', zoom: 2.2, mode, boundary: false}});
  await still(STILL.Landscape, 0, join(OUT, 'chicago-tier-light-hero-z2p2.png'), {inputProps: {theme: 'midnight', cityId: 'chicago', detail: 'light', zoom: 2.2, mode: 'hero', boundary: false}});
  for (const cityId of ['miami', 'new-york', 'chicago']) await still(STILL.Landscape, 0, join(OUT, `${cityId}-boundary-z1.png`), {inputProps: {theme: 'midnight', cityId, detail: 'rich', zoom: 1, mode: 'hero', boundary: true}});
  // radial reveal: scene 1 of the zoom demo at a few moments
  for (const sec of [0.35, 0.8, 1.3, 1.9]) await still('Kit-Metro-Landscape', Math.round(sec * 60), join(OUT, `reveal-${String(sec).replace('.', 'p')}s.png`), {inputProps: {theme: 'midnight', cityId: 'chicago', mode: 'hero', detail: 'rich'}});
  // true 4K, centre crops (hairlines and edges at native pixels)
  for (const [mode, zoom] of [['hero', 2.2], ['hero', 4.5], ['dim', 2.2]]) {
    const big = join(OUT, `_4k.png`);
    await still(STILL.Landscape, 0, big, {scale: 2, inputProps: {theme: 'midnight', cityId: 'chicago', detail: 'rich', zoom, mode, boundary: false}});
    crop(big, join(OUT, `crop4k-chicago-${mode}-z${slug(zoom)}.png`), 1280, 720);
    execFileSync('rm', ['-f', big]);
  }
}

if (ONLY !== 'review') {
  for (const cityId of cityIds) for (const detail of ['light', 'rich']) for (const zoom of ZOOMS) {
    const inputProps = {theme: 'midnight', cityId, detail, zoom, mode: 'hero', boundary: false};
    const hdTimes = [];
    for (let i = 0; i < REPEAT; i++) hdTimes.push(await still(STILL.Landscape, 0, join(OUT, '_t.png'), {inputProps}));
    const uhd = await still(STILL.Landscape, 0, join(OUT, '_t.png'), {scale: 2, inputProps});
    const key = `${cityId}-${detail}-z${slug(zoom)}`;
    perf.scenes[key] = {hd: +median(hdTimes).toFixed(2), uhd: +uhd.toFixed(2), budget: budgetOf(cityId, detail, zoom, 'hero', 1920, 1080)};
    console.log(key, `hd ${perf.scenes[key].hd} s  4k ${perf.scenes[key].uhd} s`, JSON.stringify(perf.scenes[key].budget));
  }
  // worst case: a frame mid-reveal (masks active) on the demo composition, rich, zoom 1 and 2.2
  perf.reveal = {};
  for (const [name, sec] of [['z1-mid', 1.0], ['z2p2-mid', 3.0 + 1.0]]) {
    const props = {theme: 'midnight', cityId: 'chicago', mode: 'hero', detail: 'rich'};
    const t = [];
    for (let i = 0; i < REPEAT; i++) t.push(await still('Kit-Metro-Landscape', Math.round(sec * 60), join(OUT, '_t.png'), {inputProps: props}));
    perf.reveal[name] = {hd: +median(t).toFixed(2), uhd: +(await still('Kit-Metro-Landscape', Math.round(sec * 60), join(OUT, '_t.png'), {scale: 2, inputProps: props})).toFixed(2)};
    console.log('reveal', name, JSON.stringify(perf.reveal[name]));
  }
  execFileSync('rm', ['-f', join(OUT, '_t.png')]);
  const summary = {};
  for (const detail of ['light', 'rich']) {
    const rows = Object.entries(perf.scenes).filter(([k]) => k.includes(`-${detail}-`)).map(([, v]) => v);
    summary[detail] = {
      hdMedian: +median(rows.map((r) => r.hd)).toFixed(2), hdMax: Math.max(...rows.map((r) => r.hd)),
      uhdMedian: +median(rows.map((r) => r.uhd)).toFixed(2), uhdMax: Math.max(...rows.map((r) => r.uhd)),
      maxElementPoints: Math.max(...rows.map((r) => r.budget.maxElementPoints)), maxPoints: Math.max(...rows.map((r) => r.budget.points)), maxElements: Math.max(...rows.map((r) => r.budget.elements)),
    };
  }
  perf.summary = summary;
  writeFileSync(join(OUT, 'perf.json'), JSON.stringify(perf, null, 1) + '\n');
  console.log('SUMMARY', JSON.stringify(summary), '(budget: 1.5 s per frame at 1080p; no path above ~15k points)');
}
await browser.close({silent: false});
