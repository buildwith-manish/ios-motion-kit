# Building a video with the motion kit

Use the kit as a composition layer: keep story content in plain data, pass the Remotion frame into the renderer, and
let the theme supply canvas, type, spacing, and safe-area values.

## 1. Describe the scenes

```tsx
import type {SceneDefinition} from '../src/kit/scenes';

const scenes = [
  {
    id: 'opening',
    type: 'hook',
    duration: 5,
    title: 'What changes when the plan is clear?',
    transition: {kind: 'blurDissolve', duration: 0.5},
  },
  {id: 'stat', type: 'stat', duration: 6, label: 'Monthly essentials', value: 3250, prefix: '$'},
  {
    id: 'close',
    type: 'endCard',
    duration: 5,
    title: 'Choose one useful next step.',
  },
] satisfies SceneDefinition[];
```

The times are seconds. Adjacent scenes overlap by their transition duration, so calculate the composition length with
`sceneSequenceFrames(scenes, fps)` or `sceneSequenceDuration(scenes)`. The layout helper rejects duplicate ids,
non-positive durations, and adjacent transitions that would overlap.

## 2. Render the sequence

```tsx
import {useCurrentFrame} from 'remotion';
import {CANVAS, createTheme} from '../src/kit/tokens';
import {SceneSequence, sceneSequenceFrames} from '../src/kit/scenes';

const fps = CANVAS.landscape30.fps;
const Video: React.FC = () => {
  const frame = useCurrentFrame();
  const theme = createTheme({canvas: CANVAS.landscape30});
  return (
    <SceneSequence
      frame={frame}
      theme={theme}
      scenes={scenes}
      atmosphere="deep-ocean"
      finish="light"
    />
  );
};
```

Register `Video` with a Remotion `<Composition>` using `sceneSequenceFrames(scenes, fps)` for
`durationInFrames`. Keep `useCurrentFrame()` at the composition boundary; all kit templates receive `frame` explicitly.

## 3. Match the story to a template

Use `hook` and `takeaway` for a clear opening and close, `stat` for one important number, `ranking` for ordered
changes, `comparison` for two values on a shared visual plane, and `neededVsEarned` for targets and shortfalls.
`mapHero` draws a generic route illustration; provide `origin` and `destination` labels rather than geographic data.
`SectionTitle`, `StatCard`, `Ranking`, `Comparison`, `NeededVsEarned`, `MapHero`, and `EndCard` can also be used
independently when a full sequence is not needed.

Scene content is bounded by the theme's title-safe rectangle and title sizing adapts to available width. Atmosphere can
be set once on `SceneSequence` or overridden per scene. Finish is optional and can be restricted to final-profile
renders with `kitRender`.

The `Kit-Scenes-Demo` composition is a generic six-scene, 30-second reference. Use the scene README for the full data
shape and transition options.
