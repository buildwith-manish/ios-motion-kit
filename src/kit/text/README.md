# kit/text

Text motion for video, as pure functions of a frame number. Everything is configured by props or theme tokens; times
are in **seconds** (converted with the canvas `fps`); nothing reads the Remotion clock. Defaults are 1920x1080 @ 60 fps;
it also works at 1080x1920 and at 30 fps (canvas comes from `theme.canvas` / the nearest `ThemeProvider`).
Line breaking and auto-fit use a **precomputed width table** (no DOM measurement at render time).

```tsx
import {RevealText, Emphasis, NumberText, Caption, createTheme, CANVAS, ThemeProvider} from '../kit';

const theme = createTheme({canvas: CANVAS.landscape60}); // or CANVAS.vertical60 / landscape30
export const Scene: React.FC<{frame: number}> = ({frame}) => (
  <ThemeProvider theme={theme}>
    <RevealText text={'Where your paycheck\ngoes further'} frame={frame} mode="lines" mask fit={{maxHeight: 300}} />
    <RevealText timings={words} frame={frame} role="title" highlightActive renderWord={(w, n) => (w.index === 3 ? <Emphasis frame={frame} start={w.start}>{n}</Emphasis> : n)} />
    <NumberText prefix="$" to={2480} suffix="/mo" frame={frame} start={5} />
    <Caption frame={frame} timings={words} glass="pill" />
  </ThemeProvider>
);
```

## API

| Export | What | Key props (defaults) |
| --- | --- | --- |
| `<RevealText>` | Staggered reveal: opacity, rise 12-24 px, blur 8 -> 0 on an iOS spring. | `text`, `frame`, `mode` ('words'), `start` (0 s), `gap` (0.12 lines / 0.07 words / 0.025 chars s), `rise` (18), `blur` (8), `mask` (false: lines rise out of a clipped baseline), `direction` ('auto'), `align` ('start'), `fit` (`{maxHeight, minFontSize}`), `maxWidth` (title safe width), `maxLines`, `role` ('display') |
| word-timestamp sync | Same component with `timings: {text, start, end}[]` (seconds, one word per entry). Each word appears on its own `start`; `start` prop shifts all. | `timings`, `appear` ('timings' \| 'stagger'), `highlightActive` (false: brighten current word, dim rest), `inactiveOpacity` (contrast-derived, >= 0.4), `keepSpoken` (false), `activeFade` (0.12 s), `renderWord(word, node)` |
| `<Emphasis>` | Inline highlight: animated underline or soft glass wipe; draws from the start edge (right in RTL). | `frame`, `start`, `variant` ('underline' \| 'glass'), `color` (accent), `textColor`, `thickness` (0.09 em), `direction` ('auto') |
| `<NumberText>` | Money/percent/counter: tabular figures, prefix/suffix, odometer roll, vertical directional blur on digits only above 1 px/frame (cap 14, kit max 20). Always LTR-isolated. | `to`, `from` (0), `frame`, `start`, `duration` (0.9 s), `then` (`{at, to, duration}[]` chained updates), `decimals`, `prefix`, `suffix`, `groupSep`, `decimalSep`, `layout` ('collapse': hidden leading digits take no width, total width springs; 'reserve': fixed final width, for centred layouts), `motionBlur` (true), `role` ('number') |
| `<Caption>` | Burned-in captions: max 2 lines, inside the title safe area (clears Shorts/Reels UI in vertical), optional glass backing, fade-out. Put it in a full-canvas layer. | `timings` (paginated) or `text` (+`start`/`end`, auto-fitted), `frame`, `maxLines` (2), `position` ('bottom'), `glass` (false \| tier), `highlightActive`, `hold` (0.25 s), `maxWidth` (88% of safe width) |
| `layoutText`, `layoutWords`, `fitText` | Pure line breaking and largest-font-that-fits (0.5 px steps) on the width table. | `fontSize`, `metrics`, `maxWidth`, `maxLines`, `maxHeight`, `slack` (1.03) |
| `paginateCaptions`, `pageAt` | Split word timings into pages of <= N lines; find the page at a time. | `maxLines`, `maxPageSeconds` (4), `breakOnGap` (0.7 s) |
| `wordActivity`, `activeWordIndex`, `shiftTimings`, `validateTimings` | Timing helpers. | |
| `rollValueAt`, `buildRollSegments` | Pure roll maths behind `<NumberText>`. | |
| `unitEnter`, `unitStyle` | The per-unit enter used by `<RevealText>`. | `response`, `rise`, `blur`, `scale` |
| `measureText`, `advanceOf`, `metricsForWeight`, `INTER_600`, `INTER_700`, `detectDirection`, `hasConnectedScript` | Width tables and script helpers. | |

