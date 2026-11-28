/**
 * Review stills of every new map scene type (choropleth, regionHighlight, tileGrid, flyToCity) at 72 % of each scene,
 * in the landscape and the portrait demo video. Dev/CI only (needs a browser and baked map data).
 *   npx tsx scripts/map_scenes_stills.ts [--out=docs/previews/kit-map-scenes]
 * Continues past a failing still and exits 1 at the end, naming every failure with its error.
 */
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {layoutSceneSequence} from '../src/kit/scenes/sequence';
import {MAP_SCENES_DEMO_SCENES, MAP_SCENE_STILL_AT, MAP_SCENE_STILL_TYPES} from '../src/kit/scenes/mapScenesDemoData';

const out = path.resolve((process.argv.find((a) => a.startsWith('--out=')) ?? '--out=docs/previews/kit-map-scenes').slice(6));
mkdirSync(out, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/kit/demo/entry.tsx'), publicDir: path.resolve('public')});
const browser = await openBrowser('chrome', {browserExecutable: null});
const layout = layoutSceneSequence(MAP_SCENES_DEMO_SCENES);
const failures: string[] = [];
const timings: Record<string, number> = {};
for (const id of ['Kit-MapScenes-Demo', 'Kit-MapScenes-Demo-Vertical']) {
  const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser});
  for (const p of layout.placements.filter((x) => (MAP_SCENE_STILL_TYPES as readonly string[]).includes(x.scene.type))) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round((p.start + (p.end - p.start) * MAP_SCENE_STILL_AT) * composition.fps));
    const file = path.join(out, `${id}-${p.scene.type}.png`);
    const t0 = Date.now();
    try {
      await renderStill({composition, serveUrl, output: file, frame, puppeteerInstance: browser, logLevel: 'error'});
      timings[`${id}/${p.scene.type}`] = (Date.now() - t0) / 1000;
      console.log(`ok   ${id} ${p.scene.type} frame ${frame} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    } catch (e) {
      const msg = String((e as Error).message ?? e).split('\n').slice(0, 6).join(' | ');
      failures.push(`${id} ${p.scene.type} frame ${frame}: ${msg}`);
      console.log(`FAIL ${id} ${p.scene.type} frame ${frame}: ${msg}`);
    }
  }
}
await browser.close({silent: true});
writeFileSync(path.join(out, 'stills.json'), JSON.stringify({timings, failures}, null, 2));
if (failures.length) { console.log(`\n${failures.length} failure(s):\n${failures.join('\n')}`); process.exit(1); }
