import React from 'react';
import type {CSSProperties} from 'react';
import {rgba} from '../tokens/color';
import {unit} from '../tokens/helpers';
import {useTheme} from '../tokens/ThemeProvider';
import type {Theme} from '../tokens/types';
import {clamp01, resolveProgress, toneColor, type Timing, type Tone} from './common';
import {lineLayout, pointAtFraction, polylineUpTo, type LineGeometryInput, type LinePoint} from './linePath';

/** Props for {@link LineDraw}. Sizes are design px (scaled to the canvas by the theme). */
export interface LineDrawProps extends Timing {
  /** Plain-JSON series: numbers (evenly spaced) or {x, y} pairs. */
  data: readonly LinePoint[];
  /** Width. Default 1100. */
  width?: number;
  /** Height. Default 420. */
  height?: number;
  /** Line thickness. Default 8. */
  stroke?: number;
  /** Line colour. Default 'accent'. */
  tone?: Tone;
  /** Soft gradient area under the line. Default true. */
  area?: boolean;
  /** Peak opacity of the area gradient (fades to 0 at the baseline). Default 0.3. */
  areaOpacity?: number;
  /** Dot on the drawing head, which is the end point once drawn. Default true. */
  endDot?: boolean;
  /** Number of faint horizontal grid lines (0 = none). Default 0. */
  grid?: number;
  /** Plot inset in design px: one number or per side. Default: enough room for the stroke and dot. */
  padding?: LineGeometryInput['padding'];
  min?: number;
  max?: number;
  /** 'smooth' (monotone cubic, default) or 'linear'. */
  curve?: 'smooth' | 'linear';
  /** Id prefix for the SVG gradient; set it if two lines with the same tone and size must differ. */
  idPrefix?: string;
  theme?: Theme;
  style?: CSSProperties;
}

/**
 * Line that draws on along its path, with a rounded stroke, an end-point dot riding the tip and a soft area fill
 * that reveals with it. The line is an exact polyline prefix, so the dot and fill edge are always on the tip.
 * Draw-on runs on an iOS spring (default response 1.0 s). Pure: a function of `progress` or `frame` + `start`.
 *
 * @example
 * <LineDraw frame={frame} start={1.2} width={1100} height={420} data={[3, 5, 4, 8, 7, 11]} />
 */
export const LineDraw: React.FC<LineDrawProps> = (props) => {
  const ctx = useTheme();
  const theme = props.theme ?? ctx;
  const u = unit(theme);
  const p = resolveProgress(props, theme, props.response ?? 1.0);
  const width = props.width ?? 1100;
  const height = props.height ?? 420;
  const stroke = (props.stroke ?? 8) * u;
  const dotR = stroke * 1.15;
  const pad = props.padding ?? Math.ceil((props.stroke ?? 8) * 1.8);
  const g = lineLayout(theme, {data: props.data, width, height, padding: pad, min: props.min, max: props.max, curve: props.curve});
  const color = toneColor(theme, props.tone ?? 'accent');
  const col = theme.colors;
  const W = g.width;
  const H = g.height;
  const pts = polylineUpTo(g, p);
  const head = pointAtFraction(g, p);
  const gid = `${props.idPrefix ?? 'kit-dv-area'}-${props.tone ?? 'accent'}-${Math.round(g.plot.y)}-${Math.round(g.plot.h)}`;
  const d = pts.map((q, k) => `${k === 0 ? 'M' : 'L'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(' ');
  const areaD = pts.length > 1 ? `${d} L${head.x.toFixed(2)} ${g.baseline.toFixed(2)} L${pts[0].x.toFixed(2)} ${g.baseline.toFixed(2)} Z` : '';
  const grid = Math.max(0, Math.round(props.grid ?? 0));
  const fade = clamp01(p * 8);

  return (
    <div style={{position: 'relative', width: W, height: H, ...props.style}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <defs>
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1={g.plot.y} x2="0" y2={g.baseline}>
            <stop offset="0" stopColor={color} stopOpacity={props.areaOpacity ?? 0.3} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {Array.from({length: grid}, (_, k) => {
          const y = grid === 1 ? g.baseline : g.plot.y + (g.plot.h * k) / (grid - 1);
          return <line key={k} x1={g.plot.x} x2={g.plot.x + g.plot.w} y1={y} y2={y} stroke={rgba(col.text.primary, 0.08)} strokeWidth={Math.max(1, 2 * u)} strokeLinecap="round" />;
        })}
        {props.area !== false && areaD ? <path d={areaD} fill={`url(#${gid})`} stroke="none" /> : null}
        {pts.length > 1 ? <path d={d} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {props.endDot !== false && g.samples.length > 0 ? (
          <circle cx={head.x} cy={head.y} r={dotR * fade} fill={color} stroke={col.background.base} strokeWidth={Math.max(2, stroke * 0.45) * fade} />
        ) : null}
      </svg>
    </div>
  );
};

/** Props for {@link Sparkline}: LineDraw with small-multiples defaults. */
export type SparklineProps = LineDrawProps;

/**
 * Compact LineDraw for rows, cards and tickers: 360 x 120, thin stroke, no grid. Same props as {@link LineDraw}.
 * @example <Sparkline frame={frame} start={0.8} data={[4, 6, 5, 9, 8, 12]} />
 */
export const Sparkline: React.FC<SparklineProps> = (props) => <LineDraw width={360} height={120} stroke={5} {...props} />;
