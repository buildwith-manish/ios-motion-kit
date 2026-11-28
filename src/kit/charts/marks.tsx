import React from 'react';
import {unit} from '../tokens/helpers';
import {clamp01, roleFontPx, toneColor, type Tone} from '../dataviz/common';
import {formatNumber} from '../text/format';
import {nudge1D} from '../dataviz/layout';
import {isMissing} from './stack';
import {barPath, barRects, endLabelText, growRect, lineSegments, prefixSamples, seriesPoints, type LineSegment} from './geometry';
import {chartReveal, useChart} from './Chart';
import {seriesColor} from './palette';

const pathOf = (pts: ReadonlyArray<{x: number; y: number}>): string => pts.map((q, k) => `${k === 0 ? 'M' : 'L'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join('');

/** Draws segments one after another up to arc length `len`. */
const drawnPath = (segs: LineSegment[], len: number): {d: string; head: {x: number; y: number} | null} => {
  let left = len;
  let d = '';
  let head: {x: number; y: number} | null = null;
  for (const seg of segs) {
    if (left < 0) break;
    const part = prefixSamples(seg, left);
    if (part.length > 1) d += pathOf(part);
    head = part[part.length - 1] ?? head;
    left -= seg.total;
  }
  return {d, head};
};

export interface LineMarkProps {
  curve?: 'smooth' | 'linear';
  /** Design px, scaled by the theme. Default 5. */
  stroke?: number;
  /** Dot on every data point. */
  dots?: boolean;
  /** Series name + last value at the end of each line (needs `endLabels` on <Chart> to reserve room). */
  endLabels?: boolean;
  /** Seconds between series reveals. Default 0.12. */
  stagger?: number;
  /** Which series to draw. Default all. */
  only?: readonly number[];
}

/** Multi-series line, drawn on along its arc with a head dot. Missing values break the line. */
export const LineMark: React.FC<LineMarkProps> = ({curve = 'smooth', stroke = 5, dots = false, endLabels = false, stagger = 0.12, only}) => {
  const c = useChart();
  const {theme, spec, layout} = c;
  const u = unit(theme);
  const sw = stroke * u;
  const font = roleFontPx(theme, 'caption');
  const labels: Array<{k: number; x: number; y: number; color: string; o: number}> = [];
  const els = spec.series.map((s, k) => {
    if (only && !only.includes(k)) return null;
    const color = seriesColor(theme, k, s.tone);
    const pts = seriesPoints(layout, s.values);
    const segs = lineSegments(pts, curve);
    const total = segs.reduce((m, g) => m + g.total, 0);
    const p = chartReveal(c, stagger * k);
    const {d, head} = drawnPath(segs, p * total);
    const fade = clamp01(p * 8);
    if (endLabels) {
      const last = pts.length ? [...pts].reverse().find((q) => q) : undefined;
      if (last) labels.push({k, x: last.x + 10 * u, y: last.y, color, o: clamp01((p - 0.6) / 0.4)});
    }
    return (
      <g key={`l${k}`}>
        {d ? <path d={d} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {dots ? segs.flatMap((g, gi) => g.points.map((q, qi) => <circle key={`d${gi}-${qi}`} cx={q.x} cy={q.y} r={sw * 0.7} fill={color} opacity={head && p >= 1 ? 1 : 0} />)) : null}
        {head ? <circle cx={head.x} cy={head.y} r={sw * 1.1 * fade} fill={color} stroke={theme.colors.background.base} strokeWidth={Math.max(2, sw * 0.45) * fade} /> : null}
      </g>
    );
  });
  let lab: React.ReactNode = null;
  if (labels.length) {
    const ys = nudge1D(labels.map((l) => ({center: l.y, size: font * 1.3})), {gap: 2 * u, min: layout.plot.y, max: layout.plot.y + layout.plot.h});
    lab = labels.map((l, i) => {
      const s = spec.series[l.k];
      return (
        <text key={`e${l.k}`} x={l.x} y={ys[i]} dominantBaseline="central" opacity={l.o} style={{fontFamily: theme.fonts.body, fontSize: font, fontWeight: theme.weights.bold, fill: l.color, fontVariantNumeric: 'tabular-nums'}}>
          {endLabelText(spec, s)}
        </text>
      );
    });
  }
  return <g>{els}{lab}</g>;
};

export interface AreaMarkProps {
  curve?: 'smooth' | 'linear';
  /** Top-edge opacity of the fill gradient. Default 0.35. */
  opacity?: number;
  /** Also stroke the top edge. Default true. */
  outline?: boolean;
  stagger?: number;
}

/** Area fill under each series; with `stacked` on <Chart>, bands between stacked edges. Reveals left to right. Gaps break the fill. */
export const AreaMark: React.FC<AreaMarkProps> = ({curve = 'smooth', opacity = 0.35, outline = true, stagger = 0.12}) => {
  const c = useChart();
  const {theme, spec, layout} = c;
  const u = unit(theme);
  const {plot} = layout;
  const defs: React.ReactNode[] = [];
  const els = spec.series.map((s, k) => {
    const color = seriesColor(theme, k, s.tone);
    const top = spec.stacked && layout.stack ? s.values.map((v, i) => (isMissing(v) ? null : layout.point(i, layout.stack![k][i].y1))) : seriesPoints(layout, s.values);
    const bottom = spec.stacked && layout.stack ? s.values.map((v, i) => (isMissing(v) ? null : layout.point(i, layout.stack![k][i].y0))) : s.values.map((v, i) => (isMissing(v) ? null : layout.point(i, Math.min(Math.max(0, layout.value.domain[0]), layout.value.domain[1]))));
    const topSegs = lineSegments(top, curve);
    const botSegs = lineSegments(bottom, curve);
    const p = chartReveal(c, stagger * k);
    const gid = `${c.idPrefix}-area-${k}-${Math.round(plot.y)}-${Math.round(plot.h)}`;
    const cid = `${gid}-clip`;
    defs.push(
      <linearGradient key={gid} id={gid} gradientUnits="userSpaceOnUse" x1="0" y1={plot.y} x2="0" y2={plot.y + plot.h}>
        <stop offset="0" stopColor={color} stopOpacity={opacity} />
        <stop offset="1" stopColor={color} stopOpacity={spec.stacked ? opacity * 0.6 : 0} />
      </linearGradient>,
      <clipPath key={cid} id={cid}><rect x={plot.x - 1} y={plot.y - 4 * u} width={(plot.w + 2) * p} height={plot.h + 8 * u} /></clipPath>,
    );
    return (
      <g key={`a${k}`} clipPath={`url(#${cid})`}>
        {topSegs.map((g, gi) => {
          const b = botSegs[gi];
          if (!b || g.samples.length < 2) return null;
          const d = `${pathOf(g.samples)}L${[...b.samples].reverse().map((q) => `${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join('L')}Z`;
          return (
            <g key={gi}>
              <path d={d} fill={`url(#${gid})`} stroke="none" />
              {outline ? <path d={pathOf(g.samples)} fill="none" stroke={color} strokeWidth={Math.max(1.5, 3 * u)} strokeLinejoin="round" strokeLinecap="round" /> : null}
            </g>
          );
        })}
      </g>
    );
  });
  return <g><defs>{defs}</defs>{els}</g>;
};

