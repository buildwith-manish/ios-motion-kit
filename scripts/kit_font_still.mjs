// Fails when a demo frame is painted in a fallback font. Usage:
//   node scripts/kit_font_still.mjs [--comp Kit-Text-Demo,Kit-Tokens-Demo] [--entry src/kit/demo/entry.tsx] [--time 2] [--out out/fonts]
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {DEFAULT_ENTRY, ensureDir, getBundle, launchPlaywright, openRemotionBrowser, parseArgs, pickCompositions, fail} from './kit_qa_common.mjs';
import {collectFontState, openCompositionPage, serveDir} from './kit_qa_page.mjs';
import {fontProblems} from './kit_font_check.mjs';

const args = parseArgs({comp: 'string', entry: 'string', time: 'string', out: 'string', 'allow-family': 'string'}, 'node scripts/kit_font_still.mjs [--comp ids] [--entry file] [--time seconds] [--out dir]');
const out = ensureDir(args.out ?? 'out/fonts');
const serveUrl = await getBundle({entry: args.entry ?? DEFAULT_ENTRY});
const puppeteerInstance = await openRemotionBrowser();
const comps = await pickCompositions({serveUrl, comp: args.comp ?? 'Kit-Text-Demo,Kit-Tokens-Demo', puppeteerInstance});
const server = await serveDir(serveUrl);
const browser = await launchPlaywright();
const report = [];
let bad = 0;
try {
  for (const comp of comps) {
    const view = await openCompositionPage({browser, url: server.url, composition: comp});
    await view.seek(Math.min(comp.durationInFrames - 1, Math.round(Number(args.time ?? 2) * comp.fps)));
    const state = await collectFontState(view.page);
    const problems = fontProblems(state, {allowFamilies: args['allow-family'] ? args['allow-family'].split(',') : []});
    await view.page.screenshot({path: path.join(out, `${comp.id}.png`)});
    report.push({id: comp.id, faces: state.faces, used: state.used, problems});
    console.log(`${comp.id}: ${problems.length ? 'FALLBACK FONT' : 'ok'} (${state.faces.length} faces, ${state.used.length} font/weight pairs)`);
    for (const p of problems) console.log(`  - ${p}`);
    bad += problems.length;
    await view.close();
  }
} finally {
  await browser.close();
  await server.close();
}
writeFileSync(path.join(out, 'fonts-report.json'), JSON.stringify(report, null, 1));
if (bad) fail(`${bad} font problem(s); see ${out}/fonts-report.json`);
