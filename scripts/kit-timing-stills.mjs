// Render two representative timing-demo frames: the full narration and the number roll.
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import {mkdirSync} from 'node:fs';

const outputDirectory = path.resolve('docs/previews/kit');
mkdirSync(outputDirectory, {recursive: true});
const browserExecutable = process.env.KIT_CHROME || null;
const serveUrl = await bundle({entryPoint: path.resolve('src/kit/demo/entry.tsx')});
const options = {browserExecutable, chromeMode: 'chrome-for-testing', chromiumOptions: {gl: 'swangle'}};
const composition = await selectComposition({serveUrl, id: 'Kit-Timing-Demo', ...options});

for (const still of [
  {time: 10.4, scale: 1, name: 'timing-landscape-1080p.jpg'},
  {time: 5.5, scale: 2, name: 'timing-landscape-4k.jpg'},
]) {
  const output = path.join(outputDirectory, still.name);
  const frame = Math.min(composition.durationInFrames - 1, Math.round(still.time * composition.fps));
  await renderStill({
    composition,
    serveUrl,
    output,
    frame,
    scale: still.scale,
    imageFormat: 'jpeg',
    jpegQuality: 90,
    ...options,
    logLevel: 'error',
  });
  console.log(`rendered ${path.relative(process.cwd(), output)} at ${still.time}s`);
}
