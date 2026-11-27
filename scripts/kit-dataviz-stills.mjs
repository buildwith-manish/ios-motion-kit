// Render dataviz demo stills.
//   node scripts/kit-dataviz-stills.mjs                       # default moments, all three canvases
//   KIT_AT=1.5,4.35 KIT_COMP=Kit-Dataviz-Demo node scripts/kit-dataviz-stills.mjs
//   KIT_CHROME=/path/to/chrome ...                            # force a browser
// Output: docs/previews/kit/dataviz-<canvas>-<seconds>s.jpg
// Browser lookup reuses scripts/kit_qa_common.mjs (KIT_CHROME, Remotion's browser, Playwright shell, @sparticuz/chromium).
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import {mkdirSync} from 'node:fs';
import {resolveBrowser} from './kit_qa_common.mjs';

const outDir = path.resolve('docs/previews/kit');
mkdirSync(outDir, {recursive: true});

// Seconds into the 10 s demo; keep in sync with src/kit/demo/DatavizDemo.tsx
const DEFAULT_AT = [0.6, 1.5, 2.6, 3.6, 4.75, 5.6, 9.5];
const jobs = [
  {id: 'Kit-Dataviz-Demo', tag: 'landscape-60', at: DEFAULT_AT},
  {id: 'Kit-Dataviz-Demo-Vertical', tag: 'vertical-60', at: [1.5, 3.6, 4.75, 9.5]},
  {id: 'Kit-Dataviz-Demo-30fps', tag: 'landscape-30', at: [4.75]},
];
const onlyComp = process.env.KIT_COMP ? process.env.KIT_COMP.split(',') : null;
const customAt = process.env.KIT_AT ? process.env.KIT_AT.split(',').map(Number) : null;

const {executable} = await resolveBrowser();
const opts = {browserExecutable: executable, chromeMode: 'chrome-for-testing', chromiumOptions: {gl: 'swangle'}};
const serveUrl = await bundle({entryPoint: path.resolve('src/kit/demo/entry.tsx')});
for (const job of jobs) {
  if (onlyComp && !onlyComp.includes(job.id)) continue;
  const comp = await selectComposition({serveUrl, id: job.id, ...opts});
  for (const sec of customAt ?? job.at) {
    const frame = Math.min(comp.durationInFrames - 1, Math.round(sec * comp.fps));
    const output = path.join(outDir, `dataviz-${job.tag}-${sec.toFixed(2).replace(/\.?0+$/, '')}s.jpg`);
    const t0 = Date.now();
    await renderStill({composition: comp, serveUrl, output, frame, imageFormat: 'jpeg', jpegQuality: 90, ...opts, logLevel: 'error'});
    console.log('rendered', path.relative(process.cwd(), output), `${Date.now() - t0}ms`);
  }
}
