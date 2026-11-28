/** Pure validation and id helpers for the chartHeadline scene. Called from layoutSceneSequence, so a bad scene fails before any frame renders. */
import {sourceLine} from '../data/manifest';
import type {EmphasisFocus} from '../charts/emphasis';
import type {ChartHeadlineChart, ChartHeadlineSceneData, SceneDefinition} from './types';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Ids of the chart's items, in order (bar / sector label, slope name, waterfall label, line x). */
export const chartItemIds = (c: ChartHeadlineChart): string[] => {
  switch (c.kind) {
    case 'bar':
    case 'sector': return c.data.map((d) => d.label);
    case 'slope': return c.items.map((d) => d.name);
    case 'waterfall': return c.items.map((d) => d.label);
    case 'line': return c.x.map((v) => String(v));
  }
};

/** Series names (line) a focus may name; empty for the other kinds. */
export const chartSeriesNames = (c: ChartHeadlineChart): string[] => (c.kind === 'line' ? c.series.map((s) => s.name) : []);

/** Index of an item by id or index; -1 when unknown. */
export const resolveChartItem = (c: ChartHeadlineChart, ref: string | number): number => {
  const ids = chartItemIds(c);
  if (typeof ref === 'number') return Number.isInteger(ref) && ref >= 0 && ref < ids.length ? ref : -1;
  return ids.indexOf(ref);
};

const known = (c: ChartHeadlineChart): string => {
  const names = [...chartItemIds(c), ...chartSeriesNames(c)];
  return names.length > 8 ? `${names.slice(0, 8).join(', ')}, ...` : names.join(', ');
};

const checkFocus = (scene: ChartHeadlineSceneData, what: string, f: EmphasisFocus): void => {
  const c = scene.chart;
  const ids = chartItemIds(c);
  const series = chartSeriesNames(c);
  const bad = (why: string): never => { throw new RangeError(`Scene "${scene.id}": ${what} ${why} (known: ${known(c)})`); };
  if (typeof f === 'string') {
    if (!ids.includes(f) && !series.includes(f)) bad(`focus "${f}" is not an item or series of the chart`);
    return;
  }
  if (typeof f === 'number') {
    if (!Number.isInteger(f) || f < 0 || f >= ids.length) bad(`focus index ${f} is outside 0..${ids.length - 1}`);
    return;
  }
  if (f.id !== undefined && !ids.includes(f.id)) bad(`focus id "${f.id}" is not an item of the chart`);
  if (f.index !== undefined && (!Number.isInteger(f.index) || f.index < 0 || f.index >= ids.length)) bad(`focus index ${f.index} is outside 0..${ids.length - 1}`);
  if (f.series !== undefined) {
    const ok = typeof f.series === 'number' ? Number.isInteger(f.series) && f.series >= 0 && f.series < Math.max(1, series.length) : series.includes(f.series);
    if (!ok) bad(`focus series ${JSON.stringify(f.series)} is not a series of the chart`);
  }
  if (f.range !== undefined) {
    const [a, b] = f.range;
    if (!Number.isInteger(a) || !Number.isInteger(b) || Math.min(a, b) < 0 || Math.max(a, b) >= ids.length) bad(`focus range [${a}, ${b}] is outside 0..${ids.length - 1}`);
  }
  if (f.id === undefined && f.index === undefined && f.series === undefined && f.range === undefined) bad('focus object names nothing (give id, index, series or range)');
};

const checkValues = (scene: ChartHeadlineSceneData): void => {
  const c = scene.chart;
  const id = scene.id;
  const nums = (vals: readonly unknown[], what: string): void => {
    vals.forEach((v, i) => { if (!finite(v)) throw new RangeError(`Scene "${id}": ${what} ${i + 1} must be a finite number`); });
  };
  const dupes = (ids: readonly string[]): void => {
    const seen = new Set<string>();
    ids.forEach((x) => {
      if (!String(x).trim()) throw new RangeError(`Scene "${id}": chart item names must not be empty`);
      if (seen.has(x)) throw new RangeError(`Scene "${id}": chart item "${x}" is listed twice, so focus could not tell them apart`);
      seen.add(x);
    });
  };
  switch (c.kind) {
    case 'bar':
    case 'sector': {
      if (!c.data?.length) throw new RangeError(`Scene "${id}": chart data is empty`);
      nums(c.data.map((d) => d.value), 'value');
      if (c.kind === 'sector' && !c.data.some((d) => d.value > 0)) throw new RangeError(`Scene "${id}": a sector chart needs at least one value above zero`);
      dupes(c.data.map((d) => d.label));
      return;
    }
    case 'slope': {
      if (!c.items?.length) throw new RangeError(`Scene "${id}": chart data is empty`);
      nums(c.items.flatMap((d) => [d.from, d.to]), 'slope value');
      dupes(c.items.map((d) => d.name));
      if (!c.leftLabel?.trim() || !c.rightLabel?.trim()) throw new RangeError(`Scene "${id}": a slope chart needs leftLabel and rightLabel`);
      return;
    }
    case 'waterfall': {
      if (!c.items?.length) throw new RangeError(`Scene "${id}": chart data is empty`);
      nums(c.items.map((d) => d.value), 'value');
      dupes(c.items.map((d) => d.label));
      return;
    }
    case 'line': {
      if (!c.x?.length || !c.series?.length) throw new RangeError(`Scene "${id}": chart data is empty`);
      dupes(c.x.map((v) => String(v)));
      c.series.forEach((s) => {
        if (s.values.length !== c.x.length) throw new RangeError(`Scene "${id}": series "${s.name}" has ${s.values.length} values for ${c.x.length} x labels`);
        s.values.forEach((v) => { if (v !== null && !finite(v)) throw new RangeError(`Scene "${id}": series "${s.name}" has a value that is not a number or null`); });
      });
      return;
    }
    default:
      throw new RangeError(`Scene "${id}": unknown chart kind "${String((c as {kind?: unknown}).kind)}" (use bar, line, slope, waterfall or sector)`);
  }
};

