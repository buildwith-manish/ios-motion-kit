# kit-map progress

Branch `kit-map`. Library in `src/kit/map/`, demos `MapDemo.tsx` and `MapHighlightDemo.tsx` in `src/kit/demo/`, bake scripts `scripts/map_*`, baked data in `public/kit/map/`.

## Built (pushed)

- Region and city layers, zoom-aware simplification (`simplify.ts`); layers no longer drop regions over the 15k-point budget.
- `RegionHighlight`, `FocusDim`, soft contact shadow, 2.5D lift with parallax, mounted on Tilt3D (`HighlightStage`).
- `Choropleth`: plain `{ regionId: value }` JSON, sequential and diverging theme scales, glass legend (`MapLegend`), staggered fill-in, explicit handling of missing values.
- `MapSourceLine` (optional courtesy line, "Source: U.S. Census Bureau").
- Demos: three-state highlight with focus dimming; ZCTA choropleth of one metro from synthetic sample data.
- Baked data: states, counties, tracts, ZCTA, CBSA layers in `public/kit/map/regions/`; 10 city street maps in `public/kit/map/cities/`; `credits.json` next to each.
- CI workflows: `map-bake`, `map-bake-regions`, `map-verify`, `map-stills`.
- One line added to `src/kit/index.ts` (`export * from './map'`).

## Verified in GitHub Actions (real data)

- County-seam water merge: 4 of 4 cities pass, 0 seam segments left, 0.0000% area drift (`docs/map-verify-seams.md`).
- MTFCC table audited against the official 2025 list; two codes not in the official list removed (`docs/map-verify-mtfcc.md`).
- Stills rendered in CI for all demo scenes (`docs/previews/kit-map/`).
- Timing, software GL on a GitHub-hosted runner, 1080p: max 1.19 s per frame, median 0.46 s, budget 1.5 s (`docs/previews/kit-map/perf.json`, `docs/map-bake-logs/stills.log`).

## Also verified (final pass)

- `tsc --noEmit` on the final branch state: exit 0, no errors.
- Both demos rendered as videos in Actions (landscape, 1080p60, midnight): `docs/previews/kit-map/video/highlight-landscape.mp4` (10 s) and `choropleth-landscape.mp4` (6 s). Reviewed through contact sheets (`*-sheet.png`): highlight hands over Colorado, Missouri, Georgia with focus dimming and a title cross-fade; the choropleth fills in from the metro core outward with a stagger, then holds.
- Video render speed: 0.10 s per frame including encode (2 workers, software GL, GitHub runner), well under the 1.5 s budget.
- 4K: `choropleth-landscape-4k-clip.mp4` is 3840x2160, 90 frames. The existing 4K crops (`crop4k-highlight-*`, `crop4k-choropleth-*`) show crisp hairlines, sharp hatching for missing values, and an unclipped glow and lift.

## Not verified

- Portrait videos were not rendered (portrait stills pass in CI).
- The 4K check is by eye on crops and one short clip; no pixel-level or automated hairline test.
- Colour-blind-safety of the default scales was checked with `scripts/map_check_scales.ts` during development; the result is not recorded in CI.
- The choropleth demo uses synthetic sample data, so the legend and missing-value hatching have not been checked against real distributions.
- MTFCC table: names that wrap across lines in the official PDF are compared on their first line only.
