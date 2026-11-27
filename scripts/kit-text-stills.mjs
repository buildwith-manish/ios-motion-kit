// Render text demo stills: KIT_CHROME=/path/to/chrome node scripts/kit-text-stills.mjs
// Output: docs/previews/kit/text-<canvas>-<label>.jpg
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import {mkdirSync} from 'node:fs';

const outDir = path.resolve('docs/previews/kit');
mkdirSync(outDir, {recursive: true});
const browserExecutable = process.env.KIT_CHROME || null;
// seconds into the 10 s demo; keep in sync with src/kit/demo/TextDemo.tsx
const moments = {'0.8-headline': 0.8, '3.4-sync': 3.4, '5.6-roll': 5.6, '7.9-caption': 7.9, '9.5-end': 9.5};
const jobs = [
  {id: 'Kit-Text-Demo', tag: 'landscape-60', labels: Object.keys(moments)},
  {id: 'Kit-Text-Demo-Vertical', tag: 'vertical-60', labels: ['3.4-sync', '5.6-roll', '9.5-end']},
  {id: 'Kit-Text-Demo-30fps', tag: 'landscape-30', labels: ['5.6-roll']},
  {id: 'Kit-Text-Demo-RTL', tag: 'rtl-60', labels: ['3.4-sync', '9.5-end']},
];
const only = process.env.KIT_ONLY ? process.env.KIT_ONLY.split(',') : null;
const serveUrl = await bundle({entryPoint: path.resolve('src/kit/demo/entry.tsx')});
const opts = {browserExecutable, chromeMode: 'chrome-for-testing', chromiumOptions: {gl: 'swangle'}};
for (const job of jobs) {
  const comp = await selectComposition({serveUrl, id: job.id, ...opts});
  for (const label of job.labels) {
    if (only && !only.includes(label)) continue;
    const frame = Math.min(comp.durationInFrames - 1, Math.round(moments[label] * comp.fps));
    const output = path.join(outDir, `text-${job.tag}-${label}.jpg`);
    const t0 = Date.now();
    await renderStill({composition: comp, serveUrl, output, frame, imageFormat: 'jpeg', jpegQuality: 90, ...opts, logLevel: 'error'});
    console.log('rendered', path.relative(process.cwd(), output), `${Date.now() - t0}ms`);
  }
}
