// Contact sheet: one still every N seconds, assembled into a labelled PNG.
//   node scripts/kit_contact_sheet.mjs --comp Kit-Text-Demo --every 1
import {renderStill} from '@remotion/renderer';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEFAULT_OUT, ensureDir, fail, getBundle, launchPlaywright, loadKit, openRemotionBrowser, parseArgs, parseProps, pickCompositions, progress, progressDone, remotionBrowserOptions, resolveBrowser} from './kit_qa_common.mjs';

const usage = `usage: node scripts/kit_contact_sheet.mjs (--comp <id[,id]> | --all) [options]
  --every <s>       seconds between stills (default 1)
  --start <s>  --end <s>
  --include-last    also add the final frame
  --cols <n>        columns (default 4 for landscape, 6 for portrait)
  --thumb <px>      width of each thumbnail (default 480 landscape, 270 portrait)
  --out <dir>       output folder (default ${DEFAULT_OUT})
  --entry <file>    Remotion entry (default src/kit/demo/entry.tsx)
  --serve-url <dir> reuse a bundle
  --props <json>    input props`;
const args = parseArgs({comp: 'string', all: 'flag', every: 'number', start: 'number', end: 'number', 'include-last': 'flag', cols: 'number', thumb: 'number', out: 'string', entry: 'string', 'serve-url': 'string', props: 'string'}, usage);
const every = args.every ?? 1;
if (!(every > 0)) fail('--every must be > 0');

const qa = await loadKit();
const inputProps = parseProps(args.props);
const serveUrl = await getBundle({entry: args.entry, serveUrl: args['serve-url']});
console.log(`browser: ${(await resolveBrowser()).source}`);
const puppeteerInstance = await openRemotionBrowser();
const sheetBrowser = await launchPlaywright();
const outDir = ensureDir(path.resolve(args.out ?? DEFAULT_OUT));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

try {
  const comps = await pickCompositions({serveUrl, comp: args.comp, all: args.all, inputProps, puppeteerInstance});
  for (const comp of comps) {
    const duration = comp.durationInFrames / comp.fps;
    const samples = qa.sampleTimes({duration, fps: comp.fps, every, start: args.start, end: args.end, includeLast: args['include-last']});
    if (!samples.length) fail(`${comp.id}: nothing to sample between --start and --end`);
    const portrait = comp.height > comp.width;
    const cols = Math.min(samples.length, args.cols ?? (portrait ? 6 : 4));
    const thumbW = args.thumb ?? (portrait ? 270 : 480);
    const thumbH = Math.round((thumbW * comp.height) / comp.width);
    const tmp = mkdtempSync(path.join(tmpdir(), 'kit-sheet-'));
    const cells = [];
    try {
      for (const s of samples) {
        const file = path.join(tmp, `${s.frame}.jpg`);
        // Render at about 1.5x the thumbnail size: enough to downscale cleanly without paying for full resolution.
        await renderStill({composition: comp, serveUrl, output: file, frame: s.frame, inputProps, puppeteerInstance, imageFormat: 'jpeg', jpegQuality: 90, scale: Math.min(1, (thumbW * 1.5) / comp.width), ...(await remotionBrowserOptions())});
        cells.push(`<figure><img src="data:image/jpeg;base64,${readFileSync(file).toString('base64')}"><figcaption>${qa.formatTimestamp(s.time)} <span>${s.time.toFixed(2)} s · f${s.frame}</span></figcaption></figure>`);
        progress(`${comp.id}: ${cells.length}/${samples.length}`);
      }
    } finally {
      rmSync(tmp, {recursive: true, force: true});
    }
    const gap = 16;
    const width = cols * thumbW + (cols + 1) * gap;
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;width:${width}px;background:#111214;color:#f2f2f3;font:15px/1.4 system-ui,sans-serif}
      h1{font-size:18px;margin:0;padding:${gap}px ${gap}px 0}
      main{display:grid;grid-template-columns:repeat(${cols},${thumbW}px);gap:${gap}px;padding:${gap}px}
      figure{margin:0} img{display:block;width:${thumbW}px;height:${thumbH}px;outline:1px solid #3a3a3f}
      figcaption{padding-top:5px;font-variant-numeric:tabular-nums;white-space:nowrap} figcaption span{color:#9a9aa0;font-size:13px}
    </style><h1>${esc(comp.id)} · ${comp.width}×${comp.height} @ ${comp.fps} fps · every ${every} s</h1><main>${cells.join('')}</main>`;
    const page = await sheetBrowser.newPage({viewport: {width, height: 200}});
    await page.setContent(html, {waitUntil: 'load'});
    const output = path.join(outDir, `contact-${comp.id}.png`);
    await page.screenshot({path: output, fullPage: true});
    await page.close();
    progressDone(`${comp.id}: ${cells.length} stills -> ${path.relative(process.cwd(), output)}`);
  }
} finally {
  await sheetBrowser.close();
  await puppeteerInstance.close({silent: true});
}
