/** Chart recipes built on <Chart> and the marks: waterfall, candlestick/OHLC, slope chart, lollipop / dot plot. */
import React from 'react';
import {rgba} from '../tokens/color';
import {unit} from '../tokens/helpers';
import {useTheme} from '../tokens/ThemeProvider';
import {SPRING} from '../motion';
import {clamp01, roleFontPx, springProgress, textWidthPx, toneColor, type Tone} from '../dataviz/common';
import {nudge1D} from '../dataviz/layout';
import {formatNumber, resolveSpec} from '../text/format';
import {Chart, chartReveal, markOpacity, useChart, type ChartProps} from './Chart';
import {emphasisOpacity, emphasisTime, type ChartEmphasis} from './emphasis';
import {PointMark, type PointMarkProps} from './marks';
import {barPath, growRect, type BarRect} from './geometry';
import {seriesColor} from './palette';
import {candleGeometry, slopeLayout, waterfallSteps, type Candle, type SlopeItem, type WaterfallItem, type WaterfallStep} from './recipeGeometry';

type Frame = Pick<ChartProps, 'frame' | 'start' | 'response' | 'fps' | 'theme' | 'style' | 'width' | 'height' | 'idPrefix' | 'emphasis'>;

/* ---------- waterfall ---------- */
export interface WaterfallMarkProps {
  steps: readonly WaterfallStep[];
  /** Cap radius, design px. Default 8. */
  radius?: number;
  stagger?: number;
  /** Value labels above/below bars. Default true. */
  labels?: boolean;
  connectors?: boolean;
  /** Overrides the chart's emphasis for this mark. */
  emphasis?: ChartEmphasis;
}

