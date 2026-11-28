import React from 'react';
import {unit} from '../tokens/helpers';
import {clamp01, roleFontPx, springProgress, textWidthPx, toneColor, type DvPoint, type Tone} from '../dataviz/common';
import {formatNumber, MINUS, type FormatPresetName, type FormatSpec} from '../text/format';
import {useChart} from './Chart';

export type CompareMode = 'ratio' | 'diff';

/** "2.1x" for ratio (b / a); a signed difference ("+$2,300") in `format` for diff (b - a). Null when a ratio has no sense (a is 0). */
export const compareText = (a: number, b: number, mode: CompareMode = 'ratio', format: FormatPresetName | FormatSpec = 'int', decimals: number = 1): string | null => {
  if (mode === 'diff') return formatNumber(b - a, typeof format === 'string' ? {preset: format, sign: 'always'} : {...format, sign: 'always'});
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  const r = b / a;
  const t = formatNumber(Math.abs(r), {decimals, suffix: 'x'});
  return r < 0 ? `${MINUS}${t}` : t;
};

export interface BracketGeometry {
  /** Polyline of the bracket / arrow, px. */
  path: DvPoint[];
  /** Where the text is centred. */
  label: DvPoint;
}

/**
 * Bracket (square ends) between two anchors, offset `offset` px sideways of the line a -> b (screen-up for vertical charts,
 * right for horizontal). With `arrow` the path is a plain a -> b line with the label at its middle.
 */
export const bracketGeometry = (a: DvPoint, b: DvPoint, o: {offset: number; arrow?: boolean; horizontal?: boolean}): BracketGeometry => {
  if (o.arrow) return {path: [a, b], label: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}};
  if (o.horizontal) {
    const x = Math.max(a.x, b.x) + o.offset;
    return {path: [{x: a.x, y: a.y}, {x, y: a.y}, {x, y: b.y}, {x: b.x, y: b.y}], label: {x: x + o.offset * 0.1, y: (a.y + b.y) / 2}};
  }
  const y = Math.min(a.y, b.y) - o.offset;
  return {path: [{x: a.x, y: a.y}, {x: a.x, y}, {x: b.x, y}, {x: b.x, y: b.y}], label: {x: (a.x + b.x) / 2, y: y - o.offset * 0.1}};
};

export interface CompareEnd {
  index: number;
  series?: number;
}

export interface CompareMarkerProps {
  from: CompareEnd;
  to: CompareEnd;
  mode?: CompareMode;
  /** Number format for diff text. Default: the chart's yFormat. */
  format?: FormatPresetName | FormatSpec;
  /** Replaces the computed text. */
  text?: string;
  /** 'bracket' (default) or 'arrow'. */
  shape?: 'bracket' | 'arrow';
  tone?: Tone;
  /** Gap above (or beside) the taller item, design px. Default 18. */
  offset?: number;
  /** Seconds (same clock as frame / fps). Default 0. */
  at?: number;
  response?: number;
}

/** Bracket or arrow between two items with their ratio ("2.1x") or difference ("+$2,300"). Inside <Chart>. */
export const CompareMarker: React.FC<CompareMarkerProps> = (props) => {
  const c = useChart();
  const {theme, spec, layout} = c;
  const u = unit(theme);
  const val = (e: CompareEnd): number | null => {
    const v = spec.series[e.series ?? 0]?.values[e.index];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  const a = val(props.from);
  const b = val(props.to);
  if (a === null || b === null) return null;
  const text = props.text ?? compareText(a, b, props.mode ?? 'ratio', props.format ?? spec.yFormat ?? 'int');
  if (!text) return null;
  const time = c.frame === undefined ? 1e6 : c.frame / c.fps;
  const p = springProgress(time - (props.at ?? 0), props.response ?? 0.5);
  if (p <= 0) return null;
  const pa = layout.point(props.from.index, a);
  const pb = layout.point(props.to.index, b);
  const geo = bracketGeometry(pa, pb, {offset: (props.offset ?? 18) * u, arrow: props.shape === 'arrow', horizontal: layout.horizontal});
  const font = roleFontPx(theme, 'body');
  const color = toneColor(theme, props.tone ?? 'accent');
  const d = geo.path.map((q, k) => `${k === 0 ? 'M' : 'L'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join('');
  const w = textWidthPx(theme, 'body', text, {weight: 'bold'});
  return (
    <g opacity={clamp01(p * 2)}>
      <path d={d} fill="none" stroke={color} strokeWidth={Math.max(2, 3 * u)} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(p)} />
      {props.shape === 'arrow' ? <circle cx={pb.x} cy={pb.y} r={4 * u * clamp01(p)} fill={color} /> : null}
      <rect x={geo.label.x - w / 2 - 8 * u} y={geo.label.y - font * 0.85} width={w + 16 * u} height={font * 1.7} rx={font * 0.85} fill={theme.colors.background.base} opacity={0.85} />
      <text x={geo.label.x} y={geo.label.y} textAnchor="middle" dominantBaseline="central" style={{fontFamily: theme.fonts.body, fontSize: font, fontWeight: theme.weights.bold, fill: color, fontVariantNumeric: 'tabular-nums'}}>{text}</text>
    </g>
  );
};
