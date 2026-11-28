/**
 * Pure chart geometry: data + size -> px layout, points, line samples and bar rects. No DOM, no hooks.
 * All px are canvas px; design sizes are scaled by the theme's unit. Missing values (null) are gaps, never 0.
 */
import {formatNumber, monthYear, quarter, type FormatPresetName, type FormatSpec} from '../text/format';
import {roleFontPx, textWidthPx, type DvPoint, type DvRect, type Tone} from '../dataviz/common';
import {unit} from '../tokens/helpers';
import type {Theme} from '../tokens/types';
import {bandScale, linearScale, linearTicks, niceDomain, parseTime, timeTicks, type BandScale, type LinearScale} from './scales';
import {isMissing, stackExtent, stackValues, type StackedValue} from './stack';

export interface SeriesData {
  name: string;
  /** One value per x. null = gap. */
  values: ReadonlyArray<number | null>;
  tone?: Tone;
}

export type TimeLabel = 'year' | 'quarter' | 'monthYear' | 'month';

export interface ChartSpec {
  /** Category labels (strings) or x values (numbers, or date strings with xType 'time'). */
  x: ReadonlyArray<string | number>;
  /** Default: 'band' for strings, 'linear' for numbers. Bars always sit on bands. */
  xType?: 'band' | 'linear' | 'time';
  series: readonly SeriesData[];
  /** Stack bars/areas. */
  stacked?: boolean;
  /** 'horizontal' puts categories on the y axis and values on x (bars). */
  orientation?: 'vertical' | 'horizontal';
  /** Include 0 in the value domain. Default true. */
  zero?: boolean;
  yMin?: number;
  yMax?: number;
  /** Approximate number of value ticks. Default 4. */
  yTicks?: number;
  /** Value axis + end labels preset. Default 'int'. */
  yFormat?: FormatPresetName | FormatSpec;
  /** Numeric x labels. Default: integers without grouping. */
  xFormat?: FormatPresetName | FormatSpec;
  timeLabel?: TimeLabel;
  /** Reserve room on the right for end-of-line labels. */
  endLabels?: boolean;
  /** Reserve a legend row on top. */
  legend?: boolean;
}

export interface ChartLayout {
  width: number;
  height: number;
  plot: DvRect;
  horizontal: boolean;
  xType: 'band' | 'linear' | 'time';
  /** Value scale (px along the value axis). */
  value: LinearScale;
  valueTicks: Array<{v: number; pos: number; label: string}>;
  /** Bands over the indices (bars). */
  band: BandScale;
  /** Position of index i along the category axis, px (band centre, or the x scale). */
  catPos: (i: number) => number;
  catTicks: Array<{pos: number; label: string}>;
  /** Px point of value v at index i. */
  point: (i: number, v: number) => DvPoint;
  /** Value-axis px of zero (clamped into the plot). */
  baseline: number;
  /** Stacked values per series, when spec.stacked. */
  stack: StackedValue[][] | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatTimeTick = (ms: number, kind: TimeLabel): string => {
  const d = new Date(ms);
  return kind === 'year' ? String(d.getUTCFullYear()) : kind === 'quarter' ? quarter(d) : kind === 'month' ? MONTHS[d.getUTCMonth()] : monthYear(d);
};

/** Text shown at the end of a series' line: "Name 4.2%". Empty if the series has no values. */
export const endLabelText = (spec: ChartSpec, s: SeriesData): string => {
  for (let i = s.values.length - 1; i >= 0; i--) {
    const v = s.values[i];
    if (!isMissing(v)) return `${s.name} ${formatNumber(v, spec.yFormat ?? 'int')}`;
  }
  return '';
};

export const chartLayout = (theme: Theme, spec: ChartSpec, width: number, height: number): ChartLayout => {
  const u = unit(theme);
  const font = roleFontPx(theme, 'caption');
  const horizontal = spec.orientation === 'horizontal';
  const n = spec.x.length;
  const xType = spec.xType ?? (n > 0 && spec.x.every((v) => typeof v === 'number') ? 'linear' : 'band');
  const yFmt = spec.yFormat ?? 'int';
  const xFmt = spec.xFormat ?? {decimals: 0, group: false};

  // value domain
  const stack = spec.stacked ? stackValues(spec.series.map((s) => s.values)) : null;
  let ext: [number, number] | null;
  if (stack) ext = stackExtent(stack);
  else {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of spec.series) for (const v of s.values) if (!isMissing(v)) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    ext = lo > hi ? null : [lo, hi];
  }
  let [lo, hi] = ext ?? [0, 1];
  if (spec.zero !== false) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (spec.yMin !== undefined) lo = spec.yMin;
  if (spec.yMax !== undefined) hi = spec.yMax;
  const count = spec.yTicks ?? 4;
  const dom = niceDomain(lo, hi, count);
  const domain: [number, number] = [spec.yMin ?? dom[0], spec.yMax ?? dom[1]];
  const ticksV = linearTicks(domain[0], domain[1], count);
  const vLabels = ticksV.map((t) => formatNumber(t, yFmt));

