# kit/dataviz

Data visualisation for video: bars, rings, re-ranking lists, lines, change chips and annotations, all as pure
functions of a frame number. Every size is in **design px** (scaled to the canvas by the theme) except `<Callout>`,
which attaches to points other primitives already placed and so works in the same canvas px those use. Colours only
come from the theme (`Tone`: accent/positive/negative/warning/primary/secondary/tertiary); every primitive takes a
plain-JSON `data` prop so a video can feed it straight from a CSV/JSON file (`csvToRows`/`columnNumbers`). Nothing
reads the Remotion clock; animate by passing `frame` + `start` (seconds) or an explicit `progress` (0..1), both on
an iOS spring. Defaults are 1920x1080 @ 60 fps; everything also works at 1080x1920 and at 30 fps.

```tsx
import {SpringBar, ShortfallBars, Ring, Delta, Ticker, LineDraw, Callout, createTheme, CANVAS, ThemeProvider} from '../kit';

const theme = createTheme({canvas: CANVAS.landscape60}); // or CANVAS.vertical60 / landscape30
export const Scene: React.FC<{frame: number}> = ({frame}) => (
  <ThemeProvider theme={theme}>
    <ShortfallBars frame={frame} start={0.4} length={500} data={{needed: {label: 'Needed', value: 4200}, earned: {label: 'Earned', value: 3150}, prefix: '$'}} />
    <Ring frame={frame} start={1.0} size={280} data={{value: 72, suffix: '%', label: 'Funded'}} />
    <Delta frame={frame} start={1.6} data={{from: 3150, to: 3540}} />
    <LineDraw frame={frame} start={1.2} width={900} height={360} data={[2100, 2900, 2750, 4900]} />
    <Ticker frame={frame} width={480} rowHeight={72} data={rankSteps} />
  </ThemeProvider>
);
```

## API

| Export | What | Key props (defaults) |
| --- | --- | --- |
| `<SpringBar>` | Horizontal or vertical bar that grows to a value on an iOS spring: rounded caps (never thinner than one cap, min thickness 56 px), label, rolling value, optional target marker with a shortfall fill + label beyond the tip. | `data` (`{label, value, target?, max?, tone?, targetLabel?, shortfallLabel?}` + `NumberFormat`), `frame`/`start`, `orientation` ('horizontal'), `length` (track px), `thickness`/`minThickness` (56), `max`, `nameRole`/`valueRole`, `showName`/`showValue` |
| `<ShortfallBars>` | The "needed vs earned" pair: two `<SpringBar>`s sharing a `max`, the second carrying its shortfall to the first as `target`. | `data` (`{needed: BarData, earned: BarData, ...NumberFormat}`), plus `SpringBar`'s layout props |
| `<Ring>` | Progress ring: rounded caps, soft track, centre value that rolls up with the arc (shrunk to fit the hole). | `data` (`{value, max? (100), label?, tone?}` + `NumberFormat`), `frame`/`start`, `size` (320), `stroke` (28), `startAngle` (-90), `clockwise` (true), `showValue` (true), `children` (replaces the centre) |
| `<Ticker>` | Ranked list that FLIPs to a new order on an iOS spring — rows slide to their new slot (never teleport), values roll, new rows wait 0.12 s and fade in, leaving rows fade out faster. Continues correctly if re-ranked again mid-flight. | `data` (`TickerStep[]`: `{at (s), rows: {id, label, value, ...NumberFormat}[]}`), `frame`/`time`/`progress`, `width` (560), `rowHeight` (76), `rowGap` (10), `response` (0.6), `highlight` (an id to accent) |
| `<LineDraw>` | Line that draws on along its path (exact polyline prefix, so the tip is always correct): rounded stroke, end-point dot riding the tip, soft gradient area fill, optional grid. | `data` (`(number \| {x,y})[]`), `frame`/`start`, `width` (1100), `height` (420), `stroke` (8), `tone` ('accent'), `area` (true), `endDot` (true), `grid` (0), `curve` ('smooth': monotone cubic, never overshoots) |
| `<Sparkline>` | `<LineDraw>` with small-multiples defaults (360x120, thin stroke, no grid) for rows/cards/tickers. | Same props as `<LineDraw>` |
| `<Delta>` | Up/down change chip: arrow slides in the direction of the change, number rolls, theme positive/negative colour (`invert` for lower-is-better metrics). Width is fixed from the final number so nothing jitters while it rolls. | `data` (`{value?, from?, to?, mode? ('percent'), invert?}` + `NumberFormat`), `frame`/`start`, `scale` (1), `solid` (false), `showSign` (false) |
| `<Callout>` | Annotation that attaches to any point: a dot on the anchor, a leader line that draws out to a glass label, popping in on an iOS spring. A group of callouts is nudged apart (and off each other's dots) so labels never overlap. **`width`/`height`/`at` are canvas px** — the space `lineLayout`'s points, a bar's `DvRect`, etc. already use. | `data` (one `CalloutData` or an array: `{at: {x,y}, text, tone?, side? ('auto'), delay?}`), `frame`/`start`/`progress`, `width`, `height`, `leaderLength` (36), `gap` (8), `dotRadius` (5) |
| `layoutBar`, `barFrameAt` | Pure geometry/frame-state behind `<SpringBar>`. | |
| `tickerStateAt`, `tickerEndTime` | Pure FLIP state behind `<Ticker>`: row rects, rank, rolling value, enter/exit, at any frame. | |
| `lineGeometry`, `lineLayout`, `pointAtFraction`, `polylineUpTo` | Pure geometry behind `<LineDraw>`. `lineLayout(theme, input)` returns canvas-px points — anchor a `<Callout>` on `geometry.points[i]`. | |
| `resolveDelta` | Pure data -> `{value, direction, tone, format}` behind `<Delta>`. | |
| `layoutCallout` | Pure geometry (incl. the collision nudge) behind `<Callout>`. | |
| `toneColor`, `onToneColor`, `formatValue`, `pickFormat`, `textWidthPx`, `fitWidth`, `resolveProgress`, `springProgress` | Shared theme/number/measuring/timing helpers every primitive above is built from. | |
| `nudge1D`, `nudgeRects`, `anyOverlap` | Label collision helpers: `nudge1D` for labels on one line (bar footers), `nudgeRects` for free 2D labels (`<Callout>`). | |
| `csvToRows`, `columnNumbers` | Parse a CSV string into `data` rows / pull one numeric column, so a video can feed any primitive from a file. | |
| `useSpringProgress` | Thin optional hook: reads the current frame for you and returns spring progress. The primitives themselves never call it. | `startSeconds`, `response` |

## Timing

Every primitive (except `<Ticker>`, which has its own per-step timeline, and `<Callout>`, which adds a per-item
`delay`) accepts the same `Timing`: give `progress` directly, or `frame` + `start` (+ optional `response`/`fps`) to
animate on `iosSpring` from `start` seconds. With neither, it draws settled.

## Collision avoidance

Bar footer labels (target / shortfall) use `nudge1D` so they never overlap along the bar's own axis. `<Callout>`
groups use `nudgeRects` over every label **and** every anchor dot (as a fixed obstacle), so a label can land on
whichever side has the most room and still never cover a neighbour or a dot it doesn't belong to.

## Demo

`src/kit/demo/DatavizDemo.tsx`: `Kit-Dataviz-Demo` (1920x1080@60), `-Vertical` (1080x1920@60), `-30fps`. One scene,
six panels, every primitive on sample data (`npx remotion studio src/kit/demo/entry.tsx`).
