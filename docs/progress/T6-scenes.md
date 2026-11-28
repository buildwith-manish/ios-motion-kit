# T6 — Scene kit

## Built

- Added JSON scene definitions, validated timeline layout and duration/frame helpers; transitions overlap adjacent scenes and total duration is derived from the overlap.
- Added Hook, StatCard, Ranking/Ticker, Comparison, NeededVsEarned, SectionTitle, Takeaway, EndCard, and MapHero templates.
- Added `SceneSequence` integration with `TransitionScene`, optional Atmosphere and Finish, safe-area layout, and adaptive title sizing.
- Added the six-scene, 30-second `Kit-Scenes-Demo`, standalone entry point, API README, and `docs/how-to-build-a-video.md`.

## Verification

- `npx tsc --noEmit` passed; `npm run test:unit` passed all 16 tests.
- Contrast and safe-area checks passed at 2, 7, 12, 17, 22, and 27 seconds.
- Motion audit sampled 60 points at 2 fps and 0.1 scale; no static stretch over 3 seconds was found.
- Visual regression baseline `scenes-frame-300.png` matches with zero differing pixels.
- Corrected the EndCard action label to use the theme's actual `onAccent` color.

## Not done

- No full-resolution render, full-motion playback review, or cross-browser comparison.
- Motion-audit wall time (89.9 seconds for 60 sampled points) is a low-resolution QA measurement, not a production-render benchmark.
