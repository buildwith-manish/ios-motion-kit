// Render with a profile and record how long it took.
//   node scripts/kit_render.mjs --profile draft --comp Kit-Text-Demo
import {renderFrames, renderMedia} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {cpus, tmpdir} from 'node:os';
import path from 'node:path';
import {DEFAULT_OUT, ensureDir, fail, getBundle, loadKit, openRemotionBrowser, parseArgs, parseProps, pickCompositions, progress, progressDone, remotionBrowserOptions, resolveBrowser} from './kit_qa_common.mjs';

const usage = `usage: node scripts/kit_render.mjs --profile <draft|review|final> (--comp <id[,id]> | --all) [options]
  --start <s> --end <s>   render only this range (useful for timing a long video)
  --scale <n>             override the profile's scale (2 = 4K from a 1080p composition)
  --concurrency <n>
  --out <dir>             videos and timing-report.json (default ${DEFAULT_OUT})
  --entry <file>  --serve-url <dir>  --props <json>`;
const args = parseArgs({profile: 'string', comp: 'string', all: 'flag', start: 'number', end: 'number', scale: 'number', concurrency: 'number', out: 'string', entry: 'string', 'serve-url': 'string', props: 'string'}, usage);

const qa = await loadKit();
if (!Object.hasOwn(qa.RENDER_PROFILES, args.profile ?? '')) fail(`--profile must be one of: ${Object.keys(qa.RENDER_PROFILES).join(', ')}`);
const profile = {...qa.RENDER_PROFILES[args.profile], ...(args.scale ? {scale: args.scale} : {})};
const inputProps = {...parseProps(args.props), kitRender: {profile: args.profile, motionBlurSamples: profile.motionBlurSamples}};
const serveUrl = await getBundle({entry: args.entry, serveUrl: args['serve-url']});
const browserInfo = await resolveBrowser();
console.log(`browser: ${browserInfo.source}`);
const outDir = ensureDir(path.resolve(args.out ?? DEFAULT_OUT));
const puppeteerInstance = await openRemotionBrowser();
const runs = [];

