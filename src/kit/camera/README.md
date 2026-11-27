# kit/camera

Virtual camera for 2D scenes, as pure functions of a frame number. Everything is configured by props; times are in
**seconds** (converted with the canvas `fps`); nothing reads the Remotion clock except the optional hook in `hooks.ts`.
Defaults are 1920x1080 @ 60 fps; it also works at 1080x1920 and at 30 fps (the canvas comes from `theme.canvas`, a
`canvas` prop, or the nearest `ThemeProvider`).

```tsx
import {CameraRig, DepthLayers, DepthLayer, RackFocus, RackLayer, Tilt3D, createTheme, CANVAS} from '../kit';

const theme = createTheme({canvas: CANVAS.landscape60}); // or CANVAS.vertical60 / landscape30
const move = [{t: 0, x: -300}, {t: 2, x: 0}, {t: 2.4, scale: 1.3, ease: 'spring' as const}, {t: 5}];
const focus = [{t: 0, layer: 'a'}, {t: 6.5, layer: 'b'}];
export const Scene: React.FC<{frame: number}> = ({frame}) => (
  <CameraRig frame={frame} theme={theme} keyframes={move}>
    {(cam) => (
      <DepthLayers camera={cam.state} frame={frame} theme={theme} idle>
        <DepthLayer depth={0.35}><RackFocus frame={frame} theme={theme} focus={focus}><RackLayer layer="a"><CardA /></RackLayer></RackFocus></DepthLayer>
        <DepthLayer depth={0.7}><RackFocus frame={frame} theme={theme} focus={focus}><RackLayer layer="b"><Tilt3D rotateY={-4}><CardB /></Tilt3D></RackLayer></RackFocus></DepthLayer>
      </DepthLayers>
    )}
  </CameraRig>
);
```

## API

| Export | What | Key props (defaults) |
| --- | --- | --- |
| `<CameraRig>` | Pan, zoom, roll between keyframes; wraps the world in one transformed element. Children may be nodes or `(cam) => nodes`. | `frame`, `keyframes` (`{t, x, y, scale, rotate, ease, response}`, seconds), `theme`/`canvas`, `handheld` (off), `motionBlur` (off), `clip` (true) |
| `<Tilt3D>` | `perspective()` + rotateX/rotateY with explicit `transform-origin`, for glass cards and device mockups. | `rotateX`, `rotateY` (0), `maxTilt` (6 deg), `perspective` (1400 px), `origin` ('50% 50%'), `sway` + `frame` (off) |
| `<DepthLayers>` + `<DepthLayer depth>` | 2.5D parallax. Child `depth` 0 (far) .. 1 (near); the rig pose and/or idle drift move layers by depth. Replaces nested SlowPush wrappers. | `camera`, `frame`, `idle` (off; `{amplitude 14 px, periodSeconds 24, scale 0.01}`), `parallax` (0.5), `zoomParallax` (0.35), `focusDepth` (0.5) |
| `<RackFocus>` + `<RackLayer layer>` | Blur between layers on a spring: the focus layer has no filter, the rest `blur(<= maxBlur)`. One filter per layer, never per element. | `focus` (`[{t, layer}]`, first = starting focus), `frame`, `maxBlur` (10, hard cap 20), `response` (0.7 s) |
| `handheld(time, opts)` | Seeded value-noise shake: <= 2 px, <= 0.15 deg (hard clamps). | `seed` (1), `amplitude` (1), `rotation` (0.08), `frequency` (0.8 Hz) |
| `cameraAt(frame, keyframes, canvas, opts)` | Pure: pose, handheld offset, on-screen velocity for a frame. | `opts.handheld` |
| `sampleCamera`, `cameraTransform`, `cameraScreenDelta`, `resolveEase`, `normalizeKeyframes` | Building blocks of the above. | |
| `rackBlur`, `rackSharpness`, `depthTransform`, `tiltAngles`, `tiltStyle`, `cameraBlurLength` | Pure helpers behind the components. | |
| `useCameraSample(keyframes, opts)` | Thin optional hook: `cameraAt` for the current Remotion frame. | |

### Keyframes
- Position `x`, `y` is the world point (px from the canvas centre) the camera looks at; positive x looks right. `scale` is zoom
  (interpolated in log space, so 1 -> 2 and 2 -> 4 feel equal). `rotate` is camera roll in degrees (positive = clockwise camera).
  Omitted fields carry over from the previous keyframe.
- `ease` on a keyframe is the easing of the segment that **leaves** it: `'ios'` (default, `iosEase`), `'spring'` (iOS spring renormalised
  to land exactly on the next keyframe; `response` defaults to 0.95 x segment length), `'linear'`, a cubic-bezier tuple, or a function.
  Before the first and after the last keyframe the camera holds.
- Keep the world larger than the canvas where the camera pans or zooms out, or the edges show (the demo backdrop is 190% size).

### Handheld
Off by default. Deterministic: same `seed` and time give the same shake on every worker and at any fps (it is a function of seconds).
Amplitude requests above 2 px / 0.15 deg are clamped, not honoured.

### Camera motion blur
Off by default (`motionBlur` on `<CameraRig>`). Speed is the on-screen translation of the picture at the screen centre between this render
frame and the previous one (rig only, handheld excluded). Below `threshold` (default 3 px/frame, never below 1) nothing is drawn and the
element has no filter. Above it the blur ramps up from 0 (`(speed - threshold) * shutter`, default shutter 0.5, cap 14, hard cap 20) as an
SVG `feGaussianBlur` on the whole world, using the kit's `MotionBlur`.

Limitations: translation only (zoom and roll are not blurred); the blur is per axis, so diagonal moves get an axis-aligned smear rather
than a true along-the-path one.

**Render-time cost (measured once, rough):** one full-frame 1920x1080 still of the demo at its fastest frame (10.98 px/frame, blur ~4 px)
took a median of ~9.0 s with motion blur vs ~4.9 s without (three runs each, software GL in a CPU-only sandbox with an unrelated Chromium,
including browser launch). Treat the difference (~4 s on a blurred frame) as an upper-end indicator, not a prediction for a real
render; real video renders have not been timed. Only frames over the threshold pay it: in the demo that is 62 of 600 frames.

## Rules this kit follows
- No `useCurrentFrame()` in primitives; the only clock hook is `useCameraSample` in `hooks.ts`. No `Math.random`.
- No full-layer `filter: blur()` above 20 px (rack default 10, camera blur cap 14). No `CameraMotionBlur`.
- `<RackFocus>` omits the `filter` entirely when blur < 0.05 px, so an in-focus layer is not filtered.
- A CSS `filter` creates a backdrop root: a `<Glass>` inside a layer that is *currently blurred* shows its un-blurred fill, not the blurred
  backdrop (see the Glass docs). In the demo that is the defocused card; it reads as a soft flat card.
- `<Tilt3D>` and the rig use only 2D transforms plus `perspective()`; no `preserve-3d`.

## Demo
`src/kit/demo/CameraDemo.tsx`: `Kit-Camera-Demo` (16:9 @ 60), `-Vertical` (9:16 @ 60), `-30fps` (16:9 @ 30), 10 s each: pan (0.6-3.0 s),
push-in (3.4-6.0 s), rack focus between two glass cards (6.6 s), then a slow roll. Stills in `docs/previews/kit/camera-*.jpg`
(`node scripts/kit-camera-stills.mjs`; set `KIT_CHROME`). Numeric checks: `npx tsx scripts/kit-camera-audit.ts`.
