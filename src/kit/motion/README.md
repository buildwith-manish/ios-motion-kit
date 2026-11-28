# kit/motion — iOS motion primitives

Pure, seconds-based, fps-parametric versions of the Video 4 motion helpers (moved from `src/video4/motion4.ts`, which now re-exports frame-based adapters). No Remotion hooks.

```ts
import {enter, enterStyle, SPRING, SPRING_PRESETS, iosSpring, gatedTravelBlur} from '../kit';

const t = frame / fps;                       // seconds
const s = enter(t, 1.2, SPRING.SNAPPY, fps); // fade + rise + scale + blur on an iOS spring
const style = enterStyle(s);                 // opacity / transform / per-element blur (max 8px)
const blurLen = gatedTravelBlur(s.vy, fps);  // 0 unless the element moves faster than 1px/frame
const hero = iosSpring(t - 1, SPRING_PRESETS.hero.response, {bounce: SPRING_PRESETS.hero.bounce});
```

| Export | What it does |
| --- | --- |
| `iosSpring(t, response, {bounce?})` | Critically damped by default; optional underdamped overshoot with `bounce` 0..0.4. `bounce: 0` is identical to the legacy curve; `0.15` overshoots about 4.6%, while the `0.4` maximum overshoots about 52.7%. |
| `SPRING` | `SNAPPY` 0.4, `SMOOTH` 0.5, `GENTLE` 0.7 (seconds). |
| `SPRING_PRESETS.hero` | `{response: 0.8, bounce: 0.15}` for large, restrained hits. |
| `iosEase`, `cubicBezier(x1,y1,x2,y2)` | iOS ease curve; generic CSS-style bezier. |
| `enter(t, start, response?, fps?)`, `leave(...)` | `EnterState` `{opacity, y, scale, blur, vy}`. `vy` is px per frame. |
| `enterStyle(state)` | State to an inline style patch. |
| `idleDrift`, `heartbeat`, `microEvent` | Ambient signals; time and periods in seconds. |
| `travelBlur(pxPerFrame, fps?)`, `gatedTravelBlur` | Directional-blur length; the gated one returns 0 at 1px/frame or slower. |
| `staggerDelay(i, gapSeconds?)` | Delay for the i-th item in a group, in seconds. |
| `secondsToFrames`, `framesToSeconds` | Conversions at a given fps. |
| `enterStack(n, {start, stagger})`, `emphasize(at)`, `exit(at)`, `handoff(from, to)` | Choreography presets (choreo.ts): `{start, progress(time)}` items in seconds. |
| `springWithVelocity(v0, opts)`, `sampleSpring(m, t)`, `retarget(m, t, to?)` | Spring that keeps velocity; retargeting is continuous in position and velocity. |

Scene templates `stat` and `ranking` accept `choreo: true` (default off) to stagger their elements with `enterStack`.
