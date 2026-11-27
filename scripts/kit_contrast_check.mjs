// Contrast check: WCAG ratio of every visible text run against the background actually rendered behind it.
//   node scripts/kit_contrast_check.mjs --comp Kit-Qa-Demo
// Exit code: 0 clean, 1 failures, 2 could not run.
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {fail, loadKit, parseArgs} from './kit_qa_common.mjs';
import {glyphPixels, inkBox, saveAnnotated} from './kit_qa_page.mjs';
import {runSampled, SAMPLED_SPEC, SAMPLED_USAGE} from './kit_qa_sampled.mjs';

const usage = `usage: node scripts/kit_contrast_check.mjs (--comp <id[,id]> | --all) [options]
  --min <ratio>           required contrast (default 4.5)
  --min-opacity <0-1>     skip text fainter than this, i.e. fading in or out (default 0.35)
  --max-blur <px>         skip text blurred more than this, i.e. mid-reveal (default 0.5)
  --min-visible <0-1>     skip text with less than this share of its box unclipped (default 0.6)
  --min-samples <n>       must stay low, same words and roughly the same place, for this many consecutive samples
                          to fail; otherwise "transient": reported, not failing (default 2)
${SAMPLED_USAGE}
Mark decorative text with data-qa-ignore. WCAG allows 3:1 for large text; such rows are marked "large".`;
const args = parseArgs({...SAMPLED_SPEC, min: 'number', 'min-opacity': 'number', 'max-blur': 'number', 'min-samples': 'number', 'min-visible': 'number'}, usage);
const required = args.min ?? 4.5;
const minOpacity = args['min-opacity'] ?? 0.35;
const maxBlur = args['max-blur'] ?? 0.5;
const minSamples = args['min-samples'] ?? 2;
const minVisible = args['min-visible'] ?? 0.6;
if (!(required >= 1 && required <= 21)) fail('--min must be between 1 and 21');
const qa = await loadKit();

const {results, outDir} = await runSampled({
  args, qa,
  visit({comp, sample, dom, shot, state}) {
    state.hits ??= [];
    state.measured ??= new Set();
    state.sightings ??= new Map();
    state.index = (state.index ?? -1) + 1;
    state.skipped ??= {faint: 0, blurred: 0, clipped: 0, notPainted: 0};
    const frameBoxes = [];
    for (const t of dom.texts) {
      if (t.ignored) continue;
      if (t.opacity < minOpacity) { state.skipped.faint++; continue; }
      if (t.blur > maxBlur) { state.skipped.blurred++; continue; }
      // Slivers of a mostly clipped line (the neighbouring digits in an odometer column) are not there to be read.
      if (t.visibleFraction < minVisible) { state.skipped.clipped++; continue; }
      const m = qa.measureTextContrast(glyphPixels(shot, t.rects, comp), t.gradient ? null : t.color, t.opacity);
      if (!m || m.pixels < 6) { state.skipped.notPainted++; continue; }
      state.measured.add(t.path);
      if (m.ratio >= required) continue;
      // CSS large text: 24px, or 18.66px bold.
      const large = t.fontSize >= 24 || (t.fontSize >= 18.66 && t.fontWeight >= 700);
      if (!state.sightings.has(t.path)) state.sightings.set(t.path, []);
      state.sightings.get(t.path).push({index: state.index, text: t.text, x: t.rects[0].left, y: t.rects[0].top, fontSize: t.fontSize});
      state.hits.push({key: t.path, time: sample.time, severity: required - m.ratio, data: {text: t.text.slice(0, 60), fontSize: Math.round(t.fontSize), large, opacity: Number(t.opacity.toFixed(2)), ...m, foreground: qa.toHex(m.foreground), background: qa.toHex(m.background)}});
      for (const r of t.rects) {
        const ink = inkBox(shot, r, comp);
        if (ink) frameBoxes.push({...ink, color: '#ffb020', label: `${m.ratio.toFixed(2)}:1`});
      }
    }
    if (frameBoxes.length > (state.shown?.boxes.length ?? 0)) state.shown = {png: shot.png, boxes: frameBoxes};
  },
  async finish({comp, state, browser, outDir, samples}) {
    const needed = Math.min(minSamples, samples.length);
    const findings = qa.mergeHits(state.hits).map((f) => {
      const stableSamples = qa.longestStableRun(state.sightings.get(f.key));
      return {...f, stableSamples, status: stableSamples >= needed ? 'fail' : 'transient'};
    });
    let image = null;
    if (state.shown && !args['no-images']) {
      image = path.join(outDir, `contrast-${comp.id}.png`);
      await saveAnnotated(browser, {png: state.shown.png, width: comp.width, height: comp.height, file: image, boxes: state.shown.boxes});
    }
    return {id: comp.id, width: comp.width, height: comp.height, sampledFrames: samples.length, textRunsMeasured: state.measured.size, skippedObservations: state.skipped, findings, image: image && path.relative(process.cwd(), image)};
  },
});

const json = path.join(outDir, 'contrast.json');
writeFileSync(json, JSON.stringify({generatedAt: new Date().toISOString(), settings: {required, minOpacity, maxBlur, minVisible, minSamples}, compositions: results}, null, 2));
const rows = results.flatMap((r) => (r.findings.length
  ? r.findings.map((f) => [r.id, f.status, f.worst.text.slice(0, 40), `${f.worst.ratio.toFixed(2)}:1`, `${f.worst.foreground} on ${f.worst.background}`, `${f.worst.fontSize}px${f.worst.large ? ' large' : ''}`, `${qa.formatTimestamp(f.firstTime)}-${qa.formatTimestamp(f.lastTime)}`, String(f.samples)])
  : [[r.id, 'pass', `${r.textRunsMeasured} text run(s) checked`, '-', '-', '-', '-', '-']]));
console.log(`\nText below ${required}:1 (10th-percentile pixel)\n${qa.formatTable(['composition', 'status', 'text', 'ratio', 'text on background', 'size', 'seen', 'samples'], rows)}\n\nJSON: ${path.relative(process.cwd(), json)}`);
// A composition where nothing could be measured has not passed anything.
for (const r of results) if (!r.textRunsMeasured) console.warn(`warning: ${r.id}: no text was measured`);
process.exit(!args['no-fail'] && results.some((r) => r.findings.some((f) => f.status === 'fail')) ? 1 : 0);
