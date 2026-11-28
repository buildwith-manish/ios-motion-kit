# ios-motion-kit

A reusable, video-agnostic **iOS-style motion kit for Remotion** (glass surfaces, spring motion, text, charts, transitions, camera, audio, QA checks). Extracted from `PayRanked-video3` (branch `kit-ios`); see [docs/kit-migration.md](docs/kit-migration.md).

Pinned: `remotion` / `@remotion/*` **4.0.250**, `react` **18.3.1**, TypeScript strict.

## Install (standalone, to run the demos)

```bash
git clone git@github.com:buildwith-manish/ios-motion-kit.git && cd ios-motion-kit
npm install
npx remotion studio src/index.ts        # all demo compositions
npx tsc --noEmit                        # typecheck
```

## Use it in a video repo (the one supported way: git submodule)

```bash
# 1. add the kit as a submodule at src/kit-vendor/
git submodule add git@github.com:buildwith-manish/ios-motion-kit.git src/kit-vendor
git submodule update --init
git -C src/kit-vendor checkout v0.1.0      # optional: pin a tag

# 2. make the kit's public/kit assets (sfx, music, demo) available as staticFile('kit/...')
mkdir -p public && cp -R src/kit-vendor/public/kit public/kit       # copy (always works), or:
ln -s ../src/kit-vendor/public/kit public/kit                       # symlink (see note)
```

**tsconfig.json** (video repo) must have `"resolveJsonModule": true` (the kit imports JSON) and:

```json
{ "compilerOptions": { "baseUrl": ".", "paths": { "ios-motion-kit": ["src/kit-vendor/src/kit"] } } }
```

**remotion.config.ts** (video repo), the matching webpack alias:

```ts
import path from 'node:path';
import {Config} from '@remotion/cli/config';

Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {...(config.resolve?.alias ?? {}), 'ios-motion-kit': path.resolve(process.cwd(), 'src/kit-vendor/src/kit')},
  },
}));
```

Do **not** run `npm install` inside `src/kit-vendor/` (it would install a second copy of `react`/`remotion`). The video repo supplies them.
Symlink note: the symlink form was tested with Remotion 4.0.250 (`remotion bundle` copied all `public/kit` files). If your setup ever misses the audio, use the `cp -R` form.

### Update

```bash
git submodule update --remote src/kit-vendor     # pull latest main of the kit
git add src/kit-vendor && git commit -m "chore: bump ios-motion-kit"
cp -R src/kit-vendor/public/kit/. public/kit/     # only if you use the copy form
```

## Use a theme

```tsx
import {createTheme, CANVAS, ThemeProvider} from 'ios-motion-kit';
const theme = createTheme({colors: {accent: '#FF7A00'}, canvas: CANVAS.vertical60}, 'midnight'); // 'midnight' | 'light' | 'mono'
// <ThemeProvider theme={theme}>...</ThemeProvider>  - every kit component reads canvas, colours, type and springs from it
```

## Build a scene (15 lines)

```tsx
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {createTheme, CANVAS, ThemeProvider, Glass, RevealText, NumberText} from 'ios-motion-kit';

const theme = createTheme({canvas: CANVAS.landscape60});
export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill style={{background: theme.colors.background.deep, alignItems: 'center', justifyContent: 'center'}}>
        <Glass tier="card" width={900} height={420} frame={frame} shimmerAt={1}>
          <RevealText text={'Where your paycheck\ngoes further'} frame={frame} mode="lines" />
          <NumberText prefix="$" to={2480} suffix="/mo" frame={frame} start={1.5} />
        </Glass>
      </AbsoluteFill>
    </ThemeProvider>
  );
};
```

## Render

```bash
npx remotion render src/index.ts Kit-Tokens-Demo out/tokens.mp4                  # 1080p
npx remotion render src/index.ts Kit-Tokens-Demo out/tokens-4k.mp4 --scale=2     # 4K (3840x2160)
npx remotion still  src/index.ts Kit-Dataviz-Demo out/dataviz.png --frame=300
```

Chromium missing? `npm i --no-save @sparticuz/chromium`, extract it to `/tmp/chromium`, then add
`LD_LIBRARY_PATH=/tmp` and `--browser-executable=/tmp/chromium --chrome-mode=chrome-for-testing --gl=swangle`.
Scripts: `scripts/kit-*.mjs` / `scripts/kit_*.mjs` (stills, audits, QA); `scripts/kit-camera-audit.ts` runs with `npx tsx`; the `.py` generators need `numpy` + `scipy` (`kit-font-metrics.py` needs `fonttools`).

## Test and visual regression

```bash
npm run test:unit                 # Vitest pure-function tests
npm run test:visual               # fixed-frame comparison against tests/visual/baselines/
npm run test:visual:update        # intentionally refresh baselines; inspect the image changes before committing
```

The PR workflow runs TypeScript, unit tests, source/contrast checks, representative contrast/safe-area/motion QA, and
the fixed-frame visual suite. Visual renders use `KIT_CHROME` when supplied, then the QA helper's Remotion, Playwright,
and optional `@sparticuz/chromium` fallbacks. Browser caches and actual/diff PNGs are kept as workflow artifacts.

## The 7 kits (`src/kit/`)

| Kit | What it gives you |
| --- | --- |
| `tokens` (+ `glass`, `motion`) | Themes, canvases, spacing/type/radius tokens, the `Glass` primitive, iOS springs and easings. |
| `text` | `RevealText`, `Emphasis`, `NumberText`, `Caption`: pure, frame-driven text motion with a precomputed width table. |
| `dataviz` | `SpringBar`, `Ring`, `Ticker`, `LineDraw`/`Sparkline`, `Delta`, `Callout`. |
| `transitions` | `TransitionScene`: push, blurDissolve, sheet, zoomThrough, matchedGeometry, wipeMask. |
| `camera` | `CameraRig`, handheld noise, `Tilt3D`, `DepthLayers`, `RackFocus`. |
| `audio` | Cue resolver, `CueTrack`, `MusicBed`, voice-over ducking, generated SFX and music beds. |
| `qa` | Safe-area, contrast, motion and loudness checks plus a planted-fault test card. |

## Audio caveat

**Nobody has listened to the audio.** The SFX and music in `public/kit/` are synthesised by `scripts/kit_make_sfx.py` / `kit_make_music.py`, and only checked numerically (levels, loudness, clipping). Judge them by ear before shipping anything.
