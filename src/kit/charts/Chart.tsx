import React, {createContext, useContext} from 'react';
import type {CSSProperties} from 'react';
import {SPRING} from '../motion';
import {rgba} from '../tokens/color';
import {useTheme} from '../tokens/ThemeProvider';
import {unit} from '../tokens/helpers';
import type {Theme} from '../tokens/types';
import {clamp01, roleFontPx, springProgress, textWidthPx} from '../dataviz/common';
import {chartLayout, type ChartLayout, type ChartSpec} from './geometry';
import {seriesColor} from './palette';

export interface ChartContextValue {
  theme: Theme;
  spec: ChartSpec;
  layout: ChartLayout;
  /** Current frame; undefined draws everything settled. */
  frame?: number;
  /** Second the first reveal begins. */
  start: number;
  fps: number;
  response: number;
  idPrefix: string;
}

const ChartContext = createContext<ChartContextValue | null>(null);

export const useChart = (): ChartContextValue => {
  const c = useContext(ChartContext);
  if (!c) throw new Error('kit/charts marks must be rendered inside <Chart>');
  return c;
};

/** Spring progress 0..1 of a reveal that starts `delay` seconds after the chart's `start`. */
export const chartReveal = (c: Pick<ChartContextValue, 'frame' | 'start' | 'fps' | 'response'>, delay: number = 0): number =>
  c.frame === undefined ? 1 : springProgress(c.frame / c.fps - c.start - delay, c.response);

export interface ChartProps extends ChartSpec {
  /** Canvas px. Default 1000 x 520. */
  width?: number;
  height?: number;
  frame?: number;
  /** Seconds. */
  start?: number;
  response?: number;
  fps?: number;
  /** Faint value grid. Default true. */
  grid?: boolean;
  idPrefix?: string;
  theme?: Theme;
  style?: CSSProperties;
  children?: React.ReactNode;
}

/**
 * Minimal iOS-style chart frame: thin tabular axis labels, optional faint grid, legend, and a context for the marks.
 * Put <LineMark/>, <AreaMark/>, <BarMark/> ... inside. The same ChartSpec passed to chartLayout() gives the px
 * geometry (offset by the chart's own position) for <Callout> anchors.
 * @example <Chart x={['Q1','Q2','Q3']} series={[{name: 'Rate', values: [4.1, 4.4, 4.2]}]} yFormat="pct" frame={frame} start={0.5}><LineMark /></Chart>
 */
export const Chart: React.FC<ChartProps> = (props) => {
  const ctxTheme = useTheme();
  const theme = props.theme ?? ctxTheme;
  const u = unit(theme);
  const W = props.width ?? 1000;
  const H = props.height ?? 520;
  const spec: ChartSpec = props;
  const layout = chartLayout(theme, spec, W, H);
  const fps = props.fps ?? theme.canvas.fps;
  const value: ChartContextValue = {theme, spec, layout, frame: props.frame, start: props.start ?? 0, fps, response: props.response ?? SPRING.GENTLE, idPrefix: props.idPrefix ?? 'kc'};
  const p = chartReveal(value, 0);
  const fade = clamp01(p * 3);
  const col = theme.colors;
  const font = roleFontPx(theme, 'caption');
  const {plot, horizontal} = layout;
  const label: CSSProperties = {fontFamily: theme.fonts.body, fontSize: font, fontWeight: theme.weights.regular, fill: col.text.tertiary, fontVariantNumeric: 'tabular-nums'};
  const gridStroke = rgba(col.text.primary, 0.08);
  const hair = Math.max(1, 1.5 * u);
  const showGrid = props.grid !== false;

  let lx = plot.x;
  const legend = props.legend
    ? props.series.map((s, k) => {
        const x = lx;
        lx += font * 0.9 + textWidthPx(theme, 'caption', s.name) + font * 1.6;
        return (
          <g key={`lg${k}`}>
            <circle cx={x + font * 0.3} cy={font * 1.1} r={font * 0.3} fill={seriesColor(theme, k, s.tone)} />
            <text x={x + font * 0.9} y={font * 1.1} dominantBaseline="central" style={{...label, fill: col.text.secondary}}>{s.name}</text>
          </g>
        );
      })
    : null;

  return (
    <ChartContext.Provider value={value}>
      <div style={{position: 'relative', width: W, height: H, ...props.style}}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          <g opacity={fade}>
            {layout.valueTicks.map((t, k) => {
              const isZero = t.v === 0;
              const stroke = isZero ? rgba(col.text.primary, 0.18) : gridStroke;
              return (
                <g key={`v${k}`}>
                  {showGrid || isZero ? (horizontal
                    ? <line x1={t.pos} x2={t.pos} y1={plot.y} y2={plot.y + plot.h} stroke={stroke} strokeWidth={hair} />
                    : <line x1={plot.x} x2={plot.x + plot.w} y1={t.pos} y2={t.pos} stroke={stroke} strokeWidth={hair} />) : null}
                  {horizontal
                    ? <text x={t.pos} y={plot.y + plot.h + font * 1.5} textAnchor="middle" style={label}>{t.label}</text>
                    : <text x={plot.x - 8 * u} y={t.pos} textAnchor="end" dominantBaseline="central" style={label}>{t.label}</text>}
                </g>
              );
            })}
            {layout.catTicks.map((t, k) =>
              horizontal
                ? <text key={`c${k}`} x={plot.x - 10 * u} y={t.pos} textAnchor="end" dominantBaseline="central" style={label}>{t.label}</text>
                : <text key={`c${k}`} x={t.pos} y={plot.y + plot.h + font * 1.5} textAnchor="middle" style={label}>{t.label}</text>,
            )}
            {legend}
          </g>
          {props.children}
        </svg>
      </div>
    </ChartContext.Provider>
  );
};
