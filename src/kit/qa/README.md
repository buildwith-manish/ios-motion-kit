# kit/qa: render checks

Checks that run on any composition: contact sheet, motion audit, title-safe area, contrast, render profiles with a
timing report, and loudness. The rules are pure TypeScript here (no React, no Node APIs); `scripts/kit_*.mjs` run them.

## Setup

```bash
npm ci                      # includes playwright-core (used by the contact sheet, safe-area and contrast scripts)
ffmpeg -version             # a system ffmpeg built with libx264 and loudnorm must be on PATH
```

**Browser.** Looked up in this order: `KIT_CHROME=/path/to/chrome`; Remotion's own browser (downloaded on first use);
a Playwright headless shell under `PLAYWRIGHT_BROWSERS_PATH`; `@sparticuz/chromium`. All rendering uses `--gl=swangle`.
If the default browser is missing:

```bash
npm i --no-save @sparticuz/chromium@123.0.1   # the scripts extract it to /tmp/chromium and set LD_LIBRARY_PATH
KIT_NO_DOWNLOAD=1 node scripts/kit_contact_sheet.mjs --comp Kit-Qa-Demo   # skip the download attempt

# the same browser with the plain Remotion CLI, after any script above has extracted it:
LD_LIBRARY_PATH=/tmp npx remotion still src/kit/demo/entry.tsx Kit-Qa-Demo out/still.png \
  --frame=90 --gl=swangle --browser-executable=/tmp/chromium
```

## Commands

Every composition script takes `--comp <id[,id]>`, `--entry <file>` (default `src/kit/demo/entry.tsx`; use
`--entry src/index.ts` for the videos), `--serve-url <bundle dir>`, `--props '<json>'`, `--out <dir>` (default
`out/kit-qa`) and `--help`. All except the loudness script, when given files, bundle the entry first.

```bash
# 1. Contact sheet: a still every N seconds, labelled with its time
node scripts/kit_contact_sheet.mjs --comp Kit-Qa-Demo --every 1
node scripts/kit_contact_sheet.mjs --comp Kit-Text-Demo-Vertical --every 0.5 --cols 8 --include-last

# 2. Motion audit: static stretches longer than 1.0 s (10 fps samples at 0.25 scale)
node scripts/kit_motion_audit.mjs --comp Kit-Qa-Demo
node scripts/kit_motion_audit.mjs --comp Kit-Camera-Demo --min-static 1.5 --start 2 --end 8 --dump-pairs

# 3. Title-safe area, read from the composition's `theme` prop
node scripts/kit_safe_area_check.mjs --comp Kit-Qa-Demo-Vertical
node scripts/kit_safe_area_check.mjs --comp Kit-Tokens-Demo --every 0.25 --kind action
node scripts/kit_safe_area_check.mjs --entry src/index.ts --comp V4-Hook-Test --theme midnight

# 4. Contrast against the rendered background (WCAG 4.5:1)
node scripts/kit_contrast_check.mjs --comp Kit-Qa-Demo
node scripts/kit_contrast_check.mjs --comp Kit-Text-Demo --times 4,8.5,9.5 --min 4.5

# 5. Render profiles; each run updates out/kit-qa/timing-report.json
node scripts/kit_render.mjs --profile draft  --comp Kit-Audio-Demo
node scripts/kit_render.mjs --profile review --comp Kit-Audio-Demo
node scripts/kit_render.mjs --profile final  --comp Kit-Audio-Demo
node scripts/kit_render.mjs --profile final  --comp Kit-Text-Demo --scale 2          # 4K
node scripts/kit_render.mjs --profile final  --comp Kit-Camera-Demo --start 2 --end 4 # time a slice

# 6. Loudness, analysis only (-14 LUFS +/- 1, true peak <= -1 dBTP)
node scripts/kit_loudness.mjs out/kit-qa/Kit-Audio-Demo-final.mp4
node scripts/kit_loudness.mjs --comp Kit-Audio-Demo

# 7. Source lint for forbidden device-style identifiers and strings
node scripts/kit_no_device_chrome.mjs

# 8. Unit and fixed-frame visual regression checks
npm run test:unit
npm run test:visual
npm run test:visual:update  # refresh intentionally, then inspect the baseline diff
```

Exit codes for the checks: **0** pass, **1** problems found (`--no-fail` turns this into 0), **2** could not run.
Outputs: `contact-<id>.png`, `motion-audit.json`, `safe-area.json` + `safe-area-<id>.png`, `contrast.json` +
`contrast-<id>.png`, `<id>-<profile>.mp4`, `timing-report.json`, `loudness.json`. Each JSON file (except the timing
report, which merges) is overwritten by the next run in the same `--out`.