const ffmpeg = (argv) => {
  const run = spawnSync('ffmpeg', ['-v', 'error', '-y', ...argv], {encoding: 'utf8'});
  if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.error?.message ?? run.stderr}`);
};

try {
  const comps = await pickCompositions({serveUrl, comp: args.comp, all: args.all, inputProps, puppeteerInstance});
  for (const comp of comps) {
    let plan;
    try { plan = qa.planRender(profile, comp, {start: args.start, end: args.end}); } catch (e) { fail(`${comp.id}: ${e.message}`); }
    const output = path.join(outDir, `${comp.id}-${args.profile}.mp4`);
    const common = {composition: comp, serveUrl, inputProps, puppeteerInstance, concurrency: args.concurrency ?? null, ...(await remotionBrowserOptions())};
    const frameRange = [plan.firstFrame, plan.lastFrame];
    const started = Date.now();
    let framesSeconds = null;
    // Both paths end in the same mux: ffmpeg encodes the AAC from a lossless mix. (Remotion 4.0.250's own MP4 plays
    // its AAC 2048 samples, 42.7 ms at 48 kHz, late: the encoder delay is not compensated.)
    const mux = (inputs, videoArgs, audio) => ffmpeg([...inputs, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', ...videoArgs,
      '-c:a', 'aac', '-b:a', profile.audioBitrate, '-t', String(plan.frames / plan.outputFps), '-movflags', '+faststart', output]);
    if (plan.everyNthFrame === 1) {
      const tmp = mkdtempSync(path.join(tmpdir(), 'kit-render-'));
      try {
        const video = path.join(tmp, 'video.mp4');
        const wav = path.join(tmp, 'audio.wav');
        await renderMedia({...common, frameRange, codec: 'h264', outputLocation: video, separateAudioTo: wav, audioCodec: 'pcm-16', enforceAudioTrack: true, scale: profile.scale, crf: profile.crf, x264Preset: profile.x264Preset, imageFormat: profile.imageFormat,
          ...(profile.imageFormat === 'jpeg' ? {jpegQuality: profile.jpegQuality} : {}), pixelFormat: 'yuv420p', colorSpace: 'bt709', overwrite: true,
          onProgress: ({renderedFrames, stitchStage}) => progress(`${comp.id}: ${renderedFrames}/${plan.frames} ${stitchStage}   `)});
        mux(['-i', video], ['-c:v', 'copy'], wav);
      } finally {
        rmSync(tmp, {recursive: true, force: true});
      }
    } else {
      // renderMedia cannot drop frames for H.264, so: every Nth frame to disk, audio on its own, then one x264 pass.
      const tmp = mkdtempSync(path.join(tmpdir(), 'kit-render-'));
      try {
        const ext = profile.imageFormat === 'jpeg' ? 'jpg' : 'png';
        const expected = [];
        for (let f = plan.firstFrame; f <= plan.lastFrame; f += plan.everyNthFrame) expected.push(f);
        const index = new Map(expected.map((f, i) => [f, i]));
        let written = 0;
        await renderFrames({...common, frameRange, everyNthFrame: plan.everyNthFrame, outputDir: null, scale: profile.scale, imageFormat: profile.imageFormat,
          ...(profile.imageFormat === 'jpeg' ? {jpegQuality: profile.jpegQuality} : {}), muted: true,
          onStart: () => undefined, onFrameUpdate: (n) => progress(`${comp.id}: ${n}/${plan.frames} frames   `),
          onFrameBuffer: (buf, frame) => { writeFileSync(path.join(tmp, `${String(index.get(frame)).padStart(6, '0')}.${ext}`), buf); written++; }});
        if (written !== plan.frames) throw new Error(`${comp.id}: rendered ${written} of ${plan.frames} frames`);
        framesSeconds = (Date.now() - started) / 1000;
        const wav = path.join(tmp, 'audio.wav');
        await renderMedia({...common, frameRange, codec: 'wav', outputLocation: wav, overwrite: true});
        mux(['-framerate', String(plan.outputFps), '-i', path.join(tmp, `%06d.${ext}`)], ['-vf', `scale=in_range=${ext === 'jpg' ? 'full' : 'auto'}:out_range=tv:out_color_matrix=bt709,format=yuv420p`,
          '-c:v', 'libx264', '-crf', String(profile.crf), '-preset', profile.x264Preset, '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'], wav);
      } finally {
        rmSync(tmp, {recursive: true, force: true});
      }
    }
    const seconds = (Date.now() - started) / 1000;
    runs.push({composition: comp.id, profile: args.profile, width: plan.width, height: plan.height, outputFps: plan.outputFps, frames: plan.frames, range: [plan.firstFrame, plan.lastFrame], totalSeconds: Number(seconds.toFixed(2)), secondsPerFrame: Number((seconds / plan.frames).toFixed(4)), frameStageSeconds: framesSeconds && Number(framesSeconds.toFixed(2)), megabytes: Number((statSync(output).size / 1e6).toFixed(2)), concurrency: args.concurrency ?? 'auto', cpus: cpus().length, browser: browserInfo.source, output: path.relative(process.cwd(), output), at: new Date().toISOString()});
    progressDone(`${comp.id}: ${plan.frames} frames in ${seconds.toFixed(1)} s -> ${path.relative(process.cwd(), output)}`);
  }
} finally {
  await puppeteerInstance.close({silent: true});
}

// The report keeps the latest run per composition + profile, so profiles can be compared side by side.
const reportPath = path.join(outDir, 'timing-report.json');
const previous = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')).runs ?? [] : [];
const merged = [...previous.filter((p) => !runs.some((r) => r.composition === p.composition && r.profile === p.profile)), ...runs].sort((a, b) => a.composition.localeCompare(b.composition) || a.profile.localeCompare(b.profile));
writeFileSync(reportPath, JSON.stringify({note: 'secondsPerFrame is wall time (frames + audio + encode, bundling excluded) divided by output frames, on this machine.', runs: merged}, null, 2));
console.log(`\nTiming\n${qa.formatTable(['composition', 'profile', 'size', 'fps', 'frames', 'total s', 's/frame', 'MB'], merged.map((r) => [r.composition, r.profile, `${r.width}x${r.height}`, String(r.outputFps), String(r.frames), r.totalSeconds.toFixed(1), r.secondsPerFrame.toFixed(3), r.megabytes.toFixed(2)]))}\n\nJSON: ${path.relative(process.cwd(), reportPath)}`);
