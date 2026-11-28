// Splits a composition into near-equal pieces for the matrix render (reusable-render.yml). Writes total/fps/chunks to $GITHUB_OUTPUT.
//   node scripts/kit_ci_plan.mjs --comp V-Full --entry src/index.ts --chunk-frames 270 [--frames a-b]
import {appendFileSync} from 'node:fs';
import {fail, getBundle, openRemotionBrowser, parseArgs, parseProps, pickCompositions} from './kit_qa_common.mjs';

const args = parseArgs({comp: 'string', entry: 'string', 'chunk-frames': 'number', frames: 'string', 'serve-url': 'string', props: 'string'}, 'usage: node scripts/kit_ci_plan.mjs --comp <id> [--entry f] [--chunk-frames n] [--frames a-b]');
if (!args.comp) fail('--comp is required');
const serveUrl = await getBundle({entry: args.entry, serveUrl: args['serve-url']});
const browser = await openRemotionBrowser();
const [comp] = await pickCompositions({serveUrl, comp: args.comp, all: false, inputProps: parseProps(args.props), puppeteerInstance: browser});
await browser.close({silent: true});
if (!comp) fail(`composition ${args.comp} not found`);
let first = 0; let last = comp.durationInFrames - 1;
if (args.frames) { const m = /^(\d+)-(\d+)$/.exec(args.frames); if (!m) fail('--frames must look like 0-59'); first = Number(m[1]); last = Math.min(Number(m[2]), last); }
const total = last - first + 1;
const chunk = args['chunk-frames'] ?? 0;
let n = chunk > 0 ? Math.min(256, Math.ceil(total / chunk)) : 1; // a matrix holds at most 256 jobs
const per = Math.ceil(total / n);
const pieces = [];
for (let i = 0; i < n; i++) { const a = first + i * per; if (a > last) break; pieces.push({id: i + 1, start: a, end: Math.min(a + per - 1, last)}); }
console.log(`${comp.id}: ${total} frames at ${comp.fps} fps (${(total / comp.fps).toFixed(2)} s) -> ${pieces.length} piece(s) of up to ${per} frames`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `total=${total}\nfps=${comp.fps}\nchunks=${JSON.stringify(pieces)}\n`);