export interface BarMarkProps {
  /** Cap radius, design px, clamped to half the bar thickness. Default 10. */
  radius?: number;
  /** Seconds between neighbouring categories. Default 0.04. */
  stagger?: number;
  /** Seconds between series within a category. Default 0.03. */
  seriesStagger?: number;
}

/** Grouped or stacked bars (vertical or horizontal), growing from the baseline with rounded caps. Missing values draw nothing. */
export const BarMark: React.FC<BarMarkProps> = ({radius = 10, stagger = 0.04, seriesStagger = 0.03}) => {
  const c = useChart();
  const {theme, spec, layout} = c;
  const u = unit(theme);
  const rects = barRects(layout, spec);
  return (
    <g>
      {rects.map((row, k) => row.map((r, i) => {
        if (!r) return null;
        const p = chartReveal(c, i * stagger + k * seriesStagger);
        if (p <= 0) return null;
        const g = growRect(r, p);
        const color = seriesColor(theme, k, spec.series[k].tone);
        return <path key={`b${k}-${i}`} d={barPath(g, r.cap, radius * u)} fill={color} />;
      }))}
    </g>
  );
};


export interface PointMarkProps {
  /** Design px, scaled by the theme. Default 7. */
  radius?: number;
  /** Seconds between points. Default 0.05. */
  stagger?: number;
  /** Seconds between series. Default 0.1. */
  seriesStagger?: number;
  /** Stem from the baseline to each point (lollipop). Default false (dot plot). */
  stem?: boolean;
  /** Stem width, design px. Default 3. */
  stemWidth?: number;
  only?: readonly number[];
}