## Width tables (fonts)

`fonts/inter-600.json` and `inter-700.json` match the theme weights (600 / 700). For another font run the build step and
pass the result as `metrics`:

```
python3 scripts/kit-font-metrics.py path/to/Font.otf src/kit/text/fonts/myfont-700.json --name myfont-700 --weight 700
```

Widths are advance sums: **no kerning or shaping**, so predictions are a close estimate. Layout adds 3 % slack so a line
predicted to fit does not wrap in the browser. The tables cover Latin, Latin-1, typographic punctuation and currency;
Hebrew/Arabic/CJK/emoji fall back to rough per-script averages (supply a real table for non-Latin captions).

## RTL

`direction` is 'ltr' | 'rtl' | 'auto' (first strong character). Lines break in logical order; the browser does the
bidi display. `mode="chars"` falls back to words for connected scripts (Arabic, Indic, Thai) because per-character
elements would break shaping. Numbers inside `<NumberText>` stay left-to-right.

## Demo

`src/kit/demo/TextDemo.tsx`: `Kit-Text-Demo` (1920x1080@60), `-Vertical` (1080x1920@60), `-30fps`, `-RTL` (Hebrew).
`npx remotion studio src/kit/demo/entry.tsx`. Stills: `KIT_CHROME=/path/to/chrome node scripts/kit-text-stills.mjs`.

## formatNumber

Rules: en-US, true minus (U+2212), round half away from zero, no sign on values that round to 0. `pct` takes a fraction; `pp` and `bps` take values already in points / bps. Compact picks the unit after rounding (K to M switch at 999,500 with default decimals; 999,950 -> $1.0M). Pass `{preset, ...overrides}` for e.g. `sign: "accounting"`, `consistentDecimals`, `decimals`. Components take `format` (preset or spec); legacy prefix/suffix/decimals still work and override it.

| Preset | Input -> output |
|---|---|
| `usd` | 0 → $0, 1234.5 → $1,235, -1234.5 → −$1,235, 999999 → $999,999 |
| `usdCompact` | 999 → $999, 12345 → $12.3K, 999950 → $1.0M, 2500000000 → $2.5B |
| `pct` | 0 → 0.0%, 0.123 → 12.3%, -0.0456 → −4.6%, 1.5 → 150.0% |
| `pp` | 0 → 0.0 pp, 1.2 → +1.2 pp, -1.2 → −1.2 pp, 12.34 → +12.3 pp |
| `delta` | 0 → 0, 5 → +5, -5 → −5, 1234 → +1,234 |
| `int` | 0 → 0, 1234 → 1,234, -1234 → −1,234, 1234567 → 1,234,567 |
| `decimal1` | 0 → 0.0, 3 → 3.0, -3.14159 → −3.1, 1234.56 → 1,234.6 |
| `decimal2` | 0 → 0.00, 3 → 3.00, -3.14159 → −3.14, 1234.567 → 1,234.57 |
| `bps` | 0 → 0 bps, 25 → 25 bps, -25 → −25 bps, 150 → 150 bps |
| `{preset:"usd", sign:"accounting"}` | -1234 → ($1,234) |

Helpers: `quarter("2026-09-15")` → Q3 '26, `monthYear("2026-09-15")` → Sep 2026 (UTC).

`NumberText` with a compact or accounting spec renders formatted text at a fixed width (no per-digit odometer); all other presets keep the odometer.