/** Floating bars for a running total; place inside a <Chart> whose series cover every start/end. */
export const WaterfallMark: React.FC<WaterfallMarkProps> = ({steps, radius = 8, stagger = 0.08, labels = true, connectors = true, emphasis}) => {
  const c = useChart();
  const {theme, spec, layout} = c;
  const u = unit(theme);
  const font = roleFontPx(theme, 'caption');
  const yFmt = resolveSpec(spec.yFormat ?? 'int');
  const bw = layout.band.bandwidth;
  return (
    <g>
      {steps.map((s, i) => {
        const p = chartReveal(c, i * stagger);
        const a = layout.value(s.start);
        const b = layout.value(s.end);
        const x = layout.band.start(i);
        const dir = s.kind === 'down' || (s.kind === 'total' && s.end < 0) ? 'down' : 'up';
        const rect: BarRect = {x, y: Math.min(a, b), w: bw, h: Math.abs(a - b), series: 0, index: i, value: s.value, cap: dir, dir};
        const g = growRect(rect, p);
        const tone: Tone = s.kind === 'up' ? 'positive' : s.kind === 'down' ? 'negative' : 'accent';
        const next = steps[i + 1];
        const text = formatNumber(s.kind === 'total' ? s.end : s.value, s.kind === 'total' ? yFmt : {...yFmt, sign: 'always'});
        const above = dir === 'up';
        return (
          <g key={`w${i}`} opacity={markOpacity(c, {id: s.label, index: i}, emphasis)}>
            {connectors && next ? <line x1={x + bw} x2={layout.band.start(i + 1)} y1={b} y2={b} stroke={rgba(theme.colors.text.primary, 0.25)} strokeWidth={Math.max(1, 1.5 * u)} opacity={clamp01(chartReveal(c, (i + 1) * stagger))} /> : null}
            {p > 0 ? <path d={barPath(g, dir, radius * u)} fill={toneColor(theme, tone)} /> : null}
            {labels ? (
              <text x={x + bw / 2} y={above ? Math.min(a, b) - 6 * u : Math.max(a, b) + font * 1.1} textAnchor="middle" opacity={clamp01((p - 0.5) * 2)}
                style={{fontFamily: theme.fonts.body, fontSize: font, fontWeight: theme.weights.bold, fill: theme.colors.text.secondary, fontVariantNumeric: 'tabular-nums'}}>{text}</text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
};

export interface WaterfallProps extends Frame {
  items: readonly WaterfallItem[];
  /** Running total before the first item. Default 0. */
  opening?: number;
  yFormat?: ChartProps['yFormat'];
  grid?: boolean;
}

/** Waterfall: increases (positive), decreases (negative) and total bars (accent) over a running total. */
export const Waterfall: React.FC<WaterfallProps> = ({items, opening = 0, ...rest}) => {
  const steps = waterfallSteps(items, opening);
  return (
    <Chart {...rest} x={steps.map((s) => s.label)} series={[{name: 'end', values: steps.map((s) => s.end)}, {name: 'start', values: steps.map((s) => s.start)}]}>
      <WaterfallMark steps={steps} />
    </Chart>
  );
};

/* ---------- candlestick ---------- */
export interface CandleMarkProps {
  candles: readonly Candle[];
  /** 'candle' (filled bodies) or 'ohlc' (open/close ticks). Default 'candle'. */
  variant?: 'candle' | 'ohlc';
  stagger?: number;
  /** Overrides the chart's emphasis for this mark. */
  emphasis?: ChartEmphasis;
}

/** Candles or OHLC bars; up = positive, down = negative. Each grows out from its open price. */
export const CandleMark: React.FC<CandleMarkProps> = ({candles, variant = 'candle', stagger = 0.03, emphasis}) => {
  const c = useChart();
  const {theme, layout} = c;
  const u = unit(theme);
  const geo = candleGeometry(layout, candles);
  const wick = Math.max(1.5, 3 * u);
  return (
    <g>
      {geo.map((g, i) => {
        if (!g) return null;
        const p = chartReveal(c, i * stagger);
        if (p <= 0) return null;
        const col = toneColor(theme, g.up ? 'positive' : 'negative');
        const mo = markOpacity(c, {id: String(c.spec.x[i]), index: i}, emphasis);
        const at = (y: number) => g.openY + (y - g.openY) * p;
        if (variant === 'ohlc') {
          const tick = g.w / 2;
          return (
            <g key={`c${i}`} stroke={col} strokeWidth={wick} strokeLinecap="round" opacity={mo}>
              <line x1={g.x} x2={g.x} y1={at(g.wickTop)} y2={at(g.wickBottom)} />
              <line x1={g.x - tick} x2={g.x} y1={g.openY} y2={g.openY} />
              <line x1={g.x} x2={g.x + tick} y1={at(g.closeY)} y2={at(g.closeY)} />
            </g>
          );
        }
        const top = Math.min(at(g.openY), at(g.closeY));
        const h = Math.max(1, Math.abs(at(g.closeY) - at(g.openY)));
        return (
          <g key={`c${i}`} opacity={mo}>
            <line x1={g.x} x2={g.x} y1={at(g.wickTop)} y2={at(g.wickBottom)} stroke={col} strokeWidth={wick} strokeLinecap="round" />
            <rect x={g.x - g.w / 2} y={top} width={g.w} height={h} rx={Math.min(3 * u, g.w / 2, h / 2)} fill={col} />
          </g>
        );
      })}
    </g>
  );
};

export interface CandlestickProps extends Frame {
  candles: readonly Candle[];
  variant?: 'candle' | 'ohlc';
  yFormat?: ChartProps['yFormat'];
  timeLabel?: ChartProps['timeLabel'];
  xType?: ChartProps['xType'];
  grid?: boolean;
}

export const Candlestick: React.FC<CandlestickProps> = ({candles, variant, ...rest}) => (
  <Chart {...rest} x={candles.map((k) => k.x)} xType={rest.xType ?? 'band'} zero={false} series={[{name: 'High', values: candles.map((k) => k.high)}, {name: 'Low', values: candles.map((k) => k.low)}]}>
    <CandleMark candles={candles} variant={variant} />
  </Chart>
);

/* ---------- lollipop / dot plot ---------- */
export interface LollipopChartProps extends Frame, Pick<PointMarkProps, 'radius' | 'stagger' | 'stem'> {
  items: ReadonlyArray<{label: string; value: number | null}>;
  orientation?: 'vertical' | 'horizontal';
  yFormat?: ChartProps['yFormat'];
  grid?: boolean;
  /** Series name (legend/colour). */
  name?: string;
}

/** Lollipop (stem true, default) or dot plot (stem false) of one series. */
export const LollipopChart: React.FC<LollipopChartProps> = ({items, radius, stagger, stem = true, name = 'Value', ...rest}) => (
  <Chart {...rest} x={items.map((i) => i.label)} series={[{name, values: items.map((i) => i.value)}]}>
    <PointMark radius={radius} stagger={stagger} stem={stem} />
  </Chart>
);

/* ---------- slope chart ---------- */
export interface SlopeChartProps {
  items: ReadonlyArray<SlopeItem & {tone?: Tone}>;
  leftLabel: string;
  rightLabel: string;
  /** Number preset/spec for the labels. Default 'int'. */
  format?: ChartProps['yFormat'];
  width?: number;
  height?: number;
  frame?: number;
  start?: number;
  response?: number;
  fps?: number;
  /** Focus steps; items are matched by `name` (or index). */
  emphasis?: ChartEmphasis;
  theme?: ChartProps['theme'];
  style?: ChartProps['style'];
}

/** Slope chart: one line per item between two columns, labelled "Name value" at both ends, labels nudged apart. */
export const SlopeChart: React.FC<SlopeChartProps> = (props) => {
  const ctx = useTheme();
  const theme = props.theme ?? ctx;
  const u = unit(theme);
  const W = props.width ?? 1000;
  const H = props.height ?? 520;
  const font = roleFontPx(theme, 'caption');
  const fmt = props.format ?? 'int';
  const fps = props.fps ?? theme.canvas.fps;
  const w = (t: string) => textWidthPx(theme, 'caption', t, {weight: 'bold'});
  const leftT = props.items.map((i) => `${i.name} ${formatNumber(i.from, fmt)}`);
  const rightT = props.items.map((i) => `${formatNumber(i.to, fmt)} ${i.name}`);
  const padL = Math.max(0, ...leftT.map(w)) + 18 * u;
  const padR = Math.max(0, ...rightT.map(w)) + 18 * u;
  const top = font * 2.4;
  const g = slopeLayout(props.items, W, H, {padLeft: padL, padRight: padR, padTop: top, padBottom: 10 * u});
  const bounds = {min: top - font, max: H - 4 * u, gap: 2 * u};
  const ly = nudge1D(g.from.map((p) => ({center: p.y, size: font * 1.3})), bounds);
  const ry = nudge1D(g.to.map((p) => ({center: p.y, size: font * 1.3})), bounds);
  const label = (fill: string): React.CSSProperties => ({fontFamily: theme.fonts.body, fontSize: font, fontWeight: theme.weights.bold, fill, fontVariantNumeric: 'tabular-nums'});
  const head = (props.frame === undefined ? 1 : springProgress(props.frame / fps - (props.start ?? 0), props.response ?? SPRING.GENTLE));
  return (
    <div style={{position: 'relative', width: W, height: H, ...props.style}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <text x={g.leftX} y={font} textAnchor="middle" opacity={clamp01(head * 3)} style={{...label(theme.colors.text.tertiary), fontWeight: theme.weights.regular}}>{props.leftLabel}</text>
        <text x={g.rightX} y={font} textAnchor="middle" opacity={clamp01(head * 3)} style={{...label(theme.colors.text.tertiary), fontWeight: theme.weights.regular}}>{props.rightLabel}</text>
        {props.items.map((it, i) => {
          const p = props.frame === undefined ? 1 : springProgress(props.frame / fps - (props.start ?? 0) - i * 0.08, props.response ?? SPRING.GENTLE);
          const color = seriesColor(theme, i, it.tone);
          const mo = emphasisOpacity(theme, props.emphasis, emphasisTime(props.frame, fps), {id: it.name, index: i});
          const a = g.from[i];
          const b = g.to[i];
          const e = {x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p};
          return (
            <g key={`s${i}`} opacity={mo}>
              <line x1={a.x} y1={a.y} x2={e.x} y2={e.y} stroke={color} strokeWidth={Math.max(2, 4 * u)} strokeLinecap="round" />
              <circle cx={a.x} cy={a.y} r={6 * u * clamp01(p * 6)} fill={color} />
              <circle cx={e.x} cy={e.y} r={6 * u * clamp01(p * 6)} fill={color} />
              <text x={a.x - 12 * u} y={ly[i]} textAnchor="end" dominantBaseline="central" opacity={clamp01(p * 3)} style={label(theme.colors.text.secondary)}>{leftT[i]}</text>
              <text x={b.x + 12 * u} y={ry[i]} textAnchor="start" dominantBaseline="central" opacity={clamp01((p - 0.5) * 2)} style={label(theme.colors.text.secondary)}>{rightT[i]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
