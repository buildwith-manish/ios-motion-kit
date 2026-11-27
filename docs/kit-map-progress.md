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

## Not verified

- `tsc` has not been run on the final branch state (the spec asks for one run at the end).
- The two demos have not been rendered as short videos, so motion (spring fade-in, stagger, dimming, lift) has only been checked through stills.
- Hairlines and edges at 4K (`--scale=2`) have not been checked on the final highlight and choropleth stills. Only an earlier `_4k` still existed, and it was removed.
- Colour-blind-safety of the default scales was checked with `scripts/map_check_scales.ts` during development; the result is not recorded in CI.
- The choropleth demo uses synthetic sample data, so the legend and missing-value hatching have not been checked against real distributions.
- MTFCC table: names that wrap across lines in the official PDF are compared on their first line only.
