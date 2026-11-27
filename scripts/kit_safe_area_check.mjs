// Safe-area check: flags visible text and elements outside the theme's title-safe area in sampled frames.
//   node scripts/kit_safe_area_check.mjs --comp Kit-Qa-Demo
// Exit code: 0 clean, 1 findings, 2 could not run.
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {fail, loadKit, parseArgs} from './kit_qa_common.mjs';
import {inkBox, saveAnnotated} from './kit_qa_page.mjs';
import {runSampled, SAMPLED_SPEC, SAMPLED_USAGE} from './kit_qa_sampled.mjs';

const usage = `usage: node scripts/kit_safe_area_check.mjs (--comp <id[,id]> | --all) [options]
  --kind title|action     which safe area (default title)
  --theme midnight|light|mono   used only when the composition has no theme prop (default midnight)
  --tolerance <px>        allowed overshoot (default 2)
  --min-opacity <0-1>     ignore things fainter than this (default 0.5)
${SAMPLED_USAGE}
Mark deliberate bleeds with data-qa-ignore; tag extra elements to check with data-qa-safe="name".`;
const args = parseArgs({...SAMPLED_SPEC, kind: 'string', theme: 'string', tolerance: 'number', 'min-opacity': 'number'}, usage);
const kind = args.kind ?? 'title';
if (!['title', 'action'].includes(kind)) fail('--kind must be title or action');
if (args.theme && !['midnight', 'light', 'mono'].includes(args.theme)) fail('--theme must be midnight, light or mono');
const tolerance = args.tolerance ?? 2;
const minOpacity = args['min-opacity'] ?? 0.5;
const qa = await loadKit();

const {results, outDir} = await runSampled({
  args, qa,
  visit({comp, sample, dom, shot, state}) {
    state.safe ??= qa.qaSafeRect(comp, comp.props?.theme, args.theme, kind);
    state.hits ??= [];
    const frameBoxes = [];
    const add = (type, path, label, box) => {
      const over = qa.safeOvershoot(box, state.safe.rect, comp, tolerance);
      if (!over) return;
      const worst = Math.max(over.left, over.top, over.right, over.bottom);
      state.hits.push({key: `${type}|${path}`, time: sample.time, severity: worst, data: {type, label, box, overshoot: over, worstPx: worst}});
      frameBoxes.push({...box, color: '#ff4d6d', label: `${label} +${Math.round(worst)}px`});
    };
    for (const t of dom.texts) {
      if (t.ignored || t.opacity < minOpacity) continue;
      for (const r of t.rects) {
        const ink = inkBox(shot, r, comp);
        if (ink) add('text', t.path, t.text.slice(0, 60), ink);
      }
    }
    for (const e of dom.elements) {
      if (!e.ignored && e.opacity >= minOpacity) add('element', e.path, e.label, e.box);
    }
    if (frameBoxes.length > (state.shown?.boxes.length ?? 0)) state.shown = {png: shot.png, boxes: frameBoxes, time: sample.time};
  },
  async finish({comp, state, browser, outDir, samples}) {
    const findings = qa.mergeHits(state.hits);
    let image = null;
    if (state.shown && !args['no-images']) {
      const {rect} = state.safe;
      image = path.join(outDir, `safe-area-${comp.id}.png`);
      await saveAnnotated(browser, {png: state.shown.png, width: comp.width, height: comp.height, file: image, boxes: [{left: rect.left, top: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height, color: '#35e0ff', dashed: true}, ...state.shown.boxes]});
    }
    return {id: comp.id, width: comp.width, height: comp.height, safeArea: {kind, ...state.safe}, sampledFrames: samples.length, findings, image: image && path.relative(process.cwd(), image)};
  },
});

const json = path.join(outDir, 'safe-area.json');
writeFileSync(json, JSON.stringify({generatedAt: new Date().toISOString(), settings: {kind, tolerance, minOpacity}, compositions: results}, null, 2));
const rows = results.flatMap((r) => (r.findings.length
  ? r.findings.map((f) => [r.id, f.worst.type, f.worst.label, ['left', 'top', 'right', 'bottom'].filter((s) => f.worst.overshoot[s] > tolerance).map((s) => `${s} ${Math.round(f.worst.overshoot[s])}px`).join(', '), `${qa.formatTimestamp(f.firstTime)}-${qa.formatTimestamp(f.lastTime)}`, String(f.samples)])
  : [[r.id, '-', 'all inside', '-', '-', '-']]));
console.log(`\nOutside the ${kind}-safe area\n${qa.formatTable(['composition', 'type', 'what', 'overshoot', 'seen', 'samples'], rows)}\n\nJSON: ${path.relative(process.cwd(), json)}`);
process.exit(!args['no-fail'] && results.some((r) => r.findings.length) ? 1 : 0);