/** Dots at every data point (scatter / dot plot); with `stem` a lollipop. Works vertical and horizontal. Gaps draw nothing. */
export const PointMark: React.FC<PointMarkProps> = ({radius = 7, stagger = 0.05, seriesStagger = 0.1, stem = false, stemWidth = 3, only}) => {
  const c = useChart();
  const {theme, spec, layout} = c;
  const u = unit(theme);
  const zero = Math.min(Math.max(0, layout.value.domain[0]), layout.value.domain[1]);
  return (
    <g>
      {spec.series.map((s, k) => {
        if (only && !only.includes(k)) return null;
        const color = seriesColor(theme, k, s.tone);
        return s.values.map((v, i) => {
          if (isMissing(v)) return null;
          const p = chartReveal(c, k * seriesStagger + i * stagger);
          if (p <= 0) return null;
          const pt = layout.point(i, v);
          const base = layout.point(i, zero);
          const end = {x: base.x + (pt.x - base.x) * p, y: base.y + (pt.y - base.y) * p};
          return (
            <g key={`p${k}-${i}`}>
              {stem ? <line x1={base.x} y1={base.y} x2={end.x} y2={end.y} stroke={color} strokeWidth={stemWidth * u} strokeLinecap="round" /> : null}
              <circle cx={stem ? end.x : pt.x} cy={stem ? end.y : pt.y} r={radius * u * (stem ? 1 : p)} fill={color} />
            </g>
          );
        });
      })}
    </g>
  );
};

export interface RuleMarkProps {
  /** Value on the value axis. */
  value: number;
  label?: string;
  /** Append the formatted value (chart yFormat) to the label. */
  showValue?: boolean;
  tone?: Tone;
  dashed?: boolean;
  /** Seconds after the chart's start. */
  delay?: number;
}

/** Reference line across the plot with an optional label. Outside the value domain it draws nothing. */
export const RuleMark: React.FC<RuleMarkProps> = ({value, label, showValue = false, tone = 'secondary', dashed = true, delay = 0}) => {
  const c = useChart();
  const {theme, spec, layout} = c;
  const u = unit(theme);
  const [d0, d1] = layout.value.domain;
  if (value < Math.min(d0, d1) || value > Math.max(d0, d1)) return null;
  const p = chartReveal(c, delay);
  const pos = layout.value(value);
  const {plot, horizontal} = layout;
  const font = roleFontPx(theme, 'caption');
  const color = toneColor(theme, tone);
  const text = [label, showValue ? formatNumber(value, spec.yFormat ?? 'int') : ''].filter(Boolean).join(' ');
  const dash = dashed ? `${8 * u} ${8 * u}` : undefined;
  return (
    <g>
      {horizontal
        ? <line x1={pos} x2={pos} y1={plot.y} y2={plot.y + plot.h * p} stroke={color} strokeWidth={Math.max(1.5, 2.5 * u)} strokeDasharray={dash} />
        : <line x1={plot.x} x2={plot.x + plot.w * p} y1={pos} y2={pos} stroke={color} strokeWidth={Math.max(1.5, 2.5 * u)} strokeDasharray={dash} />}
      {text ? (
        <text x={horizontal ? pos + 6 * u : plot.x + plot.w} y={horizontal ? plot.y + font : pos - 6 * u} textAnchor={horizontal ? 'start' : 'end'} opacity={clamp01((p - 0.5) * 2)}
          style={{fontFamily: theme.fonts.body, fontSize: font, fontWeight: theme.weights.bold, fill: theme.colors.text.secondary, fontVariantNumeric: 'tabular-nums'}}>{text}</text>
      ) : null}
    </g>
  );
};
