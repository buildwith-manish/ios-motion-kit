// Render camera demo stills: KIT_CHROME=/path/to/chrome node scripts/kit-camera-stills.mjs
// Output: docs/previews/kit/camera-<canvas>-<label>.jpg
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import {mkdirSync} from 'node:fs';

const outDir = path.resolve('docs/previews/kit');
mkdirSync(outDir, {recursive: true});
const browserExecutable = process.env.KIT_CHROME || null;
// seconds into the 10 s demo; keep in sync with src/kit/demo/CameraDemo.tsx
const moments = [
  ['0.0-start', 0.0],
  ['1.8-pan', 1.8],
  ['4.7-pushin', 4.7],
  ['6.0-pushed', 6.0],
  ['6.9-rack', 6.9],
  ['8.3-roll', 8.3],
  ['9.9-end', 9.9],
];
const jobs = [
  {id: 'Kit-Camera-Demo', tag: 'landscape-60', labels: moments.map((m) => m[0])},
  {id: 'Kit-Camera-Demo-Vertical', tag: 'vertical-60', labels: ['1.8-pan', '6.0-pushed', '6.9-rack', '9.9-end']},
  {id: 'Kit-Camera-Demo-30fps', tag: 'landscape-30', labels: ['6.9-rack']},
];
const only = process.env.KIT_ONLY ? process.env.KIT_ONLY.split(',') : null;
const serveUrl = await bundle({entryPoint: path.resolve('src/kit/demo/entry.tsx')});
for (const job of jobs) {
  const comp = await selectComposition({serveUrl, id: job.id, browserExecutable, chromeMode: 'chrome-for-testing', chromiumOptions: {gl: 'swangle'}});
  for (const label of job.labels) {
    if (only && !only.includes(label)) continue;
    const sec = moments.find((m) => m[0] === label)[1];
    const frame = Math.min(comp.durationInFrames - 1, Math.round(sec * comp.fps));
    const output = path.join(outDir, `camera-${job.tag}-${label}.jpg`);
    const t0 = Date.now();
    await renderStill({composition: comp, serveUrl, output, frame, imageFormat: 'jpeg', jpegQuality: 90, browserExecutable, chromeMode: 'chrome-for-testing', chromiumOptions: {gl: 'swangle'}, logLevel: 'error'});
    console.log('rendered', path.relative(process.cwd(), output), `${Date.now() - t0}ms`);
  }
}
