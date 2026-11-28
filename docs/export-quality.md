# Export quality: banding on dark gradients

## Method
`node scripts/kit_banding_check.mjs` (CI job "Banding check", runs on `[qa]` commits) renders one frame (frame 0) of `Kit-Banding-Gradient`: a left-to-right gradient from the theme's `deep` to `base` background (about 7 luma levels across the width) under Finish's vignette. The frame is encoded as one x264 frame with each preset's crf and preset (yuv420p, bt709, tv range), decoded, and the Y plane of rows at 40, 50 and 60 % height is measured: longest run of identical luma (as % of width, worst row) and distinct luma levels (fewest). "src" columns are the same measure before x264. `frame KB` is the size of that single encoded frame, a rough proxy only.

## Numbers (CI, 2026-11-28)
| preset / variant | width | luma levels | longest run | src run | frame KB |
|---|---|---|---|---|---|
| preview / off | 960 | 6 | 21.7 % | 10.4 % | 1 |
| preview / banding-safe (1.25) | 960 | 6 | 21.7 % | 1.6 % | 1 |
| final-1080 / off | 1920 | 7 | 14.1 % | 10.6 % | 17 |
| final-1080 / banding-safe (1.25) | 1920 | 8 | 12.6 % | 2.6 % | 27 |
| final-4k / off | 3840 | 7 | 15.2 % | 10.3 % | 20 |
| **final-4k / banding-safe (2.5)** | 3840 | 10 | **3.7 %** | 0.5 % | 180 |
| final-4k / amount 2.0 | 3840 | 9 | 13.8 % | 0.5 % | 108 |
| final-4k / amount 3.0 | 3840 | 10 | 3.1 % | 0.5 % | 252 |
| final-4k / 2.5 + `-tune grain` | 3840 | 11 | 2.7 % | 0.5 % | 258 |

Reading: dither works before encoding at every size, but x264 removes a +-1 LSB-class noise at crf 16/17 (1080p, and 4K at 2.0). At 4K with amount 2.5 enough survives.

## Chosen setting
`dither="banding-safe"` with `kitRender.preset === "final-4k"` (set by `kit_render.mjs --preset final-4k`) uses amount 2.5; elsewhere `banding-safe` stays 1.25 and dither is off by default. 3.0 and `-tune grain` are not clearly better at similar size (+40 % frame size for 0.6 to 1.0 points), so 2.5 stays. Dither costs bitrate: one frame went from 20 KB to 180 KB. Check the file size of a real 4K export.

## Threshold
CI enforces, for final-4k / banding-safe only: longest run <= 6 % of width and >= 8 luma levels (measured 3.7 % and 10; conservative margin). 1080p and preview are report only.

## Not verified
- Whether uploading 4K helps YouTube quality is unverified here; check on your own channel.
- This is a synthetic gradient and one frame. The final check is a real upload watched on a phone and a TV.
- Noise varies per frame only if `Finish` gets the `frame` prop.
