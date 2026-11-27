/**
 * Pure geometry for <LineDraw>/<Sparkline>: data -> px points -> a smooth (monotone cubic) or straight polyline,
 * with cumulative arc length, so the drawing head (line tip, end dot, area edge) is exact at any fraction.
 * No DOM, no hooks.
 */
import {unit} from '../tokens/helpers';
import type {Theme} from '../tokens/types';
import type {DvPoint, DvRect} from './common';

/** One data point: a bare number (x = index) or an {x, y} pair. */
export type LinePoint = number | {x: number; y: number};

/** Inputs of {@link lineGeometry}. All sizes are canvas px. */
export interface LineGeometryInput {
  data: readonly LinePoint[];
  width: number;
  height: number;
  /** Inset of the plot area, px: one number or per side. Default 0. */
  padding?: number | {top: number; right: number; bottom: number; left: number};
  /** Fixes the value at the bottom of the plot. Default: the smallest value. */
  min?: number;
  /** Fixes the value at the top of the plot. Default: the largest value. */
  max?: number;
  /** 'smooth' (monotone cubic, never overshoots the data, default) or 'linear'. */
  curve?: 'smooth' | 'linear';
  /** Samples per data segment for the smooth curve. Default 14. */
  samplesPerSegment?: number;
}

/** Geometry of one line. */
export interface LineGeometry {
  width: number;
  height: number;
  plot: DvRect;
  /** The data points in px (use these as Callout anchors). */
  points: DvPoint[];
  /** Dense polyline following the curve. */
  samples: DvPoint[];
  /** Cumulative arc length at each sample. */
  cum: number[];
  total: number;
  /** y of the bottom of the plot, px (the area fill's baseline). */
  baseline: number;
}

/**
 * Builds the line geometry. Data x values (if given) set horizontal spacing; bare numbers are evenly spaced.
 * @example const g = lineGeometry({data: [3, 5, 4, 8], width: 600, height: 240, padding: 16});
 */
export const lineGeometry = (i: LineGeometryInput): LineGeometry => {
  const pad = typeof i.padding === 'number' ? {top: i.padding, right: i.padding, bottom: i.padding, left: i.padding} : i.padding ?? {top: 0, right: 0, bottom: 0, left: 0};
  const plot: DvRect = {x: pad.left, y: pad.top, w: Math.max(1, i.width - pad.left - pad.right), h: Math.max(1, i.height - pad.top - pad.bottom)};
  const raw = i.data.map((d, k) => (typeof d === 'number' ? {x: k, y: d} : d));
  const n = raw.length;
  if (n === 0) return {width: i.width, height: i.height, plot, points: [], samples: [], cum: [], total: 0, baseline: plot.y + plot.h};
  const xs = raw.map((r) => r.x);
  const ys = raw.map((r) => r.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = i.min ?? Math.min(...ys);
  const y1 = i.max ?? Math.max(...ys);
  const points: DvPoint[] = raw.map((r) => ({
    x: plot.x + (x1 === x0 ? plot.w / 2 : ((r.x - x0) / (x1 - x0)) * plot.w),
    y: plot.y + plot.h - (y1 === y0 ? 0.5 : (r.y - y0) / (y1 - y0)) * plot.h,
  }));

  let samples: DvPoint[] = points.slice();
  const increasing = points.every((p, k) => k === 0 || p.x > points[k - 1].x);
  if ((i.curve ?? 'smooth') === 'smooth' && n > 2 && increasing) {
    const S = Math.max(2, Math.round(i.samplesPerSegment ?? 14));
    const dx = points.slice(1).map((p, k) => p.x - points[k].x);
    const slope = points.slice(1).map((p, k) => (p.y - points[k].y) / dx[k]);
    const m = points.map((_, k) => (k === 0 ? slope[0] : k === n - 1 ? slope[n - 2] : slope[k - 1] * slope[k] <= 0 ? 0 : (slope[k - 1] + slope[k]) / 2));
    for (let k = 0; k < n - 1; k++) {
      // Fritsch-Carlson limiter keeps the curve monotone between points.
      if (slope[k] === 0) {
        m[k] = 0;
        m[k + 1] = 0;
      } else {
        const a = m[k] / slope[k];
        const b = m[k + 1] / slope[k];
        const s = a * a + b * b;
        if (s > 9) {
          const tau = 3 / Math.sqrt(s);
          m[k] = tau * a * slope[k];
          m[k + 1] = tau * b * slope[k];
        }
      }
    }
    samples = [points[0]];
    for (let k = 0; k < n - 1; k++) {
      for (let s = 1; s <= S; s++) {
        const t = s / S;
        const t2 = t * t;
        const t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;
        samples.push({x: points[k].x + dx[k] * t, y: h00 * points[k].y + h10 * dx[k] * m[k] + h01 * points[k + 1].y + h11 * dx[k] * m[k + 1]});
      }
    }
  }
  const cum = [0];
  for (let k = 1; k < samples.length; k++) cum.push(cum[k - 1] + Math.hypot(samples[k].x - samples[k - 1].x, samples[k].y - samples[k - 1].y));
  return {width: i.width, height: i.height, plot, points, samples, cum, total: cum[cum.length - 1] ?? 0, baseline: plot.y + plot.h};
};

/**
 * The line's px geometry for a theme: sizes are DESIGN px (scaled by the canvas unit), the same convention as
 * <LineDraw>, so a Callout can be anchored on `geometry.points[i]` of exactly what is drawn.
 * @example const g = lineLayout(theme, {data, width: 1000, height: 420, padding: 24});
 */
export const lineLayout = (theme: Theme, i: LineGeometryInput): LineGeometry => {
  const u = unit(theme);
  const pad = typeof i.padding === 'number' ? i.padding * u : i.padding ? {top: i.padding.top * u, right: i.padding.right * u, bottom: i.padding.bottom * u, left: i.padding.left * u} : undefined;
  return lineGeometry({...i, width: i.width * u, height: i.height * u, padding: pad});
};

/**
 * Point on the line at arc-length fraction `f` (0..1).
 * @example const head = pointAtFraction(geometry, 0.6)
 */
export const pointAtFraction = (g: LineGeometry, f: number): DvPoint => {
  if (g.samples.length === 0) return {x: 0, y: 0};
  if (g.samples.length === 1 || g.total === 0) return g.samples[0];
  const d = Math.min(1, Math.max(0, f)) * g.total;
  let lo = 0;
  let hi = g.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (g.cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const seg = g.cum[hi] - g.cum[lo] || 1;
  const t = (d - g.cum[lo]) / seg;
  return {x: g.samples[lo].x + (g.samples[hi].x - g.samples[lo].x) * t, y: g.samples[lo].y + (g.samples[hi].y - g.samples[lo].y) * t};
};

/**
 * The polyline from the start up to arc-length fraction `f`, ending exactly on the drawing head.
 * @example const pts = polylineUpTo(geometry, p)
 */
export const polylineUpTo = (g: LineGeometry, f: number): DvPoint[] => {
  if (g.samples.length === 0) return [];
  if (f >= 1) return g.samples;
  const d = Math.max(0, f) * g.total;
  const out: DvPoint[] = [g.samples[0]];
  for (let k = 1; k < g.samples.length; k++) {
    if (g.cum[k] <= d) out.push(g.samples[k]);
    else break;
  }
  const head = pointAtFraction(g, f);
  const last = out[out.length - 1];
  if (Math.abs(last.x - head.x) > 1e-6 || Math.abs(last.y - head.y) > 1e-6) out.push(head);
  return out;
};