## What each check measures

| Check | Rule | Limits to know |
| --- | --- | --- |
| Motion | A sample pair is static when mean difference <= 0.15 (0-255) **and** changed pixels <= 0.1 % (channel change > 3). Reported when the run is longer than 1.0 s. | Movement that repeats exactly every 0.1 s looks static. Very small, faint or slow movement can fall under the limits, and grain or noise hides a real hold. |
| Safe area | Visible glyph pixels (not the taller font box) plus `<img>/<svg>/<video>/<canvas>` under 25 % of the frame and anything tagged `data-qa-safe="name"`. | Only DOM content: text painted into canvas/WebGL or images is invisible to it. Untagged `div` shapes are not checked. |
| Contrast | Declared text colour over each real background pixel under the glyphs; the 10th percentile must reach 4.5. Gradient or tinted text uses on-screen pixels (`method: "rendered"`). | Skips opacity < 0.35, blur > 0.5 px, lines under 60 % unclipped. A line must stay low for 2 consecutive samples in about the same place, or it is "transient". Colour emoji, canvas text and `::before/::after` text are not checked. |

Mark deliberate exceptions with `data-qa-ignore` (applies to the whole subtree, both DOM checks).
Both DOM checks drive the bundle in their own page; compositions that use `<OffthreadVideo>` will not work there.

## Render profiles

| | scale | fps | CRF / x264 | frames | audio | `motionBlurSamples` |
| --- | --- | --- | --- | --- | --- | --- |
| draft | 0.5 | 30 | 28 / veryfast | JPEG 80 | AAC 160k | 1 |
| review | 1 | 60 | 20 / fast | JPEG 92 | AAC 256k | 3 |
| final | 1 | 60 | 16 / slow | PNG | AAC 320k | 8 |

- Scale is relative to the composition. `remotion.config.ts` (4K) does **not** apply to these scripts; use `--scale 2`.
- Frame rate is only reduced, by dropping whole frames. A 30 fps composition stays 30 fps in review and final.
- `kit_render.mjs` passes the profile and `motionBlurSamples` as `props.kitRender`. A composition can read it with
  `motionBlurSamples(props, fallback)`; `Kit-NumberRoll-Demo` (`src/kit/demo/NumberRollDemo.tsx`) turns digit blur off at 1 sample.
- AAC is encoded from a lossless mix, because Remotion 4.0.250's own MP4 plays audio 42.7 ms late.

## Example (10 lines)

```ts
import {diffFrames, findStaticStretches, measureTextContrast, qaSafeRect, safeOvershoot, sampleTimes} from '../kit/qa';
const samples = sampleTimes({duration: 10, fps: 60, every: 1});
const pairs = samples.slice(1).map((s, i) => ({from: samples[i].time, to: s.time, ...diffFrames(rgb[i], rgb[i + 1])}));
const holds = findStaticStretches(pairs, {minSeconds: 1});
const canvas = {width: 1080, height: 1920, fps: 60};
const {rect} = qaSafeRect(canvas, undefined, 'midnight', 'title');
const outside = safeOvershoot({left: 4, top: 900, right: 300, bottom: 960}, rect, canvas);
const contrast = measureTextContrast(glyphPixels, 'rgb(255, 255, 255)');
console.log(holds, outside, contrast?.ratio);
```
(`rgb` and `glyphPixels` are frame data you supply.)

## API

| Export | What |
| --- | --- |
| `sampleTimes`, `formatTimestamp`, `formatTable` | Sampling and report text |
| `diffFrames`, `findStaticStretches`, `STATIC_THRESHOLDS` | Motion audit |
| `qaSafeRect`, `safeOvershoot`, `mergeHits` | Safe area |
| `relativeLuminance`, `contrastRatio`, `parseCssColor`, `measureTextContrast`, `longestStableRun`, `toHex` | Contrast |
| `RENDER_PROFILES`, `planRender`, `motionBlurSamples` | Render profiles |
| `YOUTUBE_LOUDNESS`, `parseLoudnorm`, `judgeLoudness` | Loudness |
| `QA_FIXTURE`, `qaMotionTime` | Known faults in the demo card |

## Demo

`Kit-Qa-Demo` (1920x1080@60), `-Vertical`, `-30fps` and `-Clean` (`src/kit/demo/QaDemo.tsx`) have known answers:
one 2.5 s hold (3.0-5.5 s) that must be reported, a 0.6 s hold that must not, two safe-area faults, two contrast
faults, and traps (clipped, invisible and ignored text). `-Clean` must pass all three checks.
