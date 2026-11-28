#!/usr/bin/env node
/**
 * Checks every spoken figure in the script (config.script) against the data file (config.dataFile).
 *   node scripts/pipeline/figures_check.mjs [--root <repo>] [--config <file>]
 * Exit: 0 all matched; 1 mismatch (the figure matches only another entity's field); 2 unmatched (no data field has it).
 * It never edits the script or the data.
 *
 * Figures: number words ("two thousand dollars", "forty percent", "three point five") and digits ("$2,000", "40%", "3.5").
 * Kinds: money ($ / dollars), percent, count (everything else). Data: every numeric leaf of the data file (.json, or a .mjs/.js
 * module's default export). With config.figures.entities (a path like "cities") each element of that array is an entity named by
 * config.figures.nameField; a line that names an entity only matches that entity's fields (a figure that only matches another
 * entity's field is a MISMATCH). Fields outside the entities array are global and match any line.
 * Matching: money = |field| equals the spoken value to the dollar (or to the cent); percent = field rounded to 0 or 1 decimals
 * (a field in 0..1 also as value x 100); count = field equals the value.
 * Narrative figures ("one of the cities") go in config.figures.allowList: [{"clip": "<id, optional>", "value": 1, "kind": "<optional>", "note": "why"}].
 */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {init, readLines} from './lib.mjs';

const ONES = {zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19};
const TENS = {twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90};
const BIG = {thousand: 1e3, million: 1e6, billion: 1e9};
const isNumWord = (w) => w in ONES || w in TENS || w === 'hundred' || w in BIG || w === 'point';

