// Loudness check (analysis only, nothing is rewritten): ffmpeg loudnorm against -14 LUFS for YouTube.
//   node scripts/kit_loudness.mjs out/video.mp4
//   node scripts/kit_loudness.mjs --comp Kit-Audio-Demo        (renders the composition's mix to WAV first)
// Exit code: 0 on target, 1 off target, 2 could not run.
import {renderMedia} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import {existsSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {DEFAULT_OUT, ensureDir, fail, getBundle, loadKit, openRemotionBrowser, parseArgs, parseProps, pickCompositions, remotionBrowserOptions} from './kit_qa_common.mjs';

const usage = `usage: node scripts/kit_loudness.mjs <media files...> | --comp <id[,id]> [options]
  --target <LUFS>       integrated target (default -14)
  --tolerance <LU>      default 1
  --true-peak <dBTP>    ceiling (default -1)
  --out <dir>  --entry <file>  --serve-url <dir>  --props <json>
  --no-fail`;
const args = parseArgs({comp: 'string', target: 'number', tolerance: 'number', 'true-peak': 'number', out: 'string', entry: 'string', 'serve-url': 'string', props: 'string', 'no-fail': 'flag'}, usage);
if (!args._.length && !args.comp) fail(usage);
const qa = await loadKit();
const target = {integrated: args.target ?? qa.YOUTUBE_LOUDNESS.integrated, tolerance: args.tolerance ?? qa.YOUTUBE_LOUDNESS.tolerance, truePeak: args['true-peak'] ?? qa.YOUTUBE_LOUDNESS.truePeak};
const outDir = ensureDir(path.resolve(args.out ?? DEFAULT_OUT));
const inputs = args._.map((file) => (existsSync(file) ? {name: file, file} : fail(`no such file: ${file}`)));

if (args.comp) {
  const inputProps = parseProps(args.props);
  const serveUrl = await getBundle({entry: args.entry, serveUrl: args['serve-url']});
  const puppeteerInstance = await openRemotionBrowser();
  try {
    for (const composition of await pickCompositions({serveUrl, comp: args.comp, inputProps, puppeteerInstance})) {
      const file = path.join(outDir, `${composition.id}-mix.wav`);
      console.log(`rendering the mix of ${composition.id} ...`);
      await renderMedia({composition, serveUrl, inputProps, puppeteerInstance, codec: 'wav', outputLocation: file, overwrite: true, ...(await remotionBrowserOptions())});
      inputs.push({name: composition.id, file});
    }
  } finally {
    await puppeteerInstance.close({silent: true});
  }
}

const results = inputs.map(({name, file}) => {
  // path.resolve keeps a file name that starts with "-" from being read as an ffmpeg option.
  const run = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path.resolve(file), '-map', '0:a:0', '-af', `loudnorm=I=${target.integrated}:TP=${target.truePeak}:LRA=11:print_format=json`, '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  if (run.status !== 0) fail(`${name}: ffmpeg failed (is there an audio stream?)\n${run.error?.message ?? run.stderr.split('\n').slice(-6).join('\n')}`);
  const measure = qa.parseLoudnorm(run.stderr);
  return {name, file: path.relative(process.cwd(), path.resolve(file)), measure, ...qa.judgeLoudness(measure, target)};
});

const n = (v) => (v === null ? '-' : Number.isFinite(v) ? v.toFixed(1) : v < 0 ? '-inf' : 'inf');
const json = path.join(outDir, 'loudness.json');
// JSON has no Infinity: silence is written as the string "-inf".
writeFileSync(json, JSON.stringify({generatedAt: new Date().toISOString(), target, results}, (_k, v) => (v === -Infinity ? '-inf' : v === Infinity ? 'inf' : v), 2));
console.log(`\nLoudness (target ${target.integrated} LUFS +/- ${target.tolerance}, true peak <= ${target.truePeak} dBTP)\n${qa.formatTable(['input', 'LUFS', 'true peak', 'LRA', 'gain needed', 'peak after gain', 'result'], results.map((r) => [r.name, n(r.measure.integrated), n(r.measure.truePeak), n(r.measure.range), n(r.gainDb), n(r.truePeakAfterGain), r.ok ? 'OK' : r.problems.join('; ')]))}\n\nJSON: ${path.relative(process.cwd(), json)}`);
process.exit(!args['no-fail'] && results.some((r) => !r.ok) ? 1 : 0);
