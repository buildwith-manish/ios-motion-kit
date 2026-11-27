# kit/motion — iOS motion primitives

Pure, seconds-based, fps-parametric versions of the Video 4 motion helpers (moved from `src/video4/motion4.ts`, which now re-exports frame-based adapters). No Remotion hooks.

```ts
import {enter, enterStyle, SPRING, iosSpring, gatedTravelBlur} from '../kit';

const t = frame / fps;                       // seconds
const s = enter(t, 1.2, SPRING.SNAPPY, fps); // fade + rise + scale + blur on an iOS spring
const style = enterStyle(s);                 // opacity / transform / per-element blur (max 8px)
const blurLen = gatedTravelBlur(s.vy, fps);  // 0 unless the element moves faster than 1px/frame
```

| Export | What it does |
| --- | --- |
| `iosSpring(t, response)` | Critically damped spring 0 to 1, `response` seconds to settle. No overshoot. |
| `SPRING` | `SNAPPY` 0.4, `SMOOTH` 0.5, `GENTLE` 0.7 (seconds). |
| `iosEase`, `cubicBezier(x1,y1,x2,y2)` | iOS ease curve; generic CSS-style bezier. |
| `enter(t, start, response?, fps?)`, `leave(...)` | `EnterState` `{opacity, y, scale, blur, vy}`. `vy` is px per frame. |
| `enterStyle(state)` | State to an inline style patch. |
| `idleDrift`, `heartbeat`, `microEvent` | Ambient signals; time and periods in seconds. |
| `travelBlur(pxPerFrame, fps?)`, `gatedTravelBlur` | Directional-blur length; the gated one returns 0 at 1px/frame or slower. |
| `staggerDelay(i, gapSeconds?)` | Delay for the i-th item in a group, in seconds. |
| `secondsToFrames`, `framesToSeconds` | Conversions at a given fps. |
