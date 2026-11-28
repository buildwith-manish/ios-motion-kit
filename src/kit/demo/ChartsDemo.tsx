import React from 'react';
import {Composition, useCurrentFrame} from 'remotion';
import {CANVAS, createTheme, safeRect, textStyle, ThemeProvider, unit, type Canvas, type Theme} from '../index';
import {roleFontPx} from '../dataviz/common';
import {NumberText} from '../text';
import {
  AreaMark, BarMark, seriesColor, Candlestick, Chart, LineMark, LollipopChart, PointMark, RuleMark, SectorMark, SlopeChart, Waterfall,
} from '../charts';

/** Seconds each chart is on screen. Every chart has settled by ~2.2 s into its slot. */
export const CHARTS_SLOT = 3.2;

/** Illustrative sample data (not real figures). */
const QUARTERS = ['2024-01-01', '2024-04-01', '2024-07-01', '2024-10-01', '2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01', '2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01'];
const FED = [0.0533, 0.0533, 0.0533, 0.0483, 0.0433, 0.0433, 0.0433, 0.0408, 0.0383, 0.0383, 0.0358, 0.0333];
const TEN_YR = [0.0395, 0.0442, 0.0409, 0.0428, 0.0457, 0.0442, 0.0421, 0.0415, 0.0409, 0.0402, 0.0391, 0.0384];
const MORTGAGE = [0.0664, 0.0711, 0.0691, 0.0682, null, 0.0683, 0.0675, 0.0668, 0.0661, 0.0648, 0.0636, 0.0629];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATES = ['CA', 'TX', 'NY', 'FL', 'WA', 'OH'];
const CANDLES = [
  {x: 'W1', open: 4510, high: 4560, low: 4480, close: 4545}, {x: 'W2', open: 4545, high: 4590, low: 4520, close: 4530},
  {x: 'W3', open: 4530, high: 4545, low: 4440, close: 4455}, {x: 'W4', open: 4455, high: 4500, low: 4430, close: 4490},
  {x: 'W5', open: 4490, high: 4570, low: 4480, close: 4565}, {x: 'W6', open: 4565, high: 4640, low: 4550, close: 4625},
  {x: 'W7', open: 4625, high: 4650, low: 4560, close: 4575}, {x: 'W8', open: 4575, high: 4580, low: 4500, close: 4505},
  {x: 'W9', open: 4505, high: 4585, low: 4495, close: 4580}, {x: 'W10', open: 4580, high: 4660, low: 4575, close: 4650},
];
const BUDGET = [
  {label: 'Housing', value: 1850}, {label: 'Food', value: 620}, {label: 'Transport', value: 480}, {label: 'Savings', value: 540}, {label: 'Other', value: 410},
];

const SLIDES = ['Rates over time', 'Spending by month', 'State comparison', 'Quarterly budget', 'Budget breakdown', 'Cash waterfall', 'Weekly candles', 'Unemployment, 2020 vs 2026', 'Income per capita', 'Dot plot vs average'] as const;
export const CHARTS_SLIDE_COUNT = SLIDES.length;
export const CHARTS_DEMO_SECONDS = CHARTS_SLIDE_COUNT * CHARTS_SLOT;

export interface ChartsDemoProps {
  theme?: Theme;
}

