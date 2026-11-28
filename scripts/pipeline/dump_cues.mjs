#!/usr/bin/env node
/**
 * Dumps your cue list to JSON so mix_check.py can mix the effects without rendering. Bundles config.cues.module with esbuild and
 * reads its export (config.cues.export): an array (or a function returning one) of cue objects.
 *   node scripts/pipeline/dump_cues.mjs [--root <repo>] [--config <file>] [--out file.json]
 * config.cues: module, export, atField + atUnit ("frames" at config.cues.fps || config.fps, or "seconds"), sfxField, gainField, heroField.
 * Output: {total, shots: {<section id>: seconds}, cues: [{sfx, t, gain, hero, tag: <section id the cue lands in>}]}, from the layout.
 * Fonts, CSS and images imported by the module are stubbed, so a cue module may live next to components.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {fail, init, readLayout} from './lib.mjs';

const {root, cfg, args, at} = init(undefined, {out: 'value'});
const c = cfg.cues;
if (!c.module) fail('config.cues.module is not set (the file that exports your cue list)');
const {build} = await import('esbuild');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cues-'));
const outfile = path.join(tmp, 'cues.mjs');
try {
  await build({
    entryPoints: [at(c.module)], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'error',
    loader: {'.css': 'empty', '.woff2': 'empty', '.woff': 'empty', '.ttf': 'empty', '.png': 'empty', '.jpg': 'empty', '.svg': 'empty', '.json': 'json'},
    banner: {js: "import {createRequire as __cr} from 'node:module';const require=__cr(import.meta.url);"},
  });
  const mod = await import(pathToFileURL(outfile).href);
  let list = mod[c.export] ?? (c.export === 'default' ? mod.default : undefined);
  if (typeof list === 'function') list = list();
  if (!Array.isArray(list)) fail(`${c.module} has no array export "${c.export}"`);
  const layout = readLayout(root, cfg);
  const fps = c.fps ?? cfg.fps;
  const sections = [...layout.sections].sort((a, b) => a.start - b.start);
  const tagAt = (t) => [...sections].reverse().find((s) => s.start <= t + 1e-9)?.id ?? sections[0]?.id;
  const cues = list.map((x) => {
    const t = c.atUnit === 'frames' ? x[c.atField] / fps : x[c.atField];
    return {sfx: x[c.sfxField], t, gain: x[c.gainField] ?? 1, hero: !!x[c.heroField], tag: tagAt(t)};
  }).sort((a, b) => a.t - b.t);
  const data = {total: layout.totalSeconds, shots: Object.fromEntries(sections.map((s) => [s.id, s.start])), cues};
  const dest = args.out ? path.resolve(args.out) : at(c.out);
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.writeFileSync(dest, JSON.stringify(data) + '\n');
  console.log(`${path.relative(root, dest)}: ${cues.length} cues over ${data.total.toFixed(1)} s`);
} finally {
  fs.rmSync(tmp, {recursive: true, force: true});
}
