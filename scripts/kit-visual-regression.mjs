import {renderStill, selectComposition} from '@remotion/renderer';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {CHROMIUM_OPTIONS, getBundle, resolveBrowser} from './kit_qa_common.mjs';

const cases = [
  {name: 'tokens-frame-90', entry: 'src/kit/demo/entry.tsx', composition: 'Kit-Tokens-Demo', frame: 90},
  {name: 'transitions-frame-234', entry: 'src/kit/demo/entry.tsx', composition: 'Kit-Transitions-Demo', frame: 234},
  {name: 'ui-frame-180', entry: 'src/kit/ui/entry.tsx', composition: 'Kit-Ui-Demo', frame: 180},
  {name: 'scenes-frame-300', entry: 'src/kit/scenes/entry.tsx', composition: 'Kit-Scenes-Demo', frame: 300},
];
const update = process.argv.includes('--update');
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== '--update' && arg !== '--help');
if (unknownArgs.length) throw new Error(`Unknown option(s): ${unknownArgs.join(', ')}`);
if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/kit-visual-regression.mjs [--update]');
  process.exit(0);
}

const baselineDir = path.resolve('tests/visual/baselines');
const resultDir = path.resolve('out/kit-visual');
const actualDir = path.join(resultDir, 'actual');
const diffDir = path.join(resultDir, 'diff');
mkdirSync(actualDir, {recursive: true});
mkdirSync(diffDir, {recursive: true});

const browser = await resolveBrowser();
console.log(`visual browser: ${browser.source}`);
const bundles = new Map();
let failures = 0;

for (const testCase of cases) {
  let serveUrl = bundles.get(testCase.entry);
  if (!serveUrl) {
    serveUrl = await getBundle({entry: testCase.entry});
    bundles.set(testCase.entry, serveUrl);
  }
  const browserOptions = {browserExecutable: browser.executable, chromeMode: 'chrome-for-testing', chromiumOptions: CHROMIUM_OPTIONS};
  const composition = await selectComposition({serveUrl, id: testCase.composition, ...browserOptions});
  if (testCase.frame >= composition.durationInFrames) {
    throw new RangeError(`${testCase.composition} does not contain fixed frame ${testCase.frame}`);
  }
  const actualPath = path.join(actualDir, `${testCase.name}.png`);
  const baselinePath = path.join(baselineDir, `${testCase.name}.png`);
  const diffPath = path.join(diffDir, `${testCase.name}.png`);
  await renderStill({
    composition,
    serveUrl,
    output: actualPath,
    frame: testCase.frame,
    imageFormat: 'png',
    scale: 0.5,
    ...browserOptions,
    logLevel: 'error',
  });
  const rendered = readFileSync(actualPath);

  if (update) {
    mkdirSync(baselineDir, {recursive: true});
    writeFileSync(baselinePath, rendered);
    console.log(`updated ${path.relative(process.cwd(), baselinePath)}`);
    continue;
  }
  if (!existsSync(baselinePath)) throw new Error(`Missing baseline ${path.relative(process.cwd(), baselinePath)}; run with --update`);

  const expected = PNG.sync.read(readFileSync(baselinePath));
  const actual = PNG.sync.read(rendered);
  if (expected.width !== actual.width || expected.height !== actual.height) {
    failures++;
    console.error(`${testCase.name}: dimension mismatch ${expected.width}x${expected.height} vs ${actual.width}x${actual.height}`);
    continue;
  }
  const diff = new PNG({width: actual.width, height: actual.height});
  const different = pixelmatch(expected.data, actual.data, diff.data, actual.width, actual.height, {threshold: 0.1, includeAA: false});
  const ratio = different / (actual.width * actual.height);
  if (ratio > 0.01) {
    failures++;
    writeFileSync(diffPath, PNG.sync.write(diff));
    console.error(`${testCase.name}: ${different} pixels differ (${(ratio * 100).toFixed(2)}%; allowed 1.00%). Diff: ${path.relative(process.cwd(), diffPath)}`);
  } else {
    console.log(`${testCase.name}: ${different} pixels differ (${(ratio * 100).toFixed(2)}%)`);
  }
}

if (failures) process.exitCode = 1;
