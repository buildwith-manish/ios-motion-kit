// Node check of the audio kit's rules (no browser, no audio output): node scripts/kit-audio-check.mjs
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {mkdtempSync, rmSync} from 'node:fs';
import path from 'node:path';

const dir = mkdtempSync(path.join(process.cwd(), 'node_modules', '.kit-audio-'));
const out = path.join(dir, 'audio.mjs');
await build({
  stdin: {
    contents: `export * from '${path.resolve('src/kit/audio').replace(/\\/g, '/')}/index'; export {transitionProgress} from '${path.resolve('src/kit/transitions').replace(/\\/g, '/')}/progress'; export {iosSpring} from '${path.resolve('src/kit/motion').replace(/\\/g, '/')}/index';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', external: ['react', 'react-dom', 'remotion'],
});
const K = await import(pathToFileURL(out).href);
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

// 1. determinism + seed
const base = [];
for (let i = 0; i < 40; i++) base.push(K.cue(K.SFX_FAMILIES[i % 13], 0.5 + i * 0.37));
const a = K.resolveCues(base, {seed: 5}), b = K.resolveCues(base, {seed: 5}), c = K.resolveCues(base, {seed: 6});
ok(JSON.stringify(a) === JSON.stringify(b), 'same seed -> identical result');
ok(JSON.stringify(a.cues.map((x) => x.variant)) !== JSON.stringify(c.cues.map((x) => x.variant)), 'different seed -> different variants');

// 2/3. stress: random dense cues, many seeds
let maxSim = 0, dupViolations = 0, repeatViolations = 0, total = 0, dropped = 0;
for (let seed = 1; seed <= 200; seed++) {
  const rnd = K.mulberry32(seed);
  const cues = [];
  for (let i = 0; i < 60; i++) cues.push(K.cue(K.SFX_FAMILIES[Math.floor(rnd() * 13)], rnd() * 8, {pan: rnd() * 2 - 1}));
  const r = K.resolveCues(cues, {seed});
  total += r.cues.length; dropped += r.dropped.length;
  for (const x of r.cues) {
    const active = r.cues.filter((y) => y.at <= x.at && y.end > x.at).length;
    maxSim = Math.max(maxSim, active);
    for (const y of r.cues) if (y !== x && y.name === x.name && y.variant === x.variant && Math.abs(y.at - x.at) < 0.12) dupViolations++;
  }
  const byFam = {};
  for (const x of r.cues) { (byFam[x.name] ||= []).push(x); }
  for (const list of Object.values(byFam)) for (let i = 1; i < list.length; i++) if (list[i].variant === list[i - 1].variant) repeatViolations++;
}
ok(maxSim <= 3, 'max simultaneous <= 3 over 200 dense random timelines (observed ' + maxSim + ', kept ' + total + ', dropped ' + dropped + ')');
ok(dupViolations === 0, 'no identical file twice within 120 ms');
console.log('info: consecutive same-variant repeats in a family (allowed only when other variants were blocked):', repeatViolations);

// forced duplicate is dropped
const f = K.resolveCues([K.cue('tap', 1, {variant: 2}), K.cue('tap', 1.05, {variant: 2})]);
ok(f.cues.length === 1 && f.dropped[0].reason === 'duplicate', 'forced identical variant within 120 ms is dropped');
const g = K.resolveCues([K.cue('tap', 1), K.cue('tap', 1.05), K.cue('tap', 1.1), K.cue('tap', 1.15)]);
ok(g.cues.length >= 3 && new Set(g.cues.filter((x) => x.at < 1.12).map((x) => x.variant)).size === g.cues.filter((x) => x.at < 1.12).length, 'rapid same-family cues get distinct variants');

// peak anchor
const p = K.resolveCues([K.cue('impact-soft', 2, {anchor: 'peak', variant: 1})]);
ok(Math.abs(p.cues[0].at + p.cues[0].info.peakTime - 2) < 1e-9, 'peak anchor lands the loudest sample at the cue time');

// 4. ducking
const hz = 30, rms = new Array(hz * 10).fill(0);
for (let i = Math.round(1 * hz); i < Math.round(3 * hz); i++) rms[i] = 0.08; // speech 1.0-3.0 s, continuous
const env = {version: 1, hz, rms};
const duck = K.createDuck(env, {depthDb: 7.5, attackSeconds: 0.08, releaseSeconds: 0.4, holdSeconds: 0.15});
const db = (t) => duck.gainDbAtSeconds(t);
ok(Math.abs(db(0.9)) < 0.05, 'no duck before speech (' + db(0.9).toFixed(2) + ' dB)');
ok(db(1.0 + 0.08) <= -7.5 * 0.94 && db(1.0 + 0.08) >= -7.5 * 0.96, 'attack: ~95% of the duck 80 ms after speech starts (' + db(1.08).toFixed(2) + ' dB)');
ok(db(2.5) < -7.45, 'full depth under speech (' + db(2.5).toFixed(2) + ' dB)');
const relT = 3.0 + 0.15; // end of hold
ok(db(relT + 0.4) >= -7.5 * 0.06 - 1e-6 && db(relT + 0.4) <= -7.5 * 0.04 + 1e-6, 'release: ~95% recovered 400 ms after the hold ends (' + db(relT + 0.4).toFixed(2) + ' dB)');
for (const d of [6, 9]) ok(Math.abs(K.createDuck(env, {depthDb: d}).gainDbAtSeconds(2.5) + d) < 0.05, `depth ${d} dB reached`);
const arr = K.duckGainPerFrame(env, 60, 600);
ok(arr.length === 600 && Math.abs(arr[150] - K.dbToGain(db(2.5))) < 1e-6, 'duckGainPerFrame matches gainAtSeconds at 60 fps');
const arr30 = K.duckGainPerFrame(env, 30, 300);
ok(Math.abs(arr30[75] - arr[150]) < 1e-6, 'same curve at 30 fps (frame 75 == frame 150 @60)');

// 5. SFX never louder than the voice
const worst = [];
for (const fam of K.SFX_FAMILIES) for (let v = 1; v <= 3; v++) {
  const rc = K.resolveCues([K.cue(fam, 0.2, {variant: v, gain: 3})]).cues[0];
  for (const vo of [0.004, 0.01, 0.05, 0.2]) {
    const e2 = {version: 1, hz, rms: new Array(300).fill(vo)};
    const g2 = K.sfxGainAt(rc, 1.0, {voice: e2});
    const sfxRms = K.dbToGain(rc.info.rmsDb) * g2;
    if (sfxRms > vo * K.dbToGain(-3) + 1e-9) worst.push([fam, v, vo, sfxRms]);
  }
}
ok(worst.length === 0, 'SFX RMS stays >= 3 dB under the voice RMS for every sound at voice levels -48..-14 dBFS (above the -50 dBFS gate)');
const quiet = K.resolveCues([K.cue('pop', 0.2, {variant: 1})]).cues[0];
ok(Math.abs(K.sfxGainAt(quiet, 5, {voice: env}) - quiet.gain) < 1e-6, 'no voice -> SFX at full cue gain (no duck)');
ok(K.sfxGainAt(quiet, 2, {voice: env}) < quiet.gain * 0.6, 'under speech the SFX is ducked');

// 6. motion events
const ev = K.enterEvents(1, 0.5);
ok(Math.abs(K.iosSpring(ev[2].at - 1, 0.5) - 0.99) < 1e-6, 'spring-settle is where the spring reaches 99%');
let best = 0, bestT = 0;
for (let t = 0; t < 0.5; t += 1e-4) { const v = (K.iosSpring(t + 1e-5, 0.5) - K.iosSpring(t, 0.5)) / 1e-5; if (v > best) { best = v; bestT = t; } }
ok(Math.abs(bestT - ev[1].at + 1) < 2e-3, 'peak-velocity matches the numeric velocity maximum (' + bestT.toFixed(4) + ' vs ' + (ev[1].at - 1).toFixed(4) + ')');
let maxDiff = 0;
for (const timing of [{}, {curve: 'ease'}, {response: 0.5}]) for (let t = -0.1; t < 1.2; t += 0.013) maxDiff = Math.max(maxDiff, Math.abs(K.transitionProgressAt(t, 1, timing) - K.transitionProgress(60 * (2 + t), 2, 1, 60, timing)));
ok(maxDiff < 1e-9, 'transitionProgressAt == kit transitionProgress (max diff ' + maxDiff.toExponential(1) + ')');
const te = K.transitionEvents(2, 0.8);
ok(te.length === 3 && te[0].at === 2 && te[1].at > 2 && te[1].at < te[2].at && te[2].at <= 2.8, 'transition events ordered inside the window');
const nr = K.numberRollEvents({start: 1, digits: 3, ticksPerDigit: 5});
const ticks = nr.filter((e) => e.kind === 'number-tick');
ok(nr[0].kind === 'number-roll-start' && ticks.length === 15, 'number roll: 1 start + 15 ticks');
const d0 = ticks.filter((e) => e.index < 5).map((e) => e.at);
ok(d0[1] - d0[0] < d0[4] - d0[3], 'ticks thin out as the roll decelerates');
const mc = K.cuesFromMotion([...K.enterEvents(1), ...nr], [{on: 'enter-start', play: 'pop', offset: -0.02}, {on: 'peak-velocity', play: 'whoosh-fast', anchor: 'peak'}, {on: 'number-tick', play: 'number-tick', every: 3}]);
ok(mc.length === 2 + 5 && Math.abs(mc[0].at - 0.98) < 1e-9, 'cuesFromMotion binds rules (offset, every)');

rmSync(dir, {recursive: true, force: true});
console.log(fails === 0 ? '\nAll audio checks passed' : `\n${fails} FAILED`);
process.exit(fails ? 1 : 0);
