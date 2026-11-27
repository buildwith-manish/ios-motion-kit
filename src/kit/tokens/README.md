# kit/tokens — themes

A theme is one plain object (`Theme`) that every kit component reads. Reskin a video by swapping the theme; nothing is hard-coded in components.

- **Built-ins:** `midnight` (navy + mint), `light` (iOS light), `mono` (graphite).
- **Contents:** colours (3 background tiers, 3 text levels, accent, positive/warning/negative, decorative tints), 4 glass tiers (card, pill, chip, sheet), radius scale, 4pt spacing scale, type scale (display, title, body, caption, number), 2 font families + exactly 2 weights, safe areas for 16:9 and 9:16, motion tokens.
- **Canvas:** `theme.canvas` holds `fps`, `width`, `height` (default 60 / 1920 / 1080). All px tokens are authored at a 1080 short side and scale by `unit(theme)`, so 1920x1080 and 1080x1920 look identical in size.
- **Time:** every duration in the tokens is in seconds. Convert with `toFrames(theme, s)`.

```tsx
import {createTheme, CANVAS, ThemeProvider, useTheme, textStyle, Glass} from '../kit';

const theme = createTheme({colors: {accent: '#FF7A00'}, canvas: CANVAS.vertical60}, 'midnight');

const Card: React.FC<{frame: number}> = ({frame}) => {
  const t = useTheme();
  return <Glass tier="card" frame={frame} shimmerAt={1} style={{padding: 32}}>
    <div style={textStyle(t, 'number', {color: 'accent'})}>$1,240</div>
  </Glass>;
};
export const Scene: React.FC<{frame: number}> = ({frame}) => <ThemeProvider theme={theme}><Card frame={frame} /></ThemeProvider>;
```

Non-React code: `import {themes, getTheme, midnight} from '../kit'` gives the plain objects.

| Export | What it does |
| --- | --- |
| `createTheme(overrides?, base?)` | Deep-merge overrides over a base theme (default `midnight`; name or object). Beziers are replaced whole. |
| `midnight`, `light`, `mono`, `themes`, `getTheme(name)` | Built-in themes. |
| `CANVAS` | `landscape60`, `landscape30`, `vertical60`, `vertical30`. |
| `ThemeProvider`, `useTheme()` | React context for the theme (default `midnight`). |
| `buildGlassTiers(recipe)` | Generate all four glass tiers from a few colours/gains. |
| `unit`, `px`, `space`, `radius` | Scale design px to the canvas. |
| `safeRect(theme, 'title' \| 'action')` | Safe rectangle in px for the canvas orientation. |
| `toFrames`, `toSeconds`, `ease` | Seconds/frames at the theme fps; theme easing as a function. |
| `shadowCss(spec, scale)` | `ShadowSpec` to a CSS box-shadow layer. |
| `textStyle(theme, role, opts?)`, `<Text>` | Apply the type scale (size, family, weight, tracking, colour). |
| `tabularNums()` | Tabular-figures style patch. |
| `rgba(hex, alpha)` | Hex + alpha to `rgba()`. |
