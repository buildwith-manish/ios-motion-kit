# kit/transitions

Scene-to-scene transitions as pure functions of a frame number. `<TransitionScene>` takes an outgoing and an incoming
scene, a start time and a duration in **seconds**, and renders one of six transitions. Progress comes from an iOS spring
(or `iosEase`), renormalised so it lands on exactly 1; the outgoing scene is unmounted at `start + duration`.

```tsx
import {TransitionScene, createTheme, CANVAS} from '../kit';

const theme = createTheme({canvas: CANVAS.landscape60}); // or CANVAS.vertical60, CANVAS.landscape30, ...
export const Cut: React.FC<{frame: number}> = ({frame}) => (
  <TransitionScene frame={frame} theme={theme} kind="push" direction="left" start={1.2} duration={0.8}
    response={0.7} motionBlur outgoing={<SceneA />} incoming={<SceneB />} />
);
// Inside a Remotion composition, pass useCurrentFrame() (or use useTransitionProgress for a bare progress value).
```

| Kind | What it does | Options (`options={{kind: {...}}}`) |
| --- | --- | --- |
| `push` | Incoming pushes outgoing; outgoing moves 30% as far and dims | `parallax` 0.3, `dim` 0.25 |
| `blurDissolve` | Incoming fades in over outgoing, blur ramp (max 16px), tiny scale difference | `maxBlur` 16, `scaleDelta` 0.02 |
| `sheet` | Incoming rises like an iOS sheet; outgoing scales to 0.94 and dims | `outgoingScale` 0.94, `dim` 0.3, `radius` (theme xxl) |
| `zoomThrough` | Outgoing zooms in and fades; incoming settles 1.06 -> 1 | `outgoingScale` 1.4, `incomingFrom` 1.06, `maxBlur` 6 |
| `matchedGeometry` | `<MatchedElement id>` morphs between its two rects (position, size, radius) on the spring; the rest cross-fades | `maxBlur` 6 |
| `wipeMask` | Soft-edged directional mask reveal | `softness` 0.3 |

`<TransitionScene>` props: `frame`, `theme` (canvas, backdrop = `colors.background.deep`, `fonts.body`, sheet radius = `radius(theme, 'xxl')`), `kind`, `start` (s), `duration` (s), `outgoing`, `incoming`, `direction`
(`left|right|up|down`, content-travel direction; defaults per kind), `response` (spring response in s, default
0.95 x duration), `curve` (`'spring'|'ease'`), `motionBlur` (`true` or `{shutter, cap}`, default off), `options`.

Other exports: `transitionProgress`, `getTransition` + the six effect factories (pure `(p, ctx) => layers`),
`TransitionLayer`, `MotionBlur` / `motionBlurLength`, `MatchedElement` / `MatchedOverlay` / `lerpRect`,
`useTransitionProgress` (thin hook), `auditTransition` (rule checker, see below).

## Rules this kit enforces
- Outgoing opacity is exactly 0 and the outgoing scene is unmounted by the end; `auditTransition` checks it at 30/60 fps, landscape and vertical.
- No frame has both layers at ~half opacity while both are static (incoming draws over a still-opaque outgoing, or one layer is masked).
- Full-layer Gaussian blur is capped at 20px. Directional motion blur wraps only the moving layer and only above 1 px/frame.
- Scenes should paint their own background. `theme.colors.background.deep` shows only where a scene is transparent or has scaled away from the edges (sheet, zoomThrough).

## matchedGeometry notes
Render the same `<MatchedElement id rect>` in both scenes. While the transition runs, each registers its rect + children
and the overlay draws one morphing copy; content is fitted uniformly into the morphing box, so matching elements with a
similar aspect ratio look best. Registration happens during render and relies on both scenes rendering before the overlay
in the same pass (true for plain React; a memoized scene that skips rendering would not register).

Demo: `Kit-Transitions-Demo`, `-Vertical`, `-30fps` in `src/kit/demo/` (`npx remotion studio src/kit/demo/entry.tsx`). Stills: `docs/previews/kit/transitions-*.jpg` (`scripts/kit-stills.mjs`). Check: `node scripts/kit-audit.mjs`.
