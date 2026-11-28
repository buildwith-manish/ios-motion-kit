// Shared driver for the DOM-based checks (safe area, contrast): sample frames, capture, hand each to a visitor.
import {DEFAULT_OUT, ensureDir, fail, getBundle, launchPlaywright, openRemotionBrowser, parseProps, pickCompositions, progress, progressDone, resolveBrowser} from './kit_qa_common.mjs';
import {captureFrame, collectDom, openCompositionPage, serveDir} from './kit_qa_page.mjs';
import path from 'node:path';

export const SAMPLED_SPEC = {comp: 'string', all: 'flag', every: 'number', times: 'string', start: 'number', end: 'number', out: 'string', entry: 'string', 'serve-url': 'string', props: 'string', 'no-fail': 'flag', 'no-images': 'flag'};
export const SAMPLED_USAGE = `  --every <s>       sample interval (default 0.5)
  --times <s,s,..>  sample exactly these times instead
  --start <s> --end <s>
  --out <dir>  --entry <file>  --serve-url <dir>  --props <json>
  --no-images       skip the annotated PNG per composition
  --no-fail         exit 0 even when problems are found`;

export const runSampled = async ({args, qa, visit, finish}) => {
  const inputProps = parseProps(args.props);
  const every = args.every ?? 0.5;
  if (!(every > 0)) fail('--every must be > 0');
  const serveUrl = await getBundle({entry: args.entry, serveUrl: args['serve-url']});
  console.log(`browser: ${(await resolveBrowser()).source}`);
  const puppeteerInstance = await openRemotionBrowser();
  const comps = await pickCompositions({serveUrl, comp: args.comp, all: args.all, inputProps, puppeteerInstance});
  await puppeteerInstance.close({silent: true});
  const outDir = ensureDir(path.resolve(args.out ?? DEFAULT_OUT));
  const server = await serveDir(serveUrl);
  const browser = await launchPlaywright();
  const results = [];
  try {
    for (const comp of comps) {
      const duration = comp.durationInFrames / comp.fps;
      const samples = args.times
        ? args.times.split(',').map((v) => {
          const t = Number(v);
          if (!Number.isFinite(t) || t < 0 || t >= duration) fail(`${comp.id}: --times value "${v}" is outside 0..${duration}`);
          return {frame: Math.min(comp.durationInFrames - 1, Math.round(t * comp.fps)), time: Math.round(t * comp.fps) / comp.fps};
        })
        : qa.sampleTimes({duration, fps: comp.fps, every, start: args.start, end: args.end});
      if (!samples.length) fail(`${comp.id}: nothing to sample`);
      const view = await openCompositionPage({browser, url: server.url, composition: comp, inputProps});
      const state = {};
      let n = 0;
      for (const sample of samples) {
        await view.seek(sample.frame);
        const dom = await collectDom(view.page);
        const shot = await captureFrame(view.page, comp);
        await visit({comp, sample, dom, shot, state, page: view.page});
        progress(`${comp.id}: ${++n}/${samples.length}`);
      }
      await view.close();
      const result = await finish({comp, state, browser, outDir, samples});
      results.push(result);
      progressDone(`${comp.id}: ${samples.length} frames, ${result.findings.length} finding(s)`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return {results, outDir};
};
