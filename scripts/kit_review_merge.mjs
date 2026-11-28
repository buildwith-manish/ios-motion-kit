// Pure merge of the QA report JSONs into one review.md (no I/O). Used by scripts/kit_review.mjs; unit-tested.
const ts = (s) => {
  if (!Number.isFinite(s)) return '?';
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
};
const span = (f) => (f.firstTime === undefined ? '' : f.lastTime === undefined || f.lastTime === f.firstTime ? ts(f.firstTime) : `${ts(f.firstTime)}-${ts(f.lastTime)}`);
const comps = (report, id) => (report?.compositions ?? []).filter((c) => !id || c.id === id);

/** Each extractor returns [{flag, where, detail}] for one report. `flag` is the short severity/rule label. */
export const extract = {
  contrast: (r, id) => comps(r, id).flatMap((c) => c.findings.map((f) => ({flag: f.status ?? 'fail', where: span(f), detail: `"${String(f.worst?.text ?? '').slice(0, 40)}" ${Number(f.worst?.ratio).toFixed(2)}:1 (${f.worst?.foreground} on ${f.worst?.background}, ${f.worst?.fontSize}px)`}))),
  safeArea: (r, id) => comps(r, id).flatMap((c) => c.findings.map((f) => ({flag: f.worst?.type ?? 'outside', where: span(f), detail: `${f.worst?.label ?? ''} ${['left', 'top', 'right', 'bottom'].filter((s) => (f.worst?.overshoot?.[s] ?? 0) > 0).map((s) => `${s} ${Math.round(f.worst.overshoot[s])}px`).join(', ')}`.trim()}))),
  motion: (r, id) => comps(r, id).flatMap((c) => (c.stretches ?? []).map((s) => ({flag: 'static', where: `${ts(s.start)}-${ts(s.end)}`, detail: `${Number(s.duration).toFixed(2)} s without movement`}))),
  layout: (r, id) => comps(r, id).flatMap((c) => c.findings.map((f) => ({flag: f.worst?.rule ?? 'layout', where: span(f), detail: `${f.worst?.label ?? ''}: ${f.worst?.detail ?? ''}`}))),
  loudness: (r) => (r?.results ?? []).filter((x) => x && (x.ok === false || x.pass === false || x.status === 'fail' || x.withinTarget === false)).map((x) => ({flag: 'loudness', where: String(x.file ?? x.input ?? x.id ?? ''), detail: `integrated ${x.integrated ?? x.lufs ?? '?'} LUFS, true peak ${x.truePeak ?? x.true_peak ?? '?'} (target ${r.target?.integrated ?? '?'})`})),
};

const SECTIONS = [
  ['contrast', 'Contrast'],
  ['safeArea', 'Safe area'],
  ['motion', 'Motion audit'],
  ['layout', 'Layout lint'],
  ['loudness', 'Loudness'],
];

/**
 * @param {{comp: string, times: number[], reports: {contrast?: object, safeArea?: object, motion?: object, layout?: object, loudness?: object}, files?: {stills?: string[], sheet?: string}, skipped?: Record<string,string>}} input
 * A report that is undefined was not run; it is listed as "not run" (with the reason from `skipped`), never as clean.
 * @returns {{markdown: string, counts: Record<string, number|null>, total: number}}
 */
export const mergeReview = ({comp, times, reports, files = {}, skipped = {}}) => {
  const counts = {};
  const body = [];
  for (const [key, title] of SECTIONS) {
    const rep = reports[key];
    if (rep === undefined || rep === null) {
      if (key === 'loudness' && !skipped[key]) continue; // loudness is optional: omit unless asked for
      counts[key] = null;
      body.push(`## ${title}\n\nnot run${skipped[key] ? ` (${skipped[key]})` : ''}\n`);
      continue;
    }
    const rows = extract[key](rep, comp);
    counts[key] = rows.length;
    body.push(rows.length ? `## ${title}: ${rows.length} flag${rows.length === 1 ? '' : 's'}\n\n| flag | when | detail |\n|---|---|---|\n${rows.map((r) => `| ${r.flag} | ${r.where} | ${String(r.detail).replace(/\|/g, '\\|')} |`).join('\n')}\n` : `## ${title}: clean\n`);
  }
  const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
  const head = [
    `# Review: ${comp}`,
    '',
    `Sampled at ${times.map((t) => `${t}s`).join(', ')}. **${total} flag${total === 1 ? '' : 's'}** (${Object.entries(counts).map(([k, n]) => `${k} ${n === null ? 'not run' : n}`).join(', ')}).`,
    '',
    files.sheet ? `Contact sheet: \`${files.sheet}\`` : '',
    files.stills?.length ? `Stills: ${files.stills.map((f) => `\`${f}\``).join(', ')}` : '',
    '',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '');
  return {markdown: `${head.join('\n')}\n${body.join('\n')}`, counts, total};
};
