# `kit/background`

`<Atmosphere>` adds token-driven colour and depth behind UI. It is video-agnostic: pass the current frame and a theme;
the component does not read the Remotion clock. Orbs use radial-gradient falloff rather than large CSS filter blurs.

```tsx
import {Atmosphere, Glass, focusPoints, NumberText, ThemeProvider, type Theme} from '../kit';

export const Scene: React.FC<{frame: number; theme: Theme}> = ({frame, theme}) => {
  const beats = focusPoints([{x: 640, y: 240, width: 520, height: 320}], theme.canvas);
  return (
    <ThemeProvider theme={theme}>
      <Atmosphere frame={frame} preset="midnight-aurora" beats={beats}>
        <Glass tier="card"><NumberText frame={frame} to={3168} prefix="$" /></Glass>
      </Atmosphere>
    </ThemeProvider>
  );
};
```

| Export | Purpose | Key options |
| --- | --- | --- |
| `<Atmosphere>` | Gradient, 2–4 drifting colour orbs, spring-following key light, vignette and deterministic grain. | `frame`, `preset` (`midnight-aurora`, `graphite`, `soft-light`, `deep-ocean`), `intensity` (0–1), `quiet`, `reducedMotion`, `beats`, `theme` |
| `focusPoints` | Converts element rectangles and a canvas into normalized light beats. | `rects`, `canvas`, `start` (0 s), `duration` (6 s), `colour` |
| `lightAt` | Samples the sorted beats with the theme's spring response. | `time` in seconds, `beats`, `response` |
| `ATMOSPHERE_GRAIN_TILE_PX` | Grain tile size at the 1080 design size; scales with `unit(theme)` for 4K. | — |
| `ATMOSPHERE_QUIET_FACTOR` | Alpha multiplier `quiet` applies to orbs and the key light (default 0.52). | — |

`quiet` lowers orb and key-light alpha to `ATMOSPHERE_QUIET_FACTOR` of full, for use behind charts and text.
`reducedMotion` holds each orb at its initial position without changing the palette or focus point. Orb alpha is
capped by `theme.colors.orbMaxAlpha`; full intensity deliberately reaches that cap for contrast testing. Orb drift
has a 10–14% horizontal amplitude on distinct 14–20 second periods. The focus helper clamps rectangle centres to the
canvas. The key light moves on the theme's GENTLE spring between beats (`{t, x, y, colour?}`, times in seconds);
`focusPoints` builds beats from element rects so the light can follow the current hero element.

Grain is a seeded LCG SVG tile (same tile every render); it shifts a few pixels every other frame (`frame/2` cadence,
the same as the video-4 original) so it reads as film grain, and `mix-blend soft-light` plus a black/white dot pair
keeps it visible on both dark and light themes. The tile is authored at 64 px on the 1080 design size and scales with
`unit(theme)`, so it looks the same at 4K (`--scale=2`).

The demo in `src/kit/demo/AtmosphereDemo.tsx` cycles through all four presets and the midnight, light and mono themes
in landscape, vertical and 30 fps compositions; the number rolls once per slot and the key light follows it, then the
pill. Its compositions are registered in `npx remotion studio src/kit/demo/entry.tsx`.
