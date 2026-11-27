# T1b-numberroll

- [x] layout prop — already implemented; `collapse` is the default and `reserve` keeps the final width.
- [ ] QA before — attempted twice; scripts could not run because `ffmpeg` is unavailable.
- [ ] QA fixes — blocked because the baseline findings could not be collected.
- [ ] QA after — not run; see **NOT DONE**.
- [x] 5 stills — one pass at 960px wide, scale 0.5.
- [x] motionBlurSamples — render props are wired through `kit_render.mjs`, read by NumberRollDemo, and documented.

## QA results

| Check | Before | After |
| --- | --- | --- |
| Contrast | Could not run (exit 2: `ffmpeg` not found) | Not run |
| Safe area | Could not run (exit 2: `ffmpeg` not found) | Not run |
| Motion audit | Could not run (exit 2: `ffmpeg` not found) | Not run |

Before output (first 80 lines per script): `docs/progress/T1b-qa-before.txt`.
The T1a prerequisite is present and `npm run kit:contrast` passes.

## Review stills

- `docs/previews/kit/T1b-0-usd.jpg`
- `docs/previews/kit/T1b-316-usd.jpg`
- `docs/previews/kit/T1b-2168-usd.jpg`
- `docs/previews/kit/T1b-93k-usd.jpg`
- `docs/previews/kit/T1b-0.0-pct.jpg`

Looked at each once. They show the mid-roll states with no visible clipping; active digits are blurred as expected for the review profile.

## NOT DONE

- QA baseline and after-run findings/fixes: the scripts failed twice, first because no browser was selected and then because `ffmpeg` is missing. Per task limits, no further attempts were made, so remaining contrast/safe-area findings could not be assessed or fixed.