  // category labels
  const catLabel = (i: number): string => {
    const x = spec.x[i];
    return typeof x === 'string' && xType !== 'time' ? x : xType === 'time' ? formatTimeTick(parseTime(x), spec.timeLabel ?? 'monthYear') : formatNumber(Number(x), xFmt);
  };
  const widest = (labels: string[]): number => labels.reduce((m, t) => Math.max(m, textWidthPx(theme, 'caption', t)), 0);
  const catAll = Array.from({length: n}, (_, i) => catLabel(i));

  // margins
  const legendH = spec.legend ? font * 2.6 : 0;
  const endW = spec.endLabels ? widest(spec.series.map((s) => endLabelText(spec, s))) + 14 * u : 0;
  const top = legendH + 8 * u;
  const bottom = font * 2.2;
  const left = horizontal ? widest(catAll) + 12 * u : widest(vLabels) + 12 * u;
  const right = 8 * u + endW + (horizontal ? widest(vLabels) / 2 : 0);
  const plot: DvRect = {x: left, y: top, w: Math.max(1, width - left - right), h: Math.max(1, height - top - bottom)};

  const value = horizontal ? linearScale(domain, [plot.x, plot.x + plot.w]) : linearScale(domain, [plot.y + plot.h, plot.y]);
  const catRange: [number, number] = horizontal ? [plot.y, plot.y + plot.h] : [plot.x, plot.x + plot.w];
  const band = bandScale(n, catRange);
  const inset = 6 * u;
  let catPos: (i: number) => number;
  let catTicks: Array<{pos: number; label: string}>;
  if (xType === 'band') {
    catPos = band.center;
    const stride = Math.max(1, Math.ceil((widest(catAll) * 1.25) / Math.max(1, band.step)));
    catTicks = horizontal ? catAll.map((label, i) => ({pos: catPos(i), label})) : catAll.map((label, i) => ({pos: catPos(i), label})).filter((_, i) => i % stride === 0);
  } else {
    const nums = spec.x.map((x) => (xType === 'time' ? parseTime(x) : Number(x)));
    const finite = nums.filter((v) => Number.isFinite(v));
    const x0 = finite.length ? Math.min(...finite) : 0;
    const x1 = finite.length ? Math.max(...finite) : 1;
    const xs = linearScale([x0, x1], [catRange[0] + inset, catRange[1] - inset]);
    catPos = (i) => (finite.length === 1 ? (catRange[0] + catRange[1]) / 2 : xs(nums[i]));
    const tickVals = xType === 'time' ? timeTicks(x0, x1, 5) : linearTicks(x0, x1, 5);
    catTicks = tickVals.map((t) => ({pos: xs(t), label: xType === 'time' ? formatTimeTick(t, spec.timeLabel ?? (x1 - x0 > 2 * 365 * 864e5 ? 'year' : 'monthYear')) : formatNumber(t, xFmt)}));
  }
  const clampV = Math.min(Math.max(0, domain[0]), domain[1]);
  return {
    width, height, plot, horizontal, xType, value, band, catPos, catTicks,
    valueTicks: ticksV.map((v, k) => ({v, pos: value(v), label: vLabels[k]})),
    point: (i, v) => (horizontal ? {x: value(v), y: catPos(i)} : {x: catPos(i), y: value(v)}),
    baseline: value(clampV),
    stack,
  };
};

