# kit/charts

Composable charts: a `<Chart>` frame (thin tabular axes, faint grid, legend) and marks inside it. Everything is a pure function of `frame`; reveals use the kit's iOS springs (`start` in seconds). Data is plain JSON. Labels go through `formatNumber` presets (`yFormat`, `xFormat`). Missing values (`null`) are gaps, never 0.

Series colours, fixed order: accent, positive, warning, negative, primary, secondary (theme tokens; override per series with `tone`). Scales (`linearScale`, `bandScale`, `timeScale`) are small pure helpers, no d3.

Geometry for `<Callout>`: `chartLayout(theme, spec, w, h)` gives `plot`, `point(i, v)`; `seriesPoints(layout, values)` gives px anchors (add the chart's own offset). Sector anchors: `sectorMidpoints`.

```tsx
const x = ['2024-01-01', '2024-07-01', '2025-01-01'];
// Line (multi-series, end labels)
<Chart x={x} xType="time" legend endLabels yFormat="pct" zero={false} frame={f} start={0.5}
  series={[{name: 'Fed', values: [0.053, 0.048, 0.043]}, {name: '10-yr', values: [0.04, null, 0.045]}]}>
  <LineMark endLabels />
</Chart>
// Area (stacked via `stacked` on Chart)
<Chart x={months} stacked series={s} yFormat="usdCompact" frame={f}><AreaMark /></Chart>
// Bar: grouped, `stacked`, or orientation="horizontal"
<Chart x={states} orientation="horizontal" series={s} frame={f}><BarMark radius={10} /></Chart>
// Point / dot plot, Rule (reference line)
<Chart x={states} series={s} frame={f}><RuleMark value={82000} label="Average" showValue /><PointMark /></Chart>
// Sector (donut) with centre content
<SectorMark data={[{label: 'Housing', value: 1850}, {label: 'Food', value: 620}]} size={520} frame={f} center={<NumberText to={2470} format="usd" frame={f} />} />
// Recipes
<Waterfall items={[{label: 'Revenue', value: 1200}, {label: 'Costs', value: -700}, {label: 'Net', value: 0, total: true}]} yFormat="usdCompact" frame={f} />
<Candlestick candles={[{x: 'W1', open: 10, high: 12, low: 9, close: 11}]} variant="candle" frame={f} />   // or "ohlc"
<SlopeChart leftLabel="2020" rightLabel="2026" format="pct" items={[{name: 'CA', from: 0.1, to: 0.05}]} frame={f} />
<LollipopChart items={[{label: 'WA', value: 99000}]} orientation="horizontal" yFormat="usdCompact" frame={f} />  // stem={false} = dot plot
```

Demo: `Kit-Charts-Demo` (+ `-Vertical`, `-30fps`), sample data is illustrative.