/** Figures spoken in `text`: [{raw, value, kind, context}]. Exported for tests. */
export function extract(text) {
  const toks = text.toLowerCase().replace(/[’']/g, "'").replace(/(\d),(?=\d{3})/g, '$1').replace(/(\w)-(?=\w)/g, '$1 ').match(/\$?\d+(?:\.\d+)?%?|[a-z']+|[.,;:!?]/g) ?? [];
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    let value, j = i + 1, kind = 'count';
    if (/^\$?\d/.test(w)) {
      value = Number(w.replace(/[$%]/g, ''));
      if (w.startsWith('$')) kind = 'money'; else if (w.endsWith('%')) kind = 'percent';
    } else if (isNumWord(w) && w !== 'point') {
      let total = 0, cur = 0, dec = '', afterPoint = false;
      j = i;
      while (j < toks.length && isNumWord(toks[j])) {
        const t = toks[j];
        if (t === 'point') afterPoint = true;
        else if (afterPoint) { if (t in ONES && ONES[t] < 10) dec += ONES[t]; else break; }
        else if (t in ONES) cur += ONES[t];
        else if (t in TENS) cur += TENS[t];
        else if (t === 'hundred') cur = (cur || 1) * 100;
        else if (t in BIG) { total += (cur || 1) * BIG[t]; cur = 0; }
        j++;
      }
      value = total + cur + (dec ? Number('0.' + dec) : 0);
    } else continue;
    const next = toks[j];
    let end = j;
    if (kind === 'count' && (next === 'dollars' || next === 'dollar')) {
      kind = 'money'; end = j + 1;
      if (toks[j + 1] === 'and' && isNumWord(toks[j + 2])) {
        let k = j + 2, c = 0;
        while (k < toks.length && isNumWord(toks[k])) { c += ONES[toks[k]] ?? TENS[toks[k]] ?? 0; k++; }
        if (toks[k] === 'cents') { value += c / 100; end = k + 1; }
      }
    } else if (kind === 'count' && next === 'percent') { kind = 'percent'; end = j + 1; }
    else if (kind !== 'count') end = j;
    out.push({raw: toks.slice(i, end).join(' '), value, kind, context: toks.slice(Math.max(0, i - 4), Math.min(toks.length, end + 3)).join(' ')});
    i = Math.max(i, end - 1);
  }
  return out;
}

const leaves = (v, p = '', out = []) => {
  if (typeof v === 'number' && Number.isFinite(v)) out.push([p, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => leaves(x, `${p}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) leaves(x, p ? `${p}.${k}` : k, out);
  return out;
};
const r0 = (x) => Math.round(x), r1 = (x) => Math.round(x * 10) / 10;
const fits = (kind, spoken, v) => {
  if (kind === 'money') return r0(Math.abs(v)) === r0(spoken) || Math.round(Math.abs(v) * 100) === Math.round(spoken * 100);
  if (kind === 'percent') return [v, Math.abs(v) <= 1 ? v * 100 : NaN].some((x) => r0(x) === spoken || r1(x) === spoken);
  return Math.abs(v - spoken) < 1e-9 || r1(v) === spoken;
};
const get = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);

export async function run(argv) {
  const {root, cfg, at} = init(argv);
  const df = at(cfg.dataFile);
  const data = df.endsWith('.json') ? JSON.parse(fs.readFileSync(df, 'utf8')) : (await import(pathToFileURL(df).href)).default;
  const ents = cfg.figures.entities ? get(data, cfg.figures.entities) : null;
  if (cfg.figures.entities && !Array.isArray(ents)) { console.error(`config.figures.entities "${cfg.figures.entities}" is not an array in ${cfg.dataFile}`); return 2; }
  const entities = (ents ?? []).map((e) => ({name: String(e[cfg.figures.nameField]), fields: leaves(e)}));
  const globals = leaves(data).filter(([p]) => !cfg.figures.entities || !(p === cfg.figures.entities || p.startsWith(cfg.figures.entities + '[')));
  const allowFile = at(cfg.figures.allowList);
  const allow = fs.existsSync(allowFile) ? JSON.parse(fs.readFileSync(allowFile, 'utf8')) : [];
  const rows = []; let mismatch = 0, unmatched = 0, allowed = 0;
  for (const ln of readLines(at(cfg.script))) {
    const named = entities.filter((e) => e.name && ln.text.includes(e.name)).map((e) => e.name);
    const pool = named.length ? named : entities.map((e) => e.name);
    for (const f of extract(ln.text)) {
      const matched = [], other = [];
      for (const [p, v] of globals) if (fits(f.kind, f.value, v)) matched.push(p);
      for (const e of entities) for (const [p, v] of e.fields) if (fits(f.kind, f.value, v)) (pool.includes(e.name) ? matched : other).push(`${e.name}.${p}`);
      let status = 'OK';
      if (!matched.length) {
        const a = allow.find((x) => Math.abs(x.value - f.value) < 1e-9 && (!x.clip || x.clip === ln.id) && (!x.kind || x.kind === f.kind));
        if (a) { status = 'ALLOWED'; allowed++; matched.push(`allow-list: ${a.note ?? ''}`.trim()); }
        else if (other.length) { status = 'MISMATCH'; mismatch++; }
        else { status = 'UNMATCHED'; unmatched++; }
      }
      rows.push({clip: ln.id, spoken: f.kind === 'money' ? `$${f.value}` : f.kind === 'percent' ? `${f.value}%` : String(f.value), kind: f.kind, status, matched: (matched.length ? matched : other).slice(0, 3).join(', '), ctx: f.context});
    }
  }
  const pad = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
  console.log(pad('clip', 8), pad('spoken', 11), pad('kind', 8), pad('status', 10), pad('matched data field(s)', 40), 'context');
  for (const r of rows) console.log(pad(r.clip, 8), pad(r.spoken, 11), pad(r.kind, 8), pad(r.status, 10), pad(r.matched, 40), r.ctx);
  console.log(`\n${rows.length} figures | OK ${rows.length - mismatch - unmatched - allowed} | ALLOWED ${allowed} | MISMATCH ${mismatch} | UNMATCHED ${unmatched}`);
  for (const r of rows.filter((x) => x.status === 'UNMATCHED')) console.log(`UNMATCHED ${r.clip}: ${r.spoken} [${r.kind}] "${r.ctx}" (fix the script or data, or add it to ${cfg.figures.allowList})`);
  for (const r of rows.filter((x) => x.status === 'MISMATCH')) console.log(`MISMATCH ${r.clip}: ${r.spoken} [${r.kind}] belongs to another entity -> ${r.matched} "${r.ctx}"`);
  return unmatched ? 2 : mismatch ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) run(process.argv.slice(2)).then((c) => process.exit(c));