/** Px points of one series (null where the value is missing). Use as Callout anchors (add the chart's own offset). */
export const seriesPoints = (layout: ChartLayout, values: ReadonlyArray<number | null>, stackIndex?: number): Array<DvPoint | null> =>
  values.map((v, i) => {
    if (isMissing(v)) return null;
    const top = stackIndex !== undefined && layout.stack ? layout.stack[stackIndex][i].y1 : v;
    return layout.point(i, top);
  });

export interface LineSegment {
  /** Dense polyline. */
  samples: DvPoint[];
  /** Cumulative arc length at each sample. */
  cum: number[];
  total: number;
  /** The data points of this run. */
  points: DvPoint[];
}

const monotone = (pts: DvPoint[], per: number): DvPoint[] => {
  const n = pts.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    dx.push(pts[k + 1].x - pts[k].x);
    m.push((pts[k + 1].y - pts[k].y) / dx[k]);
  }
  const t: number[] = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let k = 1; k < n - 1; k++) t[k] = m[k - 1] * m[k] <= 0 ? 0 : (m[k - 1] + m[k]) / 2;
  for (let k = 0; k < n - 1; k++) {
    if (m[k] === 0) {
      t[k] = 0;
      t[k + 1] = 0;
    } else {
      const a = t[k] / m[k];
      const b = t[k + 1] / m[k];
      const s = a * a + b * b;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        t[k] = tau * a * m[k];
        t[k + 1] = tau * b * m[k];
      }
    }
  }
  const out: DvPoint[] = [pts[0]];
  for (let k = 0; k < n - 1; k++) {
    for (let j = 1; j <= per; j++) {
      const s = j / per;
      const s2 = s * s;
      const s3 = s2 * s;
      const h = dx[k];
      out.push({
        x: pts[k].x + s * h,
        y: (2 * s3 - 3 * s2 + 1) * pts[k].y + (s3 - 2 * s2 + s) * h * t[k] + (-2 * s3 + 3 * s2) * pts[k + 1].y + (s3 - s2) * h * t[k + 1],
      });
    }
  }
  return out;
};

