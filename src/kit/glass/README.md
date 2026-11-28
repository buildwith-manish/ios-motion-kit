# kit/glass — Glass primitive

`<Glass>` draws any glass tier from the theme: gradient fill over a faint dark underlay, `backdrop-filter` blur + saturate, 1px gradient specular rim (bright top-left to ~0 bottom-right), inset top highlight, tight + wide shadows, optional one-shot shimmer. No Remotion hooks inside; `frame` is a prop.

```tsx
import {Glass, ThemeProvider, Text, midnight} from '../kit';

export const Demo: React.FC<{frame: number}> = ({frame}) => (
  <ThemeProvider theme={midnight}>
    <Glass tier="card" width={480} height={240} frame={frame} shimmerAt={1.0}>
      <Text role="title">Hello</Text>
    </Glass>
  </ThemeProvider>
);
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `tier` | `'card' \| 'pill' \| 'chip' \| 'sheet' \| 'liquid'` | `'card'` | Which tier spec to draw. |
| `frame` | `number` | – | Current frame; only needed for shimmer. |
| `shimmerAt` | `number` (s) | – | When the one-shot sweep starts. |
| `shimmerDuration` | `number` (s) | `0.3` | Sweep length. |
| `radius` | `RadiusKey \| number` | tier's | Override corner radius. |
| `width`, `height`, `style`, `className` | – | – | Layout. |
| `theme` | `Theme` | context | Override the provider. |

Pure helpers: `glassStyle(theme, tier, radius?)` returns `{surface, rim, borderRadius}` style patches; `shimmerState(time, at, duration?)` returns `{x, opacity}`.

Caveat: `backdrop-filter` only blurs what is behind it inside the nearest backdrop root. An ancestor with `opacity < 1` or a CSS `filter` (such as `enterStyle()` mid-entrance) makes the glass show only its fill until it settles.

## Tier `liquid` (opt-in)

The Apple "Liquid Glass" feel for **hero cards only** (one to three per frame, never full-screen, never on pills/chips/lists). It is the `card` tier (same fill, underlay and shadows, so text contrast stays in the card envelope) plus, all from theme tokens:

- a conic **specular rim** that follows the corner radius and a **light angle** (bright lobe at the light, weaker back lobe opposite);
- an **inner highlight** on the lit side and a soft **inner shadow** on the far side (slab thickness);
- a cheap **fake edge refraction**: two chroma-shifted thin rings (cool `tint.a`, warm `semantic.warning`) plus a lens band, at the edge only. No SVG filter, no second backdrop blur;
- **adaptive tint** from the pure `tintFor(theme, {x, y})` (0-1 canvas position of the glass; blends the theme's four backdrop tints, alpha <= `orbMaxAlpha * 0.34`). It never reads pixels.

```tsx
<Glass tier="liquid" width={720} height={420} lightAngle={315 + 20 * Math.sin(frame / 40)} position={{x: 0.35, y: 0.5}}>
  <Text role="title">Hero</Text>
</Glass>
```

Extra props: `lightAngle` (compass deg the light comes from, default 315, may animate per frame), `position` (omit for no tint). Pure helpers: `liquidStyle(theme, radius?, {lightAngle, position, strength})`, `tintFor`.

**Cost.** One backdrop blur like `card` (20px instead of 24px) plus five extra absolutely positioned layers (three behind the content, the rim above) made of gradients, box-shadows and thin masked rings. CI job `Glass perf` renders the same still set with no glass, `card` and `liquid` under software GL (swangle) and prints ms/frame in the log summary (target liquid <= 1.3x card, net of the glass-free scene); measured: 1.06x card per still (283 vs 268 ms, 3 hero cards at 1080p), about 1.4x card for the glass part alone (50.6 vs 35.2 ms); details in docs/progress/liquid-glass.md. Keep it to hero cards. Like all glass, it needs a backdrop root-free ancestor (see caveat above).
