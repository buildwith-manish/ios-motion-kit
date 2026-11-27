// Motion audit: low-res frames at 10 fps, frame-to-frame difference, report static stretches longer than 1.0 s.
//   node scripts/kit_motion_audit.mjs --comp Kit-Qa-Demo
// Exit code: 0 clean, 1 static stretches found, 2 could not run.
import {renderFrames} from '@remotion/renderer';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEFAULT_OUT, ensureDir, fail, getBundle, loadKit, openRemotionBrowser, parseArgs, parseProps, pickCompositions, progress, progressDone, remotionBrowserOptions, resolveBrowser} from './kit_qa_common.mjs';

const usage = `usage: node scripts/kit_motion_audit.mjs (--comp <id[,id]> | --all) [options]
  --fps <n>           sampling rate (default 10)
  --scale <n>         render scale (default 0.25)
  --min-static <s>    report stretches longer than this (default 1.0)
  --mean <0-255>      static if mean difference <= this (default 0.15) ...
  --changed <0-1>     ... AND changed-pixel fraction <= this (default 0.001)
  --start <s> --end <s>
  --concurrency <n>
  --out <dir>  --entry <file>  --serve-url <dir>  --props <json>
  --no-fail           exit 0 even when stretches are found
  --dump-pairs        include every sample pair in the JSON`;
const args = parseArgs({comp: 'string', all: 'flag', fps: 'number', scale: 'number', 'min-static': 'number', mean: 'number', changed: 'number', start: 'number', end: 'number', concurrency: 'number', out: 'string', entry: 'string', 'serve-url': 'string', props: 'string', 'no-fail': 'flag', 'dump-pairs': 'flag'}, usage);

const qa = await loadKit();
const targetFps = args.fps ?? 10;
const scale = args.scale ?? 0.25;
const minSeconds = args['min-static'] ?? 1;
const thresholds = {mean: args.mean ?? qa.STATIC_THRESHOLDS.mean, changed: args.changed ?? qa.STATIC_THRESHOLDS.changed};
if (!(targetFps > 0) || !(scale > 0)) fail('--fps and --scale must be > 0');

/** Decodes numbered PNGs to rgb24 with ffmpeg and hands over one frame at a time (constant memory). */
const decodeFrames = (dir, size, onFrame) => new Promise((resolve, reject) => {
  const ff = spawn('ffmpeg', ['-v', 'error', '-framerate', '1', '-start_number', '0', '-i', path.join(dir, '%06d.png'), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {stdio: ['ignore', 'pipe', 'pipe']});
  let buffer = Buffer.alloc(0);
  let err = '';
  ff.on('error', (e) => reject(new Error(`ffmpeg could not start: ${e.message}`)));
  ff.stderr.on('data', (d) => { err += d; });
  ff.stdout.on('data', (d) => {
    buffer = Buffer.concat([buffer, d]);
    while (buffer.length >= size) {
      onFrame(Uint8Array.prototype.slice.call(buffer, 0, size));
      buffer = buffer.subarray(size);
    }
  });
  ff.on('close', (code) => (code === 0 && buffer.length === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}) ${err || 'partial frame'}`))));
});

const pngSize = (b) => ({width: b.readUInt32BE(16), height: b.readUInt32BE(20)});

const inputProps = parseProps(args.props);
const serveUrl = await getBundle({entry: args.entry, serveUrl: args['serve-url']});
console.log(`browser: ${(await resolveBrowser()).source}`);
const puppeteerInstance = await openRemotionBrowser();
const results = [];
try {
  const comps = await pickCompositions({serveUrl, comp: args.comp, all: args.all, inputProps, puppeteerInstance});
  for (const comp of comps) {
    const everyNthFrame = Math.max(1, Math.round(comp.fps / targetFps));
    const first = Math.max(0, Math.round((args.start ?? 0) * comp.fps));
    const last = Math.min(comp.durationInFrames - 1, args.end === undefined ? Infinity : Math.round(args.end * comp.fps));
    if (last - first < everyNthFrame) fail(`${comp.id}: range too short to compare two frames`);
    const buffers = new Map();
    const tmp = mkdtempSync(path.join(tmpdir(), 'kit-motion-'));
    const frames = [];
    for (let f = first; f <= last; f += everyNthFrame) frames.push(f);
    const index = new Map(frames.map((f, i) => [f, i]));
    let dims = null;
    const started = Date.now();
    try {
      await renderFrames({
        composition: comp, serveUrl, inputProps, puppeteerInstance, outputDir: null, imageFormat: 'png', muted: true,
        frameRange: [first, last], everyNthFrame, scale, concurrency: args.concurrency ?? null,
        onStart: () => undefined,
        onFrameUpdate: (n) => progress(`${comp.id}: rendering ${n}/${frames.length}`),
        onFrameBuffer: (buf, frame) => {
          if (!index.has(frame)) throw new Error(`unexpected frame ${frame}`);
          dims ??= pngSize(buf);
          writeFileSync(path.join(tmp, `${String(index.get(frame)).padStart(6, '0')}.png`), buf);
          buffers.set(frame, true);
        },
        ...(await remotionBrowserOptions()),
      });
      if (buffers.size !== frames.length) fail(`${comp.id}: rendered ${buffers.size} of ${frames.length} sample frames`);
      const pairs = [];
      let prev = null;
      let i = 0;
      await decodeFrames(tmp, dims.width * dims.height * 3, (raw) => {
        if (prev) pairs.push({from: frames[i - 1] / comp.fps, to: frames[i] / comp.fps, ...qa.diffFrames(prev, raw)});
        prev = raw;
        i++;
      });
      if (i !== frames.length) fail(`${comp.id}: decoded ${i} of ${frames.length} frames`);
      const stretches = qa.findStaticStretches(pairs, {minSeconds, thresholds});
      const staticSeconds = stretches.reduce((s, x) => s + x.duration, 0);
      results.push({id: comp.id, fps: comp.fps, width: comp.width, height: comp.height, sampleFps: comp.fps / everyNthFrame, sampledFrom: first / comp.fps, sampledTo: frames.at(-1) / comp.fps, samples: frames.length, staticSeconds, stretches, wallSeconds: (Date.now() - started) / 1000, ...(args['dump-pairs'] ? {pairs} : {})});
      progressDone(`${comp.id}: ${frames.length} samples, ${stretches.length} static stretch(es)`);
    } finally {
      rmSync(tmp, {recursive: true, force: true});
    }
  }
} finally {
  await puppeteerInstance.close({silent: true});
}

const outDir = ensureDir(path.resolve(args.out ?? DEFAULT_OUT));
const jsonPath = path.join(outDir, 'motion-audit.json');
writeFileSync(jsonPath, JSON.stringify({generatedAt: new Date().toISOString(), settings: {targetFps, scale, minSeconds, thresholds}, compositions: results}, null, 2));
const rows = results.flatMap((r) => (r.stretches.length
  ? r.stretches.map((s) => [r.id, qa.formatTimestamp(s.start), qa.formatTimestamp(s.end), `${s.duration.toFixed(2)} s`, s.peakMean.toFixed(3), `${(s.peakChanged * 100).toFixed(3)} %`])
  : [[r.id, '-', '-', 'none', '-', '-']]));
console.log(`\nStatic stretches longer than ${minSeconds} s\n${qa.formatTable(['composition', 'from', 'to', 'length', 'peak mean', 'peak changed'], rows)}\n\nJSON: ${path.relative(process.cwd(), jsonPath)}`);
process.exit(!args['no-fail'] && results.some((r) => r.stretches.length) ? 1 : 0);