const checkTime = (scene: ChartHeadlineSceneData, what: string, t: number | undefined): void => {
  if (t === undefined) return;
  if (!finite(t) || t < 0 || t > scene.duration) throw new RangeError(`Scene "${scene.id}": ${what} time ${String(t)} s must be within the scene (0..${scene.duration} s)`);
};

export const validateChartScene = (scene: SceneDefinition): void => {
  if (scene.type !== 'chartHeadline') return;
  const id = scene.id;
  if (typeof scene.title !== 'string' || !scene.title.trim()) throw new RangeError(`Scene "${id}": chartHeadline needs a title that states the claim (for example "Rent grew twice as fast as pay")`);
  if (!scene.chart || typeof scene.chart !== 'object') throw new RangeError(`Scene "${id}": chartHeadline needs a chart`);
  checkValues(scene);
  const c = scene.chart;
  if (scene.reveal?.start !== undefined && (!finite(scene.reveal.start) || scene.reveal.start < 0 || scene.reveal.start >= scene.duration)) {
    throw new RangeError(`Scene "${id}": reveal.start must be inside the scene (0..${scene.duration} s)`);
  }
  const em = scene.emphasis;
  if (em) {
    if (!em.steps?.length) throw new RangeError(`Scene "${id}": emphasis needs at least one step`);
    if (em.dimTo !== undefined && (!finite(em.dimTo) || em.dimTo < 0 || em.dimTo > 1)) throw new RangeError(`Scene "${id}": emphasis.dimTo must be between 0 and 1`);
    em.steps.forEach((s, i) => {
      checkTime(scene, `emphasis step ${i + 1}`, s.at);
      (Array.isArray(s.focus) ? (s.focus as readonly EmphasisFocus[]) : [s.focus as EmphasisFocus]).forEach((f) => checkFocus(scene, `emphasis step ${i + 1}`, f));
    });
  }
  const pointwise = c.kind === 'bar' || c.kind === 'line';
  if ((scene.labels?.length || scene.compare?.length) && !pointwise) {
    throw new RangeError(`Scene "${id}": labels and compare markers are supported on bar and line charts, not "${c.kind}" (slope charts label both ends themselves; use emphasis steps with a label instead)`);
  }
  const seriesCount = c.kind === 'line' ? c.series.length : 1;
  const ref = (what: string, r: string | number, series: number | undefined): void => {
    if (resolveChartItem(c, r) < 0) throw new RangeError(`Scene "${id}": ${what} "${String(r)}" is not an item of the chart (known: ${known(c)})`);
    if (series !== undefined && (!Number.isInteger(series) || series < 0 || series >= seriesCount)) throw new RangeError(`Scene "${id}": ${what} series ${series} is outside 0..${seriesCount - 1}`);
  };
  scene.labels?.forEach((l, i) => { ref(`label ${i + 1} item`, l.item, l.series); checkTime(scene, `label ${i + 1}`, l.at); });
  scene.compare?.forEach((m, i) => {
    ref(`compare ${i + 1} "from"`, m.from, m.series);
    ref(`compare ${i + 1} "to"`, m.to, m.series);
    if (resolveChartItem(c, m.from) === resolveChartItem(c, m.to)) throw new RangeError(`Scene "${id}": compare ${i + 1} needs two different items`);
    checkTime(scene, `compare ${i + 1}`, m.at);
  });
  if (scene.sourceIds?.length && !scene.source) {
    if (!scene.manifest) throw new RangeError(`Scene "${id}": sourceIds needs the data manifest (set scene.manifest to your data.manifest.json) or write scene.source`);
    try { sourceLine(scene.sourceIds, scene.manifest); } catch (e) { throw new RangeError(`Scene "${id}": ${(e as Error).message}`); }
  }
};

/** The source text a chartHeadline scene shows (empty when it has none). */
export const chartSceneSource = (scene: ChartHeadlineSceneData): string =>
  scene.source ?? (scene.sourceIds?.length && scene.manifest ? sourceLine(scene.sourceIds, scene.manifest) : '');
