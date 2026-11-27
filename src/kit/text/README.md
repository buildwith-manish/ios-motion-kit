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
| `<NumberText>` | Money/percent/counter: tabular figures, prefix/suffix, odometer roll, vertical directional blur on digits only above 1 px/frame (cap 14, kit max 20). Always LTR-isolated. | `to`, `from` (0), `frame`, `start`, `duration` (0.9 s), `then` (`{at, to, duration}[]` chained updates), `decimals`, `prefix`, `suffix`, `groupSep`, `decimalSep`, `motionBlur` (true), `role` ('number') |
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
