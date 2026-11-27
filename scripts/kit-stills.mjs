// Render kit demo stills: KIT_CHROME=/path/to/chrome node scripts/kit-stills.mjs
// Output: docs/previews/kit/transitions-<canvas>-<kind>-<pct>.jpg (25/50/75% of every transition).
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import {mkdirSync} from 'node:fs';

const kinds = ['push', 'blurDissolve', 'sheet', 'zoomThrough', 'matchedGeometry', 'wipeMask'];
const hold = 1.2;
const dur = 1.0; // keep in sync with src/kit/demo/TransitionsDemo.tsx (demoStart / demoStills)
const start = (k) => hold + k * (hold + dur);
const outDir = path.resolve('docs/previews/kit');
mkdirSync(outDir, {recursive: true});
const browserExecutable = process.env.KIT_CHROME || null;

const serveUrl = await bundle({entryPoint: path.resolve('src/kit/demo/entry.tsx')});
const jobs = [
  {id: 'Kit-Transitions-Demo', tag: 'landscape-60', pcts: [25, 50, 75]},
  {id: 'Kit-Transitions-Demo-Vertical', tag: 'vertical-60', pcts: [25, 50, 75]},
  {id: 'Kit-Transitions-Demo-30fps', tag: 'landscape-30', pcts: [50]},
];
for (const job of jobs) {
  const comp = await selectComposition({serveUrl, id: job.id, browserExecutable, chromeMode: 'chrome-for-testing', chromiumOptions: {gl: 'swangle'}});
  for (const [k, kind] of kinds.entries()) {
    for (const pct of job.pcts) {
      const frame = Math.round((start(k) + (dur * pct) / 100) * comp.fps);
      const output = path.join(outDir, `transitions-${job.tag}-${kind}-${pct}.jpg`);
      await renderStill({composition: comp, serveUrl, output, frame, imageFormat: 'jpeg', jpegQuality: 90, browserExecutable, chromeMode: 'chrome-for-testing', chromiumOptions: {gl: 'swangle'}, logLevel: 'error'});
      console.log('rendered', path.relative(process.cwd(), output));
    }
  }
}
