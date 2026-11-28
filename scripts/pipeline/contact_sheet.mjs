#!/usr/bin/env node
/**
 * Contact sheets: one still from the MIDDLE of every shot of the layout (config.output.layout), rendered from the master
 * composition (config.render.composition) with `npx remotion still`, then tiled with the shot id and time under each tile.
 *   node scripts/pipeline/contact_sheet.mjs [--root <repo>] [--only=id,id] [--skip-render] [--force] [--dry-run]
 * Frame = round(shot middle seconds x config.canvas.fps). Sheets: config.render.contactSheet.sheets ({file, tileWidth, columns}).
 * Frames: config.render.contactSheet.framesDir/<id>.png. --dry-run prints the plan only (no Chromium, no sharp).
 * Needs a working Chromium for rendering; tiling uses sharp (installed with --no-save on first use).
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fail, init, readLayout} from './lib.mjs';
import {tileSheet} from './tile.mjs';

const {root, cfg, args, at} = init(undefined, {only: 'value', 'skip-render': true, force: true, 'dry-run': true});
const only = args.only?.split(',').map((s) => s.trim()).filter(Boolean);
const layout = readLayout(root, cfg);
const frames = at(cfg.render.contactSheet.framesDir);
const framePath = (id) => path.join(frames, `${id}.png`);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const scenes = layout.shots.filter((s) => !only || only.includes(s.id)).map((s) => {
  const mid = s.start + s.seconds / 2;
  return {id: s.id, sec: mid, frame: Math.round(mid * cfg.canvas.fps)};
});
if (only) { const miss = only.filter((id) => !scenes.some((s) => s.id === id)); if (miss.length) fail(`Unknown shot id(s): ${miss.join(', ')}`); }

if (args['dry-run']) {
  for (const s of scenes) console.log(`${s.id}: frame ${s.frame} (${mmss(s.sec)}) -> ${path.relative(root, framePath(s.id))}`);
  console.log(`${scenes.length} frames, ${cfg.render.contactSheet.sheets.length} sheet(s), composition ${cfg.render.composition}`);
  process.exit(0);
}
try {
  if (!args['skip-render']) {
    fs.mkdirSync(frames, {recursive: true});
    for (const s of scenes) {
      if (!args.force && fs.existsSync(framePath(s.id))) { console.log(`skip ${s.id} (frame exists)`); continue; }
      console.log(`render ${s.id} frame ${s.frame} (${mmss(s.sec)})`);
      const r = spawnSync('npx', ['remotion', 'still', cfg.render.entry, cfg.render.composition, framePath(s.id), `--frame=${s.frame}`, `--scale=${cfg.render.scale}`, '--image-format=png', '--timeout=300000', '--log=error'], {cwd: root, stdio: 'inherit', shell: process.platform === 'win32'});
      if (r.status !== 0) throw new Error(`remotion still failed for ${s.id} (frame ${s.frame}), exit ${r.status}`);
    }
  }
  const items = scenes.map((s) => ({file: framePath(s.id), label: `${s.id}  ${mmss(s.sec)}`}));
  for (const sh of cfg.render.contactSheet.sheets) {
    const {width, height} = await tileSheet({cwd: root, items, tileW: sh.tileWidth, cols: sh.columns, out: at(sh.file), aspect: cfg.canvas.height / cfg.canvas.width});
    console.log(`wrote ${sh.file} (${width}x${height}, ${items.length} tiles)`);
  }
} catch (e) { fail(String(e.message ?? e)); }
