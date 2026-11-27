# kit/demo — demo compositions

`KitDemoCompositions` registers three compositions that show all four glass tiers (card, pill, chip, sheet) on a coloured backdrop in all three built-in themes (midnight, light, mono), with a staggered one-shot shimmer:

| Id | Canvas |
| --- | --- |
| `Kit-Tokens-Demo` | 1920x1080 @ 60 fps (themes side by side) |
| `Kit-Tokens-Demo-Vertical` | 1080x1920 @ 60 fps (themes stacked) |
| `Kit-Tokens-Demo-30fps` | 1920x1080 @ 30 fps |

```bash
npx remotion studio src/kit/demo/entry.tsx
npx remotion still src/kit/demo/entry.tsx Kit-Tokens-Demo out.png --frame=72
```

`entry.tsx` registers only the kit demos (no video fonts, no network). They are also registered in `src/Root.tsx`. `TokensDemoView` is the pure view (takes `frame` and `canvas`); `TokensDemo` is the thin wrapper that reads the frame.

## Transitions demo

`KitTransitionsCompositions` registers `Kit-Transitions-Demo` (1920x1080 @ 60), `Kit-Transitions-Demo-Vertical` (1080x1920 @ 60) and `Kit-Transitions-Demo-30fps` (1920x1080 @ 30): seven labelled scenes cycling push, blurDissolve, sheet, zoomThrough, matchedGeometry and wipeMask (1.2 s hold, 1.0 s per transition, ~14.4 s). `TransitionsDemoFrame` is the pure view (takes `frame`); `TransitionsDemo` is the thin wrapper that reads the frame. `demoStills(fps)` lists the 25/50/75% frames. Registered in `entry.tsx` and `src/Root.tsx`.

## QA test card

`KitQaCompositions` registers `Kit-Qa-Demo`, `-Vertical`, `-30fps` and `-Clean`: planted faults with known answers for
the checks in `../qa/README.md`. Registered in `entry.tsx` only (not in `src/Root.tsx`).
