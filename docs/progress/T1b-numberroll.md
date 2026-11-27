# T1b-numberroll

- [x] layout prop — already implemented; `collapse` is the default and `reserve` keeps the final width.
- [x] QA before — contrast, safe-area, and motion audit all pass on `Kit-NumberRoll-Demo`.
- [x] QA fixes — no findings, so no fixes were needed.
- [x] QA after — all three checks pass.
- [x] 5 stills — one pass at 960px wide, scale 0.5.
- [x] motionBlurSamples — render props are wired through `kit_render.mjs`, read by NumberRollDemo, and documented.

## QA results

| Check | Before | After |
| --- | --- | --- |
| Contrast | Pass; 28 text runs checked, no findings | Pass; 28 text runs checked, no findings |
| Safe area | Pass; all text inside title-safe area | Pass; all text inside title-safe area |
| Motion audit | Pass; 100 samples, no static stretches over 1 s | Pass; 100 samples, no static stretches over 1 s |

Outputs (first 80 lines per script): `docs/progress/T1b-qa-before.txt` and `docs/progress/T1b-qa-after.txt`.
The T1a prerequisite is present and `npm run kit:contrast` passes.

## Review stills

- `docs/previews/kit/T1b-0-usd.jpg`
- `docs/previews/kit/T1b-316-usd.jpg`
- `docs/previews/kit/T1b-2168-usd.jpg`
- `docs/previews/kit/T1b-93k-usd.jpg`
- `docs/previews/kit/T1b-0.0-pct.jpg`

Looked at each once. They show the mid-roll states with no visible clipping; active digits are blurred as expected for the review profile.

## NOT DONE

None.
