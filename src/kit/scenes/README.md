# kit/scenes

JSON-driven scene templates and a timeline renderer for short explainers. Every scene uses absolute seconds and a
passed frame; transitions overlap adjacent scenes and the total duration is computed from scene durations minus those
overlaps.

```tsx
const scenes = [
  {id: 'hook', type: 'hook', duration: 5, title: 'A clear question', transition: {kind: 'push', duration: 0.5}},
  {id: 'result', type: 'stat', duration: 6, label: 'Monthly total', value: 3250, prefix: '$'},
  {id: 'close', type: 'endCard', duration: 4, title: 'Make the next decision with confidence.'},
] satisfies SceneDefinition[];

const duration = sceneSequenceDuration(scenes); // seconds
<SceneSequence frame={frame} theme={theme} scenes={scenes} atmosphere="deep-ocean" finish="light" />;
```

`SceneDefinition` is plain JSON: `hook`, `stat`, `ranking`, `comparison`, `neededVsEarned`, `takeaway`, `endCard`, or
`mapHero`. Ranking step times are relative to that scene's start. Each scene can override the default transition and
atmosphere; use `transition: false` or `atmosphere: false` to disable either. `fitSceneTitle` provides conservative
title sizing within the theme's safe area.

`layoutSceneSequence`, `sceneSequenceDuration`, and `sceneSequenceFrames` are pure timeline helpers. Adjacent
transitions may not overlap inside a scene; invalid durations, ids, or transition settings throw a `RangeError`.
`SceneSequence` composes the kit's `TransitionScene`, optional `Atmosphere`, and optional `Finish`.

The six-scene, 30-second example is registered as `Kit-Scenes-Demo`; `src/kit/scenes/entry.tsx` is a standalone
Remotion entry point.

## Map scenes, data only

`choropleth`, `regionHighlight`, `tileGrid` and `flyToCity` are plain scene objects too (US only). Region keys may be FIPS,
USPS codes or names (DC included); `null` marks a missing value and draws hatched. Bad ids, empty data and too-short
scenes throw before any frame renders. Choropleth, regionHighlight and flyToCity need the baked map data
(`npm run kit:fetch-data`); `tileGrid` needs none. Full example: `src/kit/scenes/mapScenesDemoData.ts`
(`Kit-MapScenes-Demo`, `Kit-MapScenes-Demo-Vertical`).

```ts
const scenes = [
  {id: 'map', type: 'choropleth', duration: 8, title: 'Median rent', data: {CA: 1900, TX: 1300, WV: 850, DC: null}, format: 'usd', source: 'Sample data'},
  {id: 'tiles', type: 'tileGrid', duration: 7, title: 'Every state', data: {CA: 1900, TX: 1300, WV: 850}, format: 'usd'},
  {id: 'pick', type: 'regionHighlight', duration: 9, title: 'Three places', format: 'usd',
   regions: [{id: 'CA', label: 'California', value: 1900, at: 0.8, hold: 2.2}, {id: 'TX', value: 1300, at: 3.2}]},
  {id: 'fly', type: 'flyToCity', duration: 12.5, title: 'New York', city: 'new-york',
   countryPins: [{lat: 41.88, lng: -87.63, label: 'Chicago'}], arc: {from: {lat: 41.88, lng: -87.63}, to: {lat: 40.71, lng: -74.0}},
   callouts: [{lat: 40.7549, lng: -73.984, title: 'Midtown', value: 4300, prefix: '$'}]},
] satisfies SceneDefinition[];
```

`regionsFromRows(rows, {...})` / `regionsFromCsv(text, {...})` turn rows with a state name, USPS code or FIPS into `data`.
Timings (`reveal`, `at`, `hold`) are seconds from the scene start.

## `chartHeadline`: a chart that makes one claim

```ts
{id: 'rent', type: 'chartHeadline', duration: 8, title: 'Housing costs twice as much as food', subtitle: 'Monthly spending',
 chart: {kind: 'bar', format: 'usd', data: [{label: 'Housing', value: 1800}, {label: 'Food', value: 900}]},
 emphasis: {steps: [{at: 2, focus: 'Food', label: 'Food: the baseline'}, {at: 3.6, focus: ['Housing', 'Food']}]},
 labels: [{item: 'Food', at: 2.2}], compare: [{from: 'Food', to: 'Housing', mode: 'ratio', at: 4}],
 sourceIds: ['spending'], manifest}   // or source: 'Source: ...'
```

`chart.kind` is `bar`, `line`, `slope`, `waterfall` or `sector`; focus, labels and markers use the item ids (bar/sector `label`, slope `name`, waterfall `label`, line x value or series name). All times are seconds from the scene start; `reveal.start` (default 0.6) is when the chart begins. `labels` and `compare` work on bar and line charts. The title is the claim and is required; it shrinks to fit 2 lines (landscape) or 4 (portrait) inside the title-safe area. Validation runs in `layoutSceneSequence` with errors that name the scene and list the known ids. Demo: `Kit-ChartHeadline-Demo` (and `-Vertical`): a bar with a 2x marker, then a slope chart that hands focus city by city.
