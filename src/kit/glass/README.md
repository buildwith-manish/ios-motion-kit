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
| `tier` | `'card' \| 'pill' \| 'chip' \| 'sheet'` | `'card'` | Which tier spec to draw. |
| `frame` | `number` | – | Current frame; only needed for shimmer. |
| `shimmerAt` | `number` (s) | – | When the one-shot sweep starts. |
| `shimmerDuration` | `number` (s) | `0.3` | Sweep length. |
| `radius` | `RadiusKey \| number` | tier's | Override corner radius. |
| `width`, `height`, `style`, `className` | – | – | Layout. |
| `theme` | `Theme` | context | Override the provider. |

Pure helpers: `glassStyle(theme, tier, radius?)` returns `{surface, rim, borderRadius}` style patches; `shimmerState(time, at, duration?)` returns `{x, opacity}`.

Caveat: `backdrop-filter` only blurs what is behind it inside the nearest backdrop root. An ancestor with `opacity < 1` or a CSS `filter` (such as `enterStyle()` mid-entrance) makes the glass show only its fill until it settles.