export const ChartsDemoFrame: React.FC<ChartsDemoProps & {frame: number}> = ({frame, theme: t}) => {
  const theme = t ?? createTheme();
  const fps = theme.canvas.fps;
  const u = unit(theme);
  const slotFrames = CHARTS_SLOT * fps;
  const index = Math.min(SLIDES.length - 1, Math.floor(frame / slotFrames));
  const f = frame - index * slotFrames;
  const safe = safeRect(theme, 'title');
  const bg = theme.colors.background;
  const titleH = roleFontPx(theme, 'title') * 2.4;
  const W = safe.width;
  const H = safe.height - titleH;
  const common = {frame: f, start: 0.2, width: W, height: H, idPrefix: `kc${index}`} as const;
  const portrait = theme.canvas.height > theme.canvas.width;
  const small = Math.min(W, H);

  let body: React.ReactNode = null;
  switch (index) {
    case 0:
      body = (
        <Chart {...common} x={QUARTERS} xType="time" timeLabel="quarter" legend endLabels yFormat="pct" yTicks={4}
          series={[{name: 'Fed funds', values: FED}, {name: '10-yr', values: TEN_YR}, {name: 'Mortgage', values: MORTGAGE}]} zero={false}>
          <RuleMark value={0.05} label="Ceiling" delay={0.4} />
          <LineMark endLabels />
        </Chart>
      );
      break;
    case 1:
      body = (
        <Chart {...common} x={MONTHS} stacked legend yFormat="usdCompact"
          series={[{name: 'Housing', values: [1850, 1850, 1850, 1900, 1900, 1900, 1900, 1900, 1950, 1950, 1950, 1950]}, {name: 'Food', values: [610, 580, 640, 620, 660, 690, 700, 680, 640, 630, 660, 720]}, {name: 'Transport', values: [420, 410, 450, 480, 520, 560, 590, 570, 500, 470, 450, 440]}]}>
          <AreaMark />
        </Chart>
      );
      break;
    case 2:
      body = (
        <Chart {...common} x={STATES} orientation="horizontal" legend yFormat="usdCompact"
          series={[{name: '2025', values: [91000, 76000, 82000, 69000, 94000, 67000]}, {name: '2026', values: [95000, 79000, 85000, 72000, 99000, null]}]}>
          <BarMark />
        </Chart>
      );
      break;
    case 3:
      body = (
        <Chart {...common} x={["Q1 '26", "Q2 '26", "Q3 '26", "Q4 '26"]} stacked legend yFormat="usdCompact"
          series={[{name: 'Housing', values: [5550, 5700, 5700, 5850]}, {name: 'Food', values: [1830, 1970, 2020, 2010]}, {name: 'Refunds', values: [-300, -120, -450, -200]}]}>
          <BarMark />
        </Chart>
      );
      break;
    case 4:
      body = (
        <div style={{display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: 48 * u, width: W, height: H}}>
          <SectorMark data={BUDGET} size={small * 0.92} thickness={80} frame={f} start={0.2}
            center={<><NumberText from={0} to={3900} format="usd" frame={f} start={0.4} duration={1.2} role="number" layout="reserve" fontSize={64 * u} /><span style={{...textStyle(theme, 'caption', {color: 'tertiary'})}}>per month</span></>} />
          <div style={{display: 'flex', flexDirection: 'column', gap: 14 * u}}>
            {BUDGET.map((d, i) => (
              <div key={d.label} style={{...textStyle(theme, 'body', {color: 'primary', tabular: true}), display: 'flex', gap: 14 * u, alignItems: 'center'}}>
                <span style={{width: 18 * u, height: 18 * u, borderRadius: 9 * u, background: seriesColor(theme, i)}} />
                {d.label}
              </div>
            ))}
          </div>
        </div>
      );
      break;
    case 5:
      body = (
        <Waterfall {...common} yFormat="usdCompact" items={[
          {label: 'Revenue', value: 1200}, {label: 'Payroll', value: -540}, {label: 'Rent', value: -180}, {label: 'Marketing', value: -120},
          {label: 'Operating', value: 0, total: true}, {label: 'Tax', value: -95}, {label: 'Interest', value: 60}, {label: 'Net', value: 0, total: true},
        ]} />
      );
      break;
    case 6:
      body = <Candlestick {...common} candles={CANDLES} yFormat="int" />;
      break;
    case 7:
      body = (
        <SlopeChart width={W} height={H} frame={f} start={0.2} leftLabel="2020" rightLabel="2026" format="pct"
          items={[{name: 'CA', from: 0.103, to: 0.052}, {name: 'TX', from: 0.078, to: 0.041}, {name: 'NY', from: 0.098, to: 0.044}, {name: 'FL', from: 0.077, to: 0.032}, {name: 'WA', from: 0.075, to: 0.048}, {name: 'OH', from: 0.082, to: 0.051}]} />
      );
      break;
    case 8:
      body = <LollipopChart {...common} orientation="horizontal" name="Income" yFormat="usdCompact" items={[{label: 'WA', value: 99000}, {label: 'CA', value: 95000}, {label: 'NY', value: 85000}, {label: 'TX', value: 79000}, {label: 'FL', value: 72000}, {label: 'OH', value: 67000}]} />;
      break;
    default:
      body = (
        <Chart {...common} x={STATES} orientation="horizontal" legend zero={false} yFormat="usdCompact"
          series={[{name: '2025', values: [91000, 76000, 82000, 69000, 94000, 67000]}, {name: '2026', values: [95000, 79000, 85000, 72000, 99000, 70000]}]}>
          <RuleMark value={82000} label="Average" showValue delay={0.5} />
          <PointMark />
        </Chart>
      );
  }

  return (
    <div style={{position: 'relative', width: theme.canvas.width, height: theme.canvas.height, overflow: 'hidden', background: `linear-gradient(160deg, ${bg.lift}, ${bg.base})`}}>
      <ThemeProvider theme={theme}>
        <div style={{position: 'absolute', left: safe.left, top: safe.top, width: safe.width, height: safe.height}}>
          <div style={{...textStyle(theme, 'title', {color: 'primary'}), height: titleH}}>{SLIDES[index]}</div>
          {body}
        </div>
      </ThemeProvider>
    </div>
  );
};

export const ChartsDemo: React.FC<ChartsDemoProps> = (props) => <ChartsDemoFrame frame={useCurrentFrame()} {...props} />;

const VARIANTS: Array<{id: string; canvas: Canvas}> = [
  {id: 'Kit-Charts-Demo', canvas: CANVAS.landscape60},
  {id: 'Kit-Charts-Demo-Vertical', canvas: CANVAS.vertical60},
  {id: 'Kit-Charts-Demo-30fps', canvas: CANVAS.landscape30},
];

/** Registers the charts demo (landscape 60, vertical 60, landscape 30). @example <KitChartsCompositions /> */
export const KitChartsCompositions: React.FC = () => (
  <>
    {VARIANTS.map(({id, canvas}) => (
      <Composition key={id} id={id} component={ChartsDemo} durationInFrames={Math.round(CHARTS_DEMO_SECONDS * canvas.fps)} width={canvas.width} height={canvas.height} fps={canvas.fps} defaultProps={{theme: createTheme({canvas})}} />
    ))}
  </>
);
