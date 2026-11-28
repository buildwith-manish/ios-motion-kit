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
