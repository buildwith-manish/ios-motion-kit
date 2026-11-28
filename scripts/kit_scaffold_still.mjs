// Renders one still of a scaffolded video repo (new-video.mjs output whose `kit/` points at this kit), with the kit's usual browser.
//   node scripts/kit_scaffold_still.mjs <scaffold-dir> <composition-id> [out.png] [--frame 60]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import {mkdirSync} from 'node:fs';
import {fail, remotionBrowserOptions} from './kit_qa_common.mjs';

const args = process.argv.slice(2);
const fi = args.indexOf('--frame');
const frame = fi >= 0 ? Number(args[fi + 1]) : 60;
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--frame');
const [dir, id, outArg] = pos;
if (!dir || !id) fail('usage: node scripts/kit_scaffold_still.mjs <scaffold-dir> <composition-id> [out.png] [--frame 60]');
const root = path.resolve(dir);
const output = path.resolve(outArg ?? path.join(root, 'out', 'still.png'));
mkdirSync(path.dirname(output), {recursive: true});
const browser = await remotionBrowserOptions();
const serveUrl = await bundle({
  entryPoint: path.join(root, 'src', 'index.ts'),
  rootDir: root,
  webpackOverride: (c) => ({...c, resolve: {...c.resolve, alias: {...(c.resolve?.alias ?? {}), 'ios-motion-kit': path.join(root, 'kit', 'src', 'kit')}}}), // same alias as the scaffold's remotion.config.ts
});
const composition = await selectComposition({serveUrl, id, ...browser});
await renderStill({composition, serveUrl, output, frame, imageFormat: 'png', ...browser});
console.log('rendered', output);
