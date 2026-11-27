import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme, Glass, rgba, safeRect, space, springProgress, textStyle, ThemeProvider, unit, type Canvas, type DvRect, type Theme} from '../index';
import {Callout, Delta, formatValue, LineDraw, lineLayout, Ring, ShortfallBars, Sparkline, SpringBar, Ticker, type TickerStep} from '../dataviz';

/** Demo length in seconds. */
export const DATAVIZ_DEMO_SECONDS = 10;

/** Panel ids, in layout order. */
type PanelId = 'bars' | 'vbars' | 'ring' | 'line' | 'ticker';

interface DemoLayout {
  portrait: boolean;
  pad: number;
  titleH: number;
  panels: Record<PanelId, DvRect>;
}

/**
 * Splits the canvas into six panels. Landscape: 3 columns x 2 rows inside the title-safe area. Vertical: 2 columns,
 * then a full-width chart row, inside the action-safe area (the demo is a chart sheet, not a caption).
 */
export const datavizDemoLayout = (theme: Theme): DemoLayout => {
  const portrait = theme.canvas.height > theme.canvas.width;
  const safe = safeRect(theme, 'title');
  const gap = space(theme, 6);
  const at = (x: number, y: number, w: number, h: number): DvRect => ({x: safe.left + x, y: safe.top + y, w, h});
  if (!portrait) {
    const cw = (safe.width - 2 * gap) / 3;
    const rh = (safe.height - gap) / 2;
    return {
      portrait, pad: space(theme, 6), titleH: space(theme, 12),
      panels: {
        bars: at(0, 0, cw, rh),
        vbars: at(cw + gap, 0, cw, rh),
        ring: at(2 * (cw + gap), 0, cw, rh),
        line: at(0, rh + gap, 2 * cw + gap, rh),
        ticker: at(2 * (cw + gap), rh + gap, cw, rh),
      },
    };
  }
  const cw = (safe.width - gap) / 2;
  const r0 = safe.height * 0.27;
  const r1 = safe.height * 0.36;
  const r2 = safe.height - r0 - r1 - 2 * gap;
  return {
    portrait, pad: space(theme, 6), titleH: space(theme, 12),
    panels: {
      bars: at(0, 0, cw, r0),
      vbars: at(cw + gap, 0, cw, r0),
      ring: at(0, r0 + gap, cw, r1),
      ticker: at(cw + gap, r0 + gap, cw, r1),
      line: at(0, r0 + r1 + 2 * gap, safe.width, r2),
    },
  };
};

const TITLES: Record<PanelId, string> = {
  bars: 'SPRINGBAR  NEEDED VS EARNED',
  vbars: 'SPRINGBAR  VERTICAL',
  ring: 'RING + DELTA',
  line: 'LINEDRAW + CALLOUT',
  ticker: 'TICKER  FLIP RE-RANK',
};

/** Inner content rectangle of a panel (inside padding and under the title). */
const inner = (L: DemoLayout, id: PanelId): DvRect => {
  const p = L.panels[id];
  return {x: p.x + L.pad, y: p.y + L.pad + L.titleH, w: p.w - 2 * L.pad, h: p.h - 2 * L.pad - L.titleH};
};

const place = (r: DvRect): React.CSSProperties => ({position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h});

/** Sample series for the line (generic weekly values). */
const LINE_DATA = [2100, 2350, 2300, 2900, 2750, 3300, 3150, 3900, 3700, 4400, 4250, 4900];
const SPARK_DATA = [4, 6, 5, 9, 8, 12];

/**
 * Sample ranking for the Ticker: first list at 1.0 s, a re-rank at 4.5 s (Birch overtakes two rows), then at 7.0 s
 * Ember replaces Dune while Cedar and Alder swap.
 */
const TICKER_STEPS: TickerStep[] = [
  {at: 1.0, rows: [
    {id: 'alder', label: 'Alder', value: 4200, prefix: '$'},
    {id: 'cedar', label: 'Cedar', value: 3900, prefix: '$'},
    {id: 'dune', label: 'Dune', value: 3400, prefix: '$'},
    {id: 'birch', label: 'Birch', value: 2900, prefix: '$'},
  ]},
  {at: 4.5, rows: [
    {id: 'birch', label: 'Birch', value: 4600, prefix: '$'},
    {id: 'alder', label: 'Alder', value: 4300, prefix: '$'},
    {id: 'cedar', label: 'Cedar', value: 3950, prefix: '$'},
    {id: 'dune', label: 'Dune', value: 3400, prefix: '$'},
  ]},
  {at: 7.0, rows: [
    {id: 'birch', label: 'Birch', value: 4700, prefix: '$'},
    {id: 'cedar', label: 'Cedar', value: 4500, prefix: '$'},
    {id: 'alder', label: 'Alder', value: 4300, prefix: '$'},
    {id: 'ember', label: 'Ember', value: 3600, prefix: '$'},
  ]},
];

/** Props for {@link DatavizDemoFrame}. */
export interface DatavizDemoProps {
  /** Theme (default: createTheme() = midnight at 1920x1080@60). */
  theme?: Theme;
}

