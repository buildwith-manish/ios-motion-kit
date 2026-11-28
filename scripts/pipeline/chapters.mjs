#!/usr/bin/env node
/**
 * YouTube chapters from the layout. Builds config.output.chaptersTxt ("m:ss title" lines) from config.chapters, or checks it.
 *   node scripts/pipeline/chapters.mjs [--root <repo>] [--config <file>]          build, then check
 *   node scripts/pipeline/chapters.mjs --check                                     check the existing txt against the layout
 * A chapter starts at its chapter card (id chapter<N>, N = position in config.chapters) or, with "card": false, at its section.
 * Start seconds are floored. When the first chapter starts after 0:00, a "0:00 <youtubeIntroTitle>" line is added.
 * Checks (exit 1): first chapter at 0:00, starts ascend and exist in the layout, every chapter at least 10 s (the last one until
 * the end of the video). Warning only: fewer than 3 chapters (YouTube needs 3).
 */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {init, readLayout} from './lib.mjs';

export const mss = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : `${Math.floor(s / 60)}`) + `:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const parseMss = (t) => t.split(':').map(Number).reduce((a, x) => a * 60 + x, 0);

/** [{seconds, title}] from layout + config. Throws on an unknown section. */
export const chapterStarts = (layout, cfg) => {
  const byId = Object.fromEntries(layout.sections.map((s) => [s.id, s]));
  const out = cfg.chapters.map((c, i) => {
    const s = (c.card !== false && byId[`chapter${i + 1}`]) || byId[c.section];
    if (!s) throw new Error(`chapter "${c.title}": section "${c.section}" is not in the layout`);
    return {seconds: Math.floor(s.start + 1e-6), title: c.title};
  });
  if (out.length && out[0].seconds > 0) out.unshift({seconds: 0, title: cfg.youtubeIntroTitle});
  return out;
};

/** {failures, warnings} for [{seconds, title}] and the video length. */
export const checkChapters = (list, total) => {
  const failures = [], warnings = [];
  if (!list.length) failures.push('no chapters');
  else if (list[0].seconds !== 0) failures.push(`the first chapter must start at 0:00 (it is ${mss(list[0].seconds)})`);
  list.forEach((c, i) => {
    const next = i + 1 < list.length ? list[i + 1].seconds : total;
    if (i > 0 && c.seconds <= list[i - 1].seconds) failures.push(`chapter "${c.title}" does not start after the previous one`);
    if (next - c.seconds < 10) failures.push(`chapter "${c.title}" is ${(next - c.seconds).toFixed(1)} s long: YouTube needs at least 10 s`);
  });
  if (list.length > 0 && list.length < 3) warnings.push('YouTube needs at least 3 chapters');
  return {failures, warnings};
};

export const parseTxt = (s) => s.split('\n').filter((l) => l.trim()).map((l) => {
  const m = l.match(/^(\d+(?::\d{2}){1,2})\s+(.+)$/);
  if (!m) throw new Error(`bad chapter line: "${l}"`);
  return {seconds: parseMss(m[1]), title: m[2]};
});

export function run(argv) {
  const {root, cfg, args, at} = init(argv, {check: true});
  const layout = readLayout(root, cfg);
  const out = at(cfg.output.chaptersTxt);
  let list;
  try {
    if (args.check) list = parseTxt(fs.readFileSync(out, 'utf8'));
    else {
      list = chapterStarts(layout, cfg);
      fs.mkdirSync(path.dirname(out), {recursive: true});
      fs.writeFileSync(out, list.map((c) => `${mss(c.seconds)} ${c.title}`).join('\n') + '\n');
      console.log(`wrote ${cfg.output.chaptersTxt} (${list.length} chapters)`);
    }
  } catch (e) { console.error(`FAIL ${e.message}`); return 1; }
  const {failures, warnings} = checkChapters(list, layout.totalSeconds);
  for (const c of list) console.log(`${mss(c.seconds).padStart(6)} ${c.title}`);
  for (const w of warnings) console.warn(`WARN ${w}`);
  for (const f of failures) console.error(`FAIL ${f}`);
  return failures.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(run(process.argv.slice(2)));
