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

## M3: MetroMap

Built and pushed: `src/kit/map/MetroMap.tsx` (+ `metroLod.ts`, `metroIndex.ts`, `metroData.ts`), demos in `src/kit/demo/MetroDemo.tsx`, `scripts/map_metro_stills.mjs`, workflow `map-metro`. Not copied from PayRanked's StreetMap; only the ideas (tiered brightness, feathered edges, zoom-dependent detail, dim mode).

- Props in, SVG out: `city` (baked city), `alignment` (cities/alignment.json entry), `frame`, `zoom`, `center`, `mode` ("hero" | "dim"), `orientation`, reveal timing in seconds, optional `boundary` (GeoJSON, e.g. one feature of the CBSA layer). No imports of city data inside the component.
- Zoom 1 = the 14 km city box covers the longer canvas side (no empty edges). Level of detail is a pure function of zoom (`metroLod`): major roads only far out, then secondary (0.8 to 1.5), ramps and local streets (1.6 to 2.8, rich tier only), service and other (3 to 4.6). Stroke widths grow sub-linearly with zoom.
- Night style from theme tokens: filled water with a subtle diagonal gradient, parks at low opacity, tiered road brightness, glow on major roads only in hero mode (a wide low-alpha stroke, no blur filter), vignette, light grain (neutral noise tile, overlay blend).
- Dim mode: content at 0.3 opacity, no glow, vignette halved, tier brightness compressed so the quiet streets stay visible.
- Roads reveal from the centre with a soft radial mask per tier (major first), not stroke-dashoffset. Reveal masks are only emitted while revealing.
- Feathered edges (gradient mask) only appear when the view reaches past the baked box (zoom below 1, or panned off it).
- Budget: visible paths are culled to the view and merged into few `<path>`s of at most 12,000 points. Measured across all 10 cities, light and rich, zoom 1 / 2.2 / 4.5: at most 10 elements and 9,450 points per frame; the largest single path is 3,917 points (limit about 15,000).

Seconds per frame (software GL, GitHub runner, reused browser, `docs/previews/kit-map/metro/perf.json`):

| tier | 1080p median | 1080p max | 4K median | 4K max |
|---|---|---|---|---|
| light | 0.44 s | 0.55 s | 1.00 s | 1.21 s |
| rich | 0.47 s | 0.68 s | 1.13 s | 1.98 s |

Mid-reveal frames (masks active, Chicago, rich): 0.57 s and 0.52 s at 1080p; 1.17 s and 1.26 s at 4K. Runner noise is real: an earlier identical run measured a 4K rich max of 1.69 s.

Review stills: `docs/previews/kit-map/metro/` (hero and dim at three zooms for two cities, portrait, light and mono themes, light tier, reveal moments, boundary, 4K crops).

Not verified (M3):
- The 4K rich maximum (1.98 s in the last run) is above 1.5 s. The 1.5 s budget is for 1080p, which passes, but 4K is slower than that figure.
- The optional boundary uses the M1 CBSA layer, which is heavily generalised (Chicago's whole metro ring is 52 points), so at street zoom it is only a rough guide. It is not shown for most metros at zoom 1 because their outline lies outside the 14 km box.
- Grain is a neutral noise tile and the mask edges use fixed black and white (mask mechanics, not palette colours). No other hard-coded colours.
- Only the midnight theme has been reviewed closely; light and mono stills render but were only glanced at.
- No video of the zoom demo (`Kit-Metro-Landscape`) has been rendered yet, only stills of its reveal moments.
- Side-by-side with PayRanked's current Chicago and New York stills was made locally for review and is not committed: PayRanked's stills are OpenStreetMap-based, and the kit repo must stay free of that data.

## M4: camera, flyTo, pins, callouts, arc, route, fly demo

Built and pushed: map camera (`flyTo` van Wijk path + spring ease, `flightPlan`), metro anchoring maths, `FlyMap` (country layers under the kit camera, `blurDissolve` into `MetroMap`, CBSA outline anchored with the alignment data), `MapPin`, `MapCallout` + `MapCallouts` (no-overlap layout solver), `Arc`, `RouteDraw`, demo `src/kit/demo/FlyDemo.tsx` (fly across the US to a generic metro, three pins, arc between two cities, route, callouts with numbers), `scripts/map_fly_stills.mjs`, workflow `map-fly`.

Verified in GitHub Actions (run on commit 4c30020, success): typecheck, install, stills, timing, landscape video (13.5 s, 1080p).

- Landing frame after retune (`docs/previews/kit-map/fly/landscape-t12p8.png`): the three pins sit inside the baked street box, callouts show "North 37.2%", "Core $4,210", "South 18x", the route draws between pins, no callout overlaps another.
- Seconds per still, software GL, GitHub runner, 1080p landscape: median 0.727 s, max 1.534 s (at t = 3.0 s, mid-flight). Portrait 1080x1920: median 0.712 s, max 1.051 s. Budget 1.5 s.

Not verified (M4):
- Landscape max is 1.534 s at one time sample (t = 3.0 s), 0.034 s over the 1.5 s budget. It is one sample on a shared runner (neighbouring samples are 0.64 to 0.84 s), so it may be noise, but I have not re-measured or profiled it.
- Portrait video was not rendered; portrait stills render. In the portrait landing frame the view reaches past the baked 14 km box, so the street layer fades out at the edges and the metro outline runs through the frame.
- Callouts at the landing frame touch the CBSA outline line; that overlap is cosmetic and not solved.
- 4K was only checked by eye on crops (`crop4k-t5p2.png`, `crop4k-t12p5.png`, `crop4k-t12p8.png`), not by an automated test.
- The demo's lat/lng, city box and values are generic samples; no real data is claimed.
- `tsc --noEmit` last ran at exit 0 on commit 4c30020; it has not been re-run on the commit that adds this note (docs only).