/** Pure demo frame: every dataviz primitive on sample data. Takes `frame`; reads no hooks. */
export const DatavizDemoFrame: React.FC<DatavizDemoProps & {frame: number}> = ({frame, theme: themeProp}) => {
  const theme = themeProp ?? createTheme();
  const {width, height, fps} = theme.canvas;
  const u = unit(theme);
  const L = datavizDemoLayout(theme);
  const bg = theme.colors.background;
  const tint = theme.colors.tint;
  const t = frame / fps;
  const ids = Object.keys(L.panels) as PanelId[];

  const bars = inner(L, 'bars');
  const vbars = inner(L, 'vbars');
  const line = inner(L, 'line');
  const lineW = line.w / u;
  const lineH = Math.min(line.h / u, L.portrait ? 420 : 340);
  // Same geometry LineDraw itself computes (same width/height/padding), so the Callout anchors land exactly
  // on the drawn line's own points: a peak mid-series and the latest value.
  const lineGeom = lineLayout(theme, {data: LINE_DATA, width: lineW, height: lineH, padding: Math.ceil(8 * 1.8)});
  const peakIdx = LINE_DATA.reduce((best, v, idx) => (v > LINE_DATA[best] ? idx : best), 0);
  const lastIdx = LINE_DATA.length - 1;
  const tick = inner(L, 'ticker');
  const ring = inner(L, 'ring');
  const ringSize = L.portrait ? 250 : 250;
  const vLen = Math.max(120, Math.min(190, vbars.h / u - 150));

  return (
    <div style={{position: 'relative', width, height, overflow: 'hidden', background: `linear-gradient(160deg, ${bg.lift}, ${bg.base} 55%, ${bg.deep})`}}>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(60% 50% at 18% 22%, ${rgba(tint.a, 0.28)}, transparent 70%), radial-gradient(55% 45% at 85% 80%, ${rgba(tint.b, 0.26)}, transparent 70%)`}} />
      <ThemeProvider theme={theme}>
        {ids.map((id, i) => {
          const p = L.panels[id];
          const enter = springProgress(t - (0.15 + i * 0.07), 0.5);
          return (
            <React.Fragment key={id}>
              <Glass tier="card" radius="xl" style={{position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h, opacity: enter}} />
              <div style={{position: 'absolute', left: p.x + L.pad, top: p.y + L.pad, opacity: enter, ...textStyle(theme, 'caption', {color: 'tertiary', weight: 'bold'}), whiteSpace: 'nowrap'}}>{TITLES[id]}</div>
            </React.Fragment>
          );
        })}

        <div style={place(bars)}>
          <ShortfallBars frame={frame} start={0.7} length={Math.min(460, bars.w / u - 8)} data={{needed: {label: 'Needed', value: 4200}, earned: {label: 'Earned', value: 3150}, prefix: '$'}} />
        </div>

        <div style={{...place(vbars), display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: space(theme, 4)}}>
          {[
            {label: 'Mon', value: 2800},
            {label: 'Tue', value: 3600},
            {label: 'Wed', value: 3150, target: 4200, targetLabel: 'Goal'},
          ].map((d, i) => (
            <SpringBar key={d.label} frame={frame} start={0.9 + i * 0.1} orientation="vertical" length={vLen} max={4200} nameRole="caption" valueRole={L.portrait ? 'caption' : 'body'} data={{...d, prefix: '$'}} />
          ))}
        </div>

        <div style={{...place(ring), display: 'flex', flexDirection: L.portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: space(theme, L.portrait ? 4 : 6)}}>
          <Ring frame={frame} start={1.1} size={ringSize} data={{value: 72, suffix: '%', label: 'Funded'}} />
          <div style={{display: 'flex', flexDirection: L.portrait ? 'row' : 'column', alignItems: 'center', gap: space(theme, 3)}}>
            <div style={{display: 'flex', flexDirection: L.portrait ? 'row' : 'column', gap: space(theme, 3)}}>
              <Delta frame={frame} start={2.0} data={{from: 3150, to: 3540}} />
              <Delta frame={frame} start={2.2} data={{value: -3.1, suffix: '%', decimals: 1}} />
            </div>
            <Sparkline frame={frame} start={1.5} width={L.portrait ? 150 : 210} height={L.portrait ? 80 : 90} data={SPARK_DATA} />
          </div>
        </div>
        <div style={place(line)}>
          <LineDraw frame={frame} start={1.3} width={lineW} height={lineH} grid={4} data={LINE_DATA} />
          <Callout
            frame={frame}
            start={2.8}
            width={lineGeom.width}
            height={lineGeom.height}
            data={[
              {at: lineGeom.points[peakIdx], text: 'Best week', tone: 'positive', delay: 0},
              {at: lineGeom.points[lastIdx], text: `Latest ${formatValue(LINE_DATA[lastIdx], {prefix: '$'})}`, tone: 'accent', delay: 0.18},
            ]}
          />
        </div>

        <div style={place(tick)}>
          <Ticker frame={frame} width={tick.w / u} rowHeight={L.portrait ? 68 : 76} rowGap={10} highlight="birch" data={TICKER_STEPS} />
        </div>
      </ThemeProvider>
    </div>
  );
};

/** Remotion wrapper: reads the frame once, here, and passes it down. */
export const DatavizDemo: React.FC<DatavizDemoProps> = (props) => <DatavizDemoFrame frame={useCurrentFrame()} {...props} />;

const VARIANTS: Array<{id: string; canvas: Canvas}> = [
  {id: 'Kit-Dataviz-Demo', canvas: CANVAS.landscape60},
  {id: 'Kit-Dataviz-Demo-Vertical', canvas: CANVAS.vertical60},
  {id: 'Kit-Dataviz-Demo-30fps', canvas: CANVAS.landscape30},
];

/**
 * Registers the dataviz demo compositions (landscape 60, vertical 60, landscape 30).
 * @example <KitDatavizCompositions />
 */
export const KitDatavizCompositions: React.FC = () => (
  <>
    {VARIANTS.map(({id, canvas}) => (
      <Composition key={id} id={id} component={DatavizDemo} durationInFrames={DATAVIZ_DEMO_SECONDS * canvas.fps} width={canvas.width} height={canvas.height} fps={canvas.fps} defaultProps={{theme: createTheme({canvas})}} />
    ))}
  </>
);
