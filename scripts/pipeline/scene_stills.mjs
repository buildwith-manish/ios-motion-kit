#!/usr/bin/env node
/**
 * Review stills of chosen scenes at chosen moments (dev / CI only), plus one tiled sheet (rows = scenes, columns = moments).
 *   node scripts/pipeline/scene_stills.mjs [--root <repo>] [--only=id,id] [--force] [--dry-run]
 * config.stills: outDir, sheet, scale, workers, scenes: [{id, shot, moments: [{name, word?, offsetSeconds?}]}].
 * A moment's time = the shot's start, or with "word" the time that word is spoken in the shot (layout words, first match, case
 * and punctuation ignored; the shot start when it is not found), plus offsetSeconds. Frame = round(time x config.canvas.fps).
 * Files: <outDir>/<scene id>-<moment name>.png. --dry-run prints the plan only (no bundling, no Chromium).
 */
import fs from 'node:fs';
import path from 'node:path';
import {fail, init, readLayout} from './lib.mjs';
import {tileSheet} from './tile.mjs';

const {root, cfg, args, at} = init(undefined, {only: 'value', force: true, 'dry-run': true});
const S = cfg.stills;
if (!S.scenes.length) fail('config.stills.scenes is empty: list scenes as {id, shot, moments: [{name, word?, offsetSeconds?}]}');
const only = args.only?.split(',').map((s) => s.trim()).filter(Boolean);
const layout = readLayout(root, cfg);
const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9']/g, '');
const scenes = S.scenes.filter((s) => !only || only.includes(s.id));
const file = (id, m) => path.join(at(S.outDir), `${id}-${m}.png`);

const jobs = scenes.flatMap((sc) => {
  const shot = layout.shots.find((x) => x.id === sc.shot);
  if (!shot) fail(`scene ${sc.id}: shot "${sc.shot}" is not in the layout`);
  return sc.moments.map((m) => {
    const w = m.word ? (shot.words ?? []).find(([x]) => norm(x) === norm(m.word)) : null;
    const t = (w ? shot.speechStart + w[1] : shot.start) + (m.offsetSeconds ?? 0);
    const frame = Math.max(0, Math.min(Math.ceil(layout.totalSeconds * cfg.canvas.fps) - 1, Math.round(t * cfg.canvas.fps)));
    return {id: sc.id, m: m.name, t, frame, out: file(sc.id, m.name), word: m.word && !w ? `(word "${m.word}" not found, using the shot start)` : ''};
  });
});
const todo = jobs.filter((j) => args.force || !fs.existsSync(j.out));
if (args['dry-run']) {
  for (const j of jobs) console.log(`${j.id} ${j.m}: ${j.t.toFixed(2)} s = frame ${j.frame} ${j.word}`.trim());
  console.log(`${jobs.length} stills (${todo.length} to render)`);
  process.exit(0);
}

const render = async () => {
  const {bundle} = await import('@remotion/bundler');
  const R = await import('@remotion/renderer');
  await R.ensureBrowser();
  fs.mkdirSync(at(S.outDir), {recursive: true});
  console.log('bundling...');
  const serveUrl = await bundle({entryPoint: at(cfg.render.entry)});
  const chromiumOptions = {gl: 'angle'};
  const probe = await R.openBrowser('chrome', {chromiumOptions});
  const comp = await R.selectComposition({serveUrl, id: cfg.render.composition, puppeteerInstance: probe, timeoutInMilliseconds: 300000});
  await probe.close({silent: true});
  console.log(`${todo.length} stills to render, ${S.workers} workers`);
  let next = 0;
  const worker = async (w) => {
    const browser = await R.openBrowser('chrome', {chromiumOptions});
    try {
      for (;;) {
        const j = todo[next++];
        if (!j) break;
        const t0 = Date.now();
        await R.renderStill({composition: comp, serveUrl, output: j.out, frame: Math.min(comp.durationInFrames - 1, j.frame), scale: S.scale, imageFormat: 'png', puppeteerInstance: browser, chromiumOptions, timeoutInMilliseconds: 300000, logLevel: 'error'});
        console.log(`[w${w}] ${j.id} ${j.m} (frame ${j.frame}): ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      }
    } finally { await browser.close({silent: true}); }
  };
  await Promise.all(Array.from({length: S.workers}, (_, w) => worker(w)));
};

try {
  if (todo.length) await render();
  const cols = Math.max(...scenes.map((s) => s.moments.length));
  const items = scenes.flatMap((s) => [...s.moments, ...Array(cols - s.moments.length).fill(null)].map((m) => m && {file: file(s.id, m.name), label: `${s.id} ${m.name}`})).filter(Boolean);
  const {width, height} = await tileSheet({cwd: root, items, tileW: 480, cols, out: at(S.sheet), gap: 12, aspect: cfg.canvas.height / cfg.canvas.width});
  console.log(`wrote ${S.sheet} (${width}x${height})`);
} catch (e) { fail(String(e.message ?? e)); }
