// Stills of the audio demo: KIT_CHROME=/path/to/chrome node scripts/kit-audio-stills.mjs
// Output: docs/previews/kit/audio-<canvas>-<seconds>s.jpg
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import {mkdirSync} from 'node:fs';

const outDir = path.resolve('docs/previews/kit');
mkdirSync(outDir, {recursive: true});
const browserExecutable = process.env.KIT_CHROME || null;
const serveUrl = await bundle({entryPoint: path.resolve('src/kit/demo/entry.tsx')});
const jobs = [
  {id: 'Kit-Audio-Demo', tag: 'landscape-60', secs: [0.9, 2.0, 4.3, 6.7, 9.12]},
  {id: 'Kit-Audio-Demo-Vertical', tag: 'vertical-60', secs: [2.0, 9.12]},
  {id: 'Kit-Audio-Demo-30fps', tag: 'landscape-30', secs: [2.0]},
];
for (const job of jobs) {
  const comp = await selectComposition({serveUrl, id: job.id, browserExecutable, chromeMode: 'chrome-for-testing', chromiumOptions: {gl: 'swangle'}});
  for (const s of job.secs) {
    const output = path.join(outDir, `audio-${job.tag}-${s.toFixed(1)}s.jpg`);
    await renderStill({composition: comp, serveUrl, output, frame: Math.round(s * comp.fps), imageFormat: 'jpeg', jpegQuality: 90, browserExecutable, chromeMode: 'chrome-for-testing', chromiumOptions: {gl: 'swangle'}, logLevel: 'error'});
    console.log('rendered', path.relative(process.cwd(), output));
  }
}
