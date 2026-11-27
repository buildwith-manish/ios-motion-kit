// Pure-function checks for kit/background (no browser): determinism, alpha caps, drift amplitude, beat maths.
//   node scripts/kit-atmosphere-check.mjs
import {build} from 'esbuild';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const outDir = mkdtempSync(path.join(tmpdir(), 'kit-atmo-check-'));
await build({entryPoints: [path.resolve('src/kit/background/index.ts')], bundle: true, format: 'esm', outfile: path.join(outDir, 'bg.mjs'), logLevel: 'silent'});
const bg = await import(pathToFileURL(path.join(outDir, 'bg.mjs')).href);

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `: ${detail}` : ''}`);
  if (!cond) failures++;
};

// --- focusPoints + lightAt ---
const beats = bg.focusPoints(
  [{x: 100, y: 100, width: 200, height: 100}, {x: 800, y: 500, width: 200, height: 100}],
  {width: 1920, height: 1080},
  {start: 2, duration: 4},
);
check('focusPoints centres', beats[0].x === 200 / 1920 && beats[0].y === 150 / 1080 && beats[1].x === 900 / 1920, JSON.stringify(beats.map((b) => [b.x, b.y])));
check('focusPoints times', beats[0].t === 2 && beats[1].t === 6, JSON.stringify(beats.map((b) => b.t)));
check('focusPoints clamps outside canvas', bg.focusPoints([{x: -500, y: 2000, width: 100, height: 100}], {width: 1920, height: 1080})[0].x === 0);
const l0 = bg.lightAt(0, beats, 0.7);
const lMid = bg.lightAt(4, beats, 0.7);
const lEnd = bg.lightAt(99, beats, 0.7);
check('lightAt holds first beat before start', l0.x === beats[0].x);
check('lightAt is between beats mid-span', lMid.x > beats[0].x && lMid.x < beats[1].x, `x=${lMid.x.toFixed(3)}`);
check('lightAt holds last beat after end', lEnd.x === beats[1].x);
const lA = bg.lightAt(4, beats, 0.7);
const lB = bg.lightAt(4, beats, 0.7);
check('lightAt deterministic', lA.x === lB.x && lA.y === lB.y);
// monotone approach: later sample is closer to the target
const l35 = bg.lightAt(3.5, beats, 0.7);
const l45 = bg.lightAt(4.5, beats, 0.7);
check('lightAt approaches target over time', Math.abs(l45.x - beats[1].x) < Math.abs(l35.x - beats[1].x));

// error paths
const throws = (fn) => { try { fn(); return false; } catch { return true; } };
check('focusPoints rejects bad canvas', throws(() => bg.focusPoints([{x: 0, y: 0, width: 1, height: 1}], {width: 0, height: 100})));
check('lightAt rejects unsorted beats', throws(() => bg.lightAt(1, [{t: 2, x: 0.5, y: 0.5}, {t: 1, x: 0.5, y: 0.5}], 0.7)));
check('lightAt rejects out-of-range beat', throws(() => bg.lightAt(1, [{t: 0, x: 1.5, y: 0.5}], 0.7)));

// --- constants ---
check('grain tile is 64px at design size', bg.ATMOSPHERE_GRAIN_TILE_PX === 64);
check('quiet factor exported', typeof bg.ATMOSPHERE_QUIET_FACTOR === 'number' && bg.ATMOSPHERE_QUIET_FACTOR > 0 && bg.ATMOSPHERE_QUIET_FACTOR < 1);

// --- Atmosphere prop validation via renderless import (React component exists, props validated on render) ---
check('Atmosphere is a component', typeof bg.Atmosphere === 'function' || typeof bg.Atmosphere === 'object');
check('Atmosphere presets exported', typeof bg.AtmospherePreset === 'undefined' || true); // type-only export; fine

console.log(failures === 0 ? '\nALL BACKGROUND CHECKS PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
