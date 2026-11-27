// Render atmosphere demo stills: 1080p stills per preset/theme slot + one 4K crop (hairline/grain check).
//   node scripts/kit-atmosphere-stills.mjs
//   KIT_ONLY=landscape node scripts/kit-atmosphere-stills.mjs   # skip the slow 4K crop
// Output: docs/previews/kit/atmosphere-<canvas>-<seconds>s.jpg + atmosphere-4k-crop.png
// Browser lookup reuses scripts/kit_qa_common.mjs (KIT_CHROME, Remotion's browser, Playwright shell, @sparticuz/chromium).
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import {mkdirSync} from 'node:fs';
import {resolveBrowser} from './kit_qa_common.mjs';

const outDir = path.resolve('docs/previews/kit');
mkdirSync(outDir, {recursive: true});

// Keep in sync with src/kit/demo/AtmosphereDemo.tsx: 12 slots of 2 s (4 presets x 3 themes).
// One moment per slot at 1.2 s in (number mid-roll, key light arrived at its first beat).
const SLOT_SECONDS = 2;
const SLOTS = 12;
const atSeconds = Array.from({length: SLOTS}, (_, i) => i * SLOT_SECONDS + 1.2);

const jobs = [
  {id: 'Kit-Atmosphere-Demo', tag: 'landscape-60', at: atSeconds},
  // vertical: one per theme (slots 1, 5, 9) plus one extra preset
  {id: 'Kit-Atmosphere-Demo-Vertical', tag: 'vertical-60', at: [1.2, 5.2, 9.2, 11.2]},
  {id: 'Kit-Atmosphere-Demo-30fps', tag: 'landscape-30', at: [1.2, 9.2]},
];
const only = process.env.KIT_ONLY ? process.env.KIT_ONLY.split(',') : null;

const {executable} = await resolveBrowser();
const opts = {browserExecutable: executable, chromeMode: 'chrome-for-testing', chromiumOptions: {gl: 'swangle'}};
const serveUrl = await bundle({entryPoint: path.resolve('src/kit/demo/entry.tsx')});
for (const job of jobs) {
  if (only && !only.includes(job.tag)) continue;
  const comp = await selectComposition({serveUrl, id: job.id, ...opts});
  for (const sec of job.at) {
    const frame = Math.min(comp.durationInFrames - 1, Math.round(sec * comp.fps));
    const output = path.join(outDir, `atmosphere-${job.tag}-${sec.toFixed(1).replace(/\.0$/, '')}s.jpg`);
    const t0 = Date.now();
    await renderStill({composition: comp, serveUrl, output, frame, imageFormat: 'jpeg', jpegQuality: 90, ...opts, logLevel: 'error'});
    console.log('rendered', path.relative(process.cwd(), output), `${Date.now() - t0}ms`);
  }
}

// 4K crop: same frame as the first landscape still, rendered at scale 2 (3840x2160), then cropped 1840x1200
// around the card corner where hairlines (rim, grain, orb edges) are most visible. Python/PIL does the crop.
if (!only || only.includes('4k')) {
  const comp = await selectComposition({serveUrl, id: 'Kit-Atmosphere-Demo', ...opts});
  const frame = Math.min(comp.durationInFrames - 1, Math.round(1.2 * comp.fps));
  const tmp = '/tmp/atmosphere-4k-full.png';
  const t0 = Date.now();
  await renderStill({composition: comp, serveUrl, output: tmp, frame, scale: 2, imageFormat: 'png', ...opts, logLevel: 'error'});
  console.log('rendered 4K frame', `${Date.now() - t0}ms`, comp.width * 2 + 'x' + comp.height * 2);
  const {execFileSync} = await import('node:child_process');
  execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open('${tmp}')
# Crop around the glass card's top-left corner + a slice of the pill below: hairline rim, grain, orb falloff.
im.crop((880, 460, 2720, 1660)).save('${path.join(outDir, 'atmosphere-4k-crop.png').split(path.sep).join('/')}')
print('cropped to 1840x1200')
`]);
  console.log('rendered docs/previews/kit/atmosphere-4k-crop.png');
}
