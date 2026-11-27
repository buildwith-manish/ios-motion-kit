// Node check of the transition rules (no browser needed): node scripts/kit-audit.mjs
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {mkdtempSync, rmSync} from 'node:fs';
import path from 'node:path';

const out = path.join(mkdtempSync(path.join(process.cwd(), 'node_modules', '.kit-audit-')), 'audit.mjs');
await build({
  stdin: {
    contents: `
      import React from 'react';
      import {renderToStaticMarkup} from 'react-dom/server';
      import {auditTransition, TransitionScene, MatchedElement, createTheme} from '${path.resolve('src/kit').replace(/\\/g, '/')}/index';
      export {auditTransition};
      export const html = (kind, frame, theme) => renderToStaticMarkup(
        React.createElement(TransitionScene, {frame, theme, kind, start: 1, duration: 1,
          outgoing: React.createElement('div', {'data-scene': 'out'}, React.createElement(MatchedElement, {id: 'h', rect: {x: 0, y: 0, width: 100, height: 60}}, React.createElement('i', {'data-m': 'out'}))),
          incoming: React.createElement('div', {'data-scene': 'in'}, React.createElement(MatchedElement, {id: 'h', rect: {x: 200, y: 100, width: 300, height: 180}}, React.createElement('i', {'data-m': 'in'}))),
          motionBlur: true}));
      export {createTheme};
    `,
    resolveDir: process.cwd(),
    loader: 'tsx',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  logLevel: 'error',
  external: ['react', 'react-dom', 'remotion'],
});
const m = await import(pathToFileURL(out).href);
const kinds = ['push', 'blurDissolve', 'sheet', 'zoomThrough', 'matchedGeometry', 'wipeMask'];
const configs = [
  {fps: 60, width: 1920, height: 1080},
  {fps: 60, width: 1080, height: 1920},
  {fps: 30, width: 1920, height: 1080},
];
let bad = 0;
for (const c of configs) {
  for (const kind of kinds) {
    for (const dur of [0.4, 0.8, 1.5]) {
      for (const timing of [{curve: 'spring'}, {curve: 'ease'}, {curve: 'spring', response: 0.3}]) {
        const r = m.auditTransition({kind, ...c, duration: dur, timing});
        if (!r.ok) { bad++; console.log('FAIL', kind, c, dur, JSON.stringify(timing), r.violations.slice(0, 3)); }
      }
    }
  }
}
// Mount checks (frame / start=1s / duration=1s)
for (const c of configs) {
  const theme = m.createTheme({canvas: c});
  for (const kind of kinds) {
    const before = m.html(kind, Math.round(c.fps * 0.5), theme);
    const mid = m.html(kind, Math.round(c.fps * 1.3), theme);
    const end = m.html(kind, Math.round(c.fps * 2), theme);
    const afterEnd = m.html(kind, Math.round(c.fps * 3), theme);
    const chk = (name, ok) => { if (!ok) { bad++; console.log('FAIL mount', kind, c.fps, c.width, name); } };
    chk('before: only outgoing', before.includes('data-scene="out"') && !before.includes('data-scene="in"'));
    chk('mid: both mounted', mid.includes('data-scene="out"') && mid.includes('data-scene="in"'));
    chk('end: outgoing unmounted', !end.includes('data-scene="out"') && end.includes('data-scene="in"'));
    chk('after: outgoing unmounted', !afterEnd.includes('data-scene="out"'));
    if (kind === 'matchedGeometry') {
      const n = (s, k) => (s.match(new RegExp('data-m="' + k + '"', 'g')) || []).length;
      chk('matched: morph copy drawn once per side in overlay', n(mid, 'out') === 1 && n(mid, 'in') === 1);
      chk('matched: single copy after end', n(end, 'in') === 1 && n(end, 'out') === 0);
    }
  }
}
rmSync(path.dirname(out), {recursive: true, force: true});
console.log(bad === 0 ? 'kit-audit: all checks passed' : `kit-audit: ${bad} failures`);
process.exit(bad === 0 ? 0 : 1);