/** Splits points at gaps (null) into runs and samples each as a monotone curve or a straight polyline. Single points give a run of one sample. */
export const lineSegments = (points: ReadonlyArray<DvPoint | null>, curve: 'smooth' | 'linear' = 'smooth', perSegment: number = 14): LineSegment[] => {
  const runs: DvPoint[][] = [];
  let cur: DvPoint[] = [];
  for (const p of points) {
    if (p) cur.push(p);
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return runs.map((run) => {
    const increasing = run.every((p, k) => k === 0 || p.x > run[k - 1].x);
    const samples = run.length > 2 && curve === 'smooth' && increasing ? monotone(run, perSegment) : run;
    const cum = [0];
    for (let k = 1; k < samples.length; k++) cum.push(cum[k - 1] + Math.hypot(samples[k].x - samples[k - 1].x, samples[k].y - samples[k - 1].y));
    return {samples, cum, total: cum[cum.length - 1], points: run};
  });
};

/** Samples of a segment up to arc length `len` (last point interpolated). */
export const prefixSamples = (seg: LineSegment, len: number): DvPoint[] => {
  if (len >= seg.total) return seg.samples;
  const out: DvPoint[] = [];
  for (let k = 0; k < seg.samples.length; k++) {
    if (seg.cum[k] <= len) out.push(seg.samples[k]);
    else {
      const f = (len - seg.cum[k - 1]) / (seg.cum[k] - seg.cum[k - 1] || 1);
      const a = seg.samples[k - 1];
      const b = seg.samples[k];
      out.push({x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f});
      break;
    }
  }
  return out;
};

export type CapDir = 'up' | 'down' | 'left' | 'right';

export interface BarRect extends DvRect {
  series: number;
  index: number;
  value: number;
  /** Direction the rounded cap faces; null if this segment is not the cap of its stack. */
  cap: CapDir | null;
  /** Side of the baseline the segment grows from. */
  dir: CapDir;
}

/** Bar rects [series][index]; null for missing values. Grouped by default, stacked when spec.stacked. */
export const barRects = (layout: ChartLayout, spec: ChartSpec): Array<Array<BarRect | null>> => {
  const S = spec.series.length;
  const bw = layout.band.bandwidth;
  const gap = S > 1 && !spec.stacked ? bw * 0.08 : 0;
  const sub = spec.stacked ? bw : Math.max(0, (bw - gap * (S - 1)) / Math.max(1, S));
  const horizontal = layout.horizontal;
  return spec.series.map((s, k) =>
    s.values.map((v, i) => {
      if (isMissing(v)) return null;
      const y0 = layout.stack ? layout.stack[k][i].y0 : 0;
      const y1 = layout.stack ? layout.stack[k][i].y1 : v;
      const a = layout.value(y0);
      const b = layout.value(y1);
      const lenLo = Math.min(a, b);
      const len = Math.abs(a - b);
      const pos = layout.band.start(i) + (spec.stacked ? 0 : k * (sub + gap));
      const positive = v >= 0;
      let cap = true;
      if (layout.stack) for (let j = k + 1; j < S; j++) {
        const o = spec.series[j].values[i];
        if (!isMissing(o) && (o >= 0) === positive && o !== 0) cap = false;
      }
      const dir: CapDir = horizontal ? (positive ? 'right' : 'left') : positive ? 'up' : 'down';
      return horizontal
        ? {x: lenLo, y: pos, w: len, h: sub, series: k, index: i, value: v, cap: cap ? dir : null, dir}
        : {x: pos, y: lenLo, w: sub, h: len, series: k, index: i, value: v, cap: cap ? dir : null, dir};
    }),
  );
};

/** Rect grown to fraction p from its baseline edge (the edge opposite the cap). */
export const growRect = (r: BarRect, p: number): DvRect => {
  const q = Math.min(1, Math.max(0, p));
  switch (r.dir) {
    case 'up': return {x: r.x, w: r.w, h: r.h * q, y: r.y + r.h * (1 - q)};
    case 'down': return {x: r.x, w: r.w, y: r.y, h: r.h * q};
    case 'right': return {y: r.y, h: r.h, x: r.x, w: r.w * q};
    default: return {y: r.y, h: r.h, w: r.w * q, x: r.x + r.w * (1 - q)};
  }
};

/** SVG path of a rect with the corners on the cap side rounded to radius r (clamped); square if cap is null. */
export const barPath = (rc: DvRect, cap: CapDir | null, radius: number): string => {
  const {x, y, w, h} = rc;
  const f = (n: number) => n.toFixed(2);
  const thick = cap === 'up' || cap === 'down' ? w : h;
  const length = cap === 'up' || cap === 'down' ? h : w;
  const r = cap ? Math.max(0, Math.min(radius, thick / 2, length)) : 0;
  if (r < 0.01) return `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`;
  switch (cap) {
    case 'up': return `M${f(x)} ${f(y + h)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h)}Z`;
    case 'down': return `M${f(x)} ${f(y)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 0 ${f(x + r)} ${f(y + h)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 0 ${f(x + w)} ${f(y + h - r)}V${f(y)}Z`;
    case 'right': return `M${f(x)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x)}Z`;
    default: return `M${f(x + w)} ${f(y)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 0 ${f(x)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 0 ${f(x + r)} ${f(y + h)}H${f(x + w)}Z`;
  }
};
