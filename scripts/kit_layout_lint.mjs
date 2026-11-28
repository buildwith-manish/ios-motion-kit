// Layout lint: the design rules (min text 28 px, labels >= 36, hero 120-200, hero zone >= 60%, max 3 secondary,
// nothing in the rail/footer strips, no overlaps, chips one at a time) on sampled frames.
//   node scripts/kit_layout_lint.mjs --comp Kit-Scenes-Demo [--config my.json] [--times 2,7] [--no-fail]
// Tag scene elements: data-qa-role="hero|label|support|secondary|chip|rail|footer". Untagged text is only checked against the floor.
// Exit code: 0 clean, 1 findings, 2 could not run.
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fail, loadKit, parseArgs} from './kit_qa_common.mjs';
import {runSampled, SAMPLED_SPEC, SAMPLED_USAGE} from './kit_qa_sampled.mjs';
import {checkConfig, lintFrame} from './kit_layout_lint_rules.mjs';

const usage = `usage: node scripts/kit_layout_lint.mjs (--comp <id[,id]> | --all) [options]\n  --config <file>   JSON overriding the thresholds (defaults: scripts/kit_layout_lint.config.json)\n${SAMPLED_USAGE}`;
const args = parseArgs({...SAMPLED_SPEC, config: 'string'}, usage);
const here = path.dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(path.join(here, 'kit_layout_lint.config.json'), 'utf8'));
let user = {};
if (args.config) { try { user = JSON.parse(readFileSync(args.config, 'utf8')); } catch (e) { fail(`cannot read --config: ${e.message}`); } }
const merge = (a, b) => Object.fromEntries(Object.keys({...a, ...b}).map((k) => [k, a[k] && b[k] && typeof a[k] === 'object' && typeof b[k] === 'object' ? merge(a[k], b[k]) : b[k] ?? a[k]]));
const cfg = merge(base, user);
const qa = await loadKit();

const roles = (page) => page.evaluate(() => {
  const domPath = (el) => { const p = []; for (let n = el; n && n !== document.body; n = n.parentElement) p.push(`${n.localName}:${n.parentElement ? [...n.parentElement.children].indexOf(n) : 0}`); return p.reverse().join('/'); };
  const size = (el) => { const cs = getComputedStyle(el); let s = parseFloat(cs.fontSize) || 0; if (el.offsetHeight > 0) s *= el.getBoundingClientRect().height / el.offsetHeight || 1; return s; };
  return [...document.querySelectorAll('[data-qa-role]')].filter((el) => getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden').map((el) => {
    let opacity = 1; let ignored = false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) { opacity *= Number(getComputedStyle(n).opacity); if (n.hasAttribute('data-qa-ignore')) ignored = true; }
    const r = el.getBoundingClientRect();
    return {role: el.getAttribute('data-qa-role'), path: domPath(el), label: (el.textContent || '').trim().slice(0, 30) || el.getAttribute('data-qa-role'), box: {left: r.left, top: r.top, right: r.right, bottom: r.bottom}, size: size(el), opacity, ignored};
  });
});

const {results, outDir} = await runSampled({
  args, qa,
  async visit({comp, sample, dom, state, page}) {
    state.hits ??= [];
    const portrait = comp.height > comp.width;
    const k = comp.width / (portrait ? cfg.designWidth.portrait : cfg.designWidth.landscape); // screen px per design px
    state.cfg ??= {...cfg, frame: {width: comp.width / k, height: comp.height / k}};
    const sc = (b) => ({left: b.left / k, top: b.top / k, right: b.right / k, bottom: b.bottom / k});
    const texts = dom.texts.filter((t) => t.visibleFraction > 0.5).map((t) => ({path: t.path, text: t.text, size: t.fontSize / k, opacity: t.opacity ?? 1, ignored: t.ignored}));
    const items = (await roles(page)).map((o) => ({...o, box: sc(o.box), size: o.size / k}));
    for (const f of lintFrame({texts, items}, state.cfg)) state.hits.push({key: `${f.rule}|${f.path}`, time: sample.time, severity: f.severity, data: f});
  },
  async finish({comp, state, samples}) {
    const findings = qa.mergeHits([...(state.hits ?? []), ...checkConfig(state.cfg ?? {...cfg, frame: {width: 1920, height: 1080}}).map((f) => ({key: `${f.rule}|config`, time: 0, severity: f.severity, data: f}))]);
    return {id: comp.id, sampledFrames: samples.length, findings};
  },
});
const json = path.join(outDir, 'layout-lint.json');
writeFileSync(json, JSON.stringify({generatedAt: new Date().toISOString(), config: cfg, compositions: results}, null, 2));
const rows = results.flatMap((r) => (r.findings.length ? r.findings.map((f) => [r.id, f.worst.rule, f.worst.label, f.worst.detail]) : [[r.id, '-', 'clean', '-']]));
console.log(`\nLayout lint\n${qa.formatTable(['composition', 'rule', 'what', 'detail'], rows)}\n\nJSON: ${path.relative(process.cwd(), json)}`);
process.exit(!args['no-fail'] && results.some((r) => r.findings.length) ? 1 : 0);
