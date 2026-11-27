# Finish

```tsx
import {Finish, ChromaSplit} from 'ios-motion-kit';

const FinalFrame = ({frame, fps, kitRender, children}) => (
  <ChromaSplit frame={frame} fps={fps} eventTime={1.2}>
    <Finish level="full" finalOnly kitRender={kitRender}>
      {children}
    </Finish>
  </ChromaSplit>
);
```

`Finish` is frame-independent: `level="off"` leaves the image untouched, `light` adds a gentle channel curve and vignette, and `full` adds thresholded highlight bloom and seeded grain. `finalOnly` gates bloom and grain on `kitRender.profile === "final"` so review renders stay fast. Chroma separation is off when `eventTime` is omitted and springs back to neutral from the supplied event time.

| API | Type / default | Description |
| --- | --- | --- |
| `Finish.level` | `'off' \| 'light' \| 'full'`, `'light'` | Grade strength |
| `Finish.finalOnly` | `boolean`, `false` | Restrict bloom and grain to final renders |
| `Finish.kitRender` | `{profile?: string}` | Render profile supplied by the composition |
| `ChromaSplit.frame` | `number` | Current composition frame |
| `ChromaSplit.fps` | `number` | Composition frame rate |
| `ChromaSplit.eventTime` | `number?` | Hit time in seconds; omitted means disabled |
| `ChromaSplit.amount` | `0..3`, `3` | Maximum RGB offset in logical pixels |
| `ChromaSplit.response` | `number?` | Spring response in seconds; defaults to the theme's snappy spring |

Render the split-screen before/after sample with `npx remotion still src/kit/demo/finishEntry.tsx Kit-Finish-Demo docs/previews/kit/finish.png --frame=0`. The 3-second composition also demonstrates ChromaSplit after its 0.45-second hit.
