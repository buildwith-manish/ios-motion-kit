/** Pure geometry for the sector mark and the chart recipes (waterfall, candlestick, slope). */
import type {DvPoint} from '../dataviz/common';
import {isMissing} from './stack';
import type {ChartLayout} from './geometry';
import {linearScale, niceDomain} from './scales';

/* ---------- sector (donut) ---------- */
export interface SectorAngle {
  index: number;
  /** Degrees clockwise from 12 o'clock. */
  start: number;
  end: number;
  mid: number;
  frac: number;
  value: number;
}

/**
 * Angles of a multi-segment donut. Values <= 0 or missing get no sector. Gaps (degrees) sit after each sector;
 * a single sector has no gap. Spans + gaps always add up to `sweepDeg` (default 360).
 */
export const sectorAngles = (values: ReadonlyArray<number | null>, o: {startDeg?: number; gapDeg?: number; sweepDeg?: number} = {}): SectorAngle[] => {
  const sweep = o.sweepDeg ?? 360;
  const vs = values.map((v) => (isMissing(v) || v <= 0 ? 0 : v));
  const total = vs.reduce((m, v) => m + v, 0);
  const count = vs.filter((v) => v > 0).length;
  if (total <= 0) return [];
  const gap = count > 1 ? Math.min(o.gapDeg ?? 0, sweep / count / 2) : 0;
  const usable = sweep - gap * count;
  let a = o.startDeg ?? 0;
  const out: SectorAngle[] = [];
  vs.forEach((v, index) => {
    if (v <= 0) return;
    const span = (v / total) * usable;
    out.push({index, start: a, end: a + span, mid: a + span / 2, frac: v / total, value: v});
    a += span + gap;
  });
  return out;
};

export const polar = (cx: number, cy: number, r: number, deg: number): DvPoint => ({x: cx + r * Math.sin((deg * Math.PI) / 180), y: cy - r * Math.cos((deg * Math.PI) / 180)});

/** Donut segment path between two angles (degrees clockwise from the top). */
export const arcPath = (cx: number, cy: number, ro: number, ri: number, a0: number, a1: number): string => {
  const end = Math.min(a1, a0 + 359.99);
  const large = end - a0 > 180 ? 1 : 0;
  const p = (r: number, a: number) => {
    const q = polar(cx, cy, r, a);
    return `${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
  };
  return `M${p(ro, a0)}A${ro.toFixed(2)} ${ro.toFixed(2)} 0 ${large} 1 ${p(ro, end)}L${p(ri, end)}A${ri.toFixed(2)} ${ri.toFixed(2)} 0 ${large} 0 ${p(ri, a0)}Z`;
};

/* ---------- waterfall ---------- */
export interface WaterfallItem {
  label: string;
  /** Change (ignored when `total`). */
  value: number;
  /** A subtotal/total bar from 0 to the running total so far. */
  total?: boolean;
}
export interface WaterfallStep {
  label: string;
  start: number;
  end: number;
  running: number;
  kind: 'up' | 'down' | 'total';
  /** The change, or the running total for a total bar. */
  value: number;
}

export const waterfallSteps = (items: readonly WaterfallItem[], opening: number = 0): WaterfallStep[] => {
  let run = opening;
  return items.map((it) => {
    if (it.total) return {label: it.label, start: 0, end: run, running: run, kind: 'total' as const, value: run};
    const start = run;
    run += it.value;
    return {label: it.label, start, end: run, running: run, kind: it.value >= 0 ? ('up' as const) : ('down' as const), value: it.value};
  });
};

/* ---------- candlestick / OHLC ---------- */
export interface Candle {
  x: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
}
export interface CandleGeom {
  index: number;
  x: number;
  up: boolean;
  openY: number;
  closeY: number;
  wickTop: number;
  wickBottom: number;
  bodyTop: number;
  bodyH: number;
  /** Body width px. */
  w: number;
}

/** Candle geometry on a vertical chart layout. Rows with a missing field are skipped (null). high/low are widened to cover open/close. */
export const candleGeometry = (layout: ChartLayout, candles: readonly Candle[], bodyFrac: number = 0.6): Array<CandleGeom | null> => {
  const slot = layout.band.bandwidth || layout.plot.w / Math.max(1, candles.length);
  return candles.map((c, index) => {
    if ([c.open, c.high, c.low, c.close].some((v) => isMissing(v))) return null;
    const hi = Math.max(c.high, c.open, c.close);
    const lo = Math.min(c.low, c.open, c.close);
    const openY = layout.value(c.open);
    const closeY = layout.value(c.close);
    return {index, x: layout.catPos(index), up: c.close >= c.open, openY, closeY, wickTop: layout.value(hi), wickBottom: layout.value(lo), bodyTop: Math.min(openY, closeY), bodyH: Math.max(1, Math.abs(openY - closeY)), w: slot * bodyFrac};
  });
};

/* ---------- slope chart ---------- */
export interface SlopeItem {
  name: string;
  from: number;
  to: number;
}
export interface SlopeLayout {
  domain: [number, number];
  leftX: number;
  rightX: number;
  from: DvPoint[];
  to: DvPoint[];
}

/** Two columns, one line per item, shared nice value scale (not forced to include 0). */
export const slopeLayout = (items: readonly SlopeItem[], width: number, height: number, o: {padLeft: number; padRight: number; padTop: number; padBottom: number}): SlopeLayout => {
  const all = items.flatMap((i) => [i.from, i.to]).filter((v) => !isMissing(v));
  const domain = all.length ? niceDomain(Math.min(...all), Math.max(...all), 4) : ([0, 1] as [number, number]);
  const y = linearScale(domain, [height - o.padBottom, o.padTop]);
  const leftX = o.padLeft;
  const rightX = Math.max(o.padLeft + 1, width - o.padRight);
  return {domain, leftX, rightX, from: items.map((i) => ({x: leftX, y: y(i.from)})), to: items.map((i) => ({x: rightX, y: y(i.to)}))};
};
