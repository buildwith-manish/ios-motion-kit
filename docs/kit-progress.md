# Kit progress — `src/kit/` (branch `kit-ios`, off `video-4`)

## Built

| Commit | What |
| --- | --- |
| `kit: move iOS motion…` | `src/kit/motion/`: `iosSpring`, `SPRING`, `iosEase`, `cubicBezier`, `enter`/`leave`, `enterStyle`, `idleDrift`, `heartbeat`, `microEvent`, `travelBlur`, new `gatedTravelBlur` (0 at ≤1px/frame), `staggerDelay`, time helpers. Seconds-based, `fps` param (default 60). `src/video4/motion4.ts` now re-exports frame-based adapters with the same signatures. |
| `kit: tokens…` | `src/kit/tokens/`: `Theme` type, `createTheme(overrides, base)`, `midnight` / `light` / `mono`, `themes`, `getTheme`, `ThemeProvider` + `useTheme`, `CANVAS` presets, `buildGlassTiers`, helpers (`unit`, `px`, `space`, `radius`, `safeRect`, `toFrames`, `toSeconds`, `ease`, `shadowCss`), `textStyle`, `<Text>`, `tabularNums`, `rgba`. |
| `kit: Glass primitive…` | `src/kit/glass/`: `<Glass tier>` for card / pill / chip / sheet, pure `glassStyle()` and `shimmerState()`. Not wired into video4. |
| `kit: tokens demo…` | `src/kit/demo/`: `Kit-Tokens-Demo` (16:9 @ 60), `Kit-Tokens-Demo-Vertical` (9:16 @ 60), `Kit-Tokens-Demo-30fps`; kit-only `entry.tsx`; stills in `docs/previews/kit/` (JPEG q92). |
| `kit: transitions…` | `src/kit/transitions/`: `<TransitionScene>` (outgoing/incoming, start + duration in **seconds**, `theme` for canvas/fps), six transitions (`push`, `blurDissolve`, `sheet`, `zoomThrough`, `matchedGeometry` with `<MatchedElement id rect>`, `wipeMask`) as pure `(progress, ctx) => layers` functions, `transitionProgress` (iOS spring renormalised to land on exactly 1, or `iosEase`), kit-local `<MotionBlur>` (px/frame, gated at 1 px/frame, <= 20px), `auditTransition`, optional `useTransitionProgress` hook. Demo: `Kit-Transitions-Demo` (16:9 @ 60), `-Vertical` (9:16 @ 60), `-30fps`; 42 JPEG stills (25/50/75% of every transition at 16:9 and 9:16, 50% at 30 fps) in `docs/previews/kit/transitions-*.jpg`. Scripts: `scripts/kit-audit.mjs`, `scripts/kit-stills.mjs`. |

READMEs: `motion/`, `tokens/`, `glass/`, `transitions/`, `audio/`, `camera/`, `demo/`. Everything is exported through `src/kit/index.ts`.

## Audio (`src/kit/audio/`) — built in this pass

| Commit | What |
| --- | --- |
| `kit: audio SFX synth…` | `scripts/kit_make_sfx.py` (numpy + scipy only, seeded): 13 families x 3 variants (`tap`, `tick`, `pop`, `whoosh-soft`, `whoosh-fast`, `swipe`, `slide`, `rise`, `fall`, `chime-success`, `soft-warn`, `number-tick`, `impact-soft`), 48 kHz / 24-bit, 6 ms fade-in / 10 ms fade-out, every file peak -3.00 dBFS. `public/kit/sfx/manifest.json` (name, duration, peak time, active RMS, LUFS estimate), copy in `src/kit/audio/sfx-manifest.json`. Pre-panned stereo `@L` / `@R` files for pan (118 files, ~9 MB). |
| `kit: cue system…` | `cues.ts`: `cue(name, atSeconds, {gain, pan, variant, anchor})`, `resolveCues` (seeded variants, limits), `<CueTrack>` (`<Sequence><Audio/></Sequence>` per cue), `formatCueTable`. Limits: max 3 simultaneous, no identical file within 120 ms. |
| `kit: motion-linked cues…` | `motionCues.ts`: `enterEvents` (start / peak velocity / 99% settle), `transitionEvents` (start / mid / settle), `numberRollEvents` (start + ticks that thin out as the roll decelerates), `cuesFromMotion(events, rules)`, `anchor: 'peak'` alignment. Reuses `iosSpring` / `iosEase` from `kit/motion`. |
| `kit: ducking…` | `scripts/kit_vo_envelope.py` (RMS per 1/30 s -> JSON; `--demo` writes a synthetic voice + envelope), `ducking.ts` (`createDuck`, `getDuck`, `duckGainPerFrame`, `voiceLevelAt`), `mix.ts` (`sfxGainAt`: SFX duck 6 dB + ceiling so SFX RMS <= voice RMS - 3 dB). |
| `kit: music bed…` | `scripts/kit_make_music.py`: 64 s seamless ambient pad (static open D chord, detuned beating voices, slowly moving harmonic brightness, faint drifting air), 48 kHz / 16-bit stereo, -28 LUFS, peak -17.9 dBFS, ~12 MB. `<MusicBed>` with fades + ducking. |
| `kit: audio demo…` | `Kit-Audio-Demo` (16:9 @ 60), `-Vertical` (9:16 @ 60), `-30fps`: 10 s timeline with every family, fake VO, duck curve, playhead; `docs/kit-audio-cues.txt`; 8 stills `docs/previews/kit/audio-*.jpg`; README. Scripts: `kit-audio-check.mjs`, `kit-audio-table.mjs`, `kit-audio-stills.mjs`. |

### Audio: deviations and judgment calls (please check)

1. **Branch.** Both `video-4` and `kit-ios` exist on origin; I continued on `kit-ios` (it already holds the motion/tokens/glass/transitions kit). The `video-4` branch is untouched.
2. **"No identical SFX within 120 ms" = same file (family + variant).** A different variant of the same family is allowed, so rapid taps alternate variants. If all three variants started within 120 ms the cue is dropped. Consequence: in the demo a 3-digit number roll drops 3 of its 12 ticks. If you meant "same family", `minRepeatSeconds` and the `blocked()` rule in `cues.ts` are the one place to change.
3. **Pan is 3 positions.** Remotion's `<Audio>` has no pan prop, so `pan` selects pre-rendered `@L` / `@R` / centre files (equal-power, +-0.75). Continuous pan would need a different mixing path.
4. **Ducking has a `holdSeconds` (default 0.15)** that is not in your brief, so the duck does not release and re-engage between words. Attack 80 ms / release 400 ms are defined as time to ~95% (time constant = T/3). Default depth 7.5 dB for music, 6 dB for SFX.
5. **"Never louder than the voice-over"** is implemented as SFX RMS (from the manifest, while sounding) <= voice RMS - 3 dB, evaluated per frame on the VO envelope (max over +-0.1 s), only when the voice is above -50 dBFS. It is an RMS rule, not a peak or LUFS rule.
6. **Per-family default levels** (`FAMILY_DEFAULTS`) are my estimates because all files are peak-normalised to -3 dBFS; they have not been tuned by ear.
7. **LUFS in the manifest is an estimate**: K-weighted, ungated mean square over each (<400 ms) file, so useful relatively, not a BS.1770 integrated value.
8. **Music is 16-bit** (SFX are 24-bit as specified) and ~12 MB; the SFX folder is ~9 MB. Both are committed.
9. **`src/Root.tsx`** has one more kit line (`<KitAudioCompositions />`); `kit/demo/entry.tsx` too.
10. **`tsc`** was run once, at the end of the code work (clean, strict, whole repo). Stills, README and this section were written after it; none touch types beyond the demo files already checked.

### Audio: verified

- `node scripts/kit-audio-check.mjs` passes: same seed -> identical resolve; different seed -> different variants; 200 dense random timelines (60 cues each over 8 s) never exceed 3 simultaneous sounds and never start the same file twice within 120 ms; forced duplicate is dropped; peak anchoring lands the loudest sample on the cue time; duck attack reaches ~95% of depth at +80 ms, release ~95% recovered 400 ms after the hold ends, depths 6 and 9 dB reached, and the same curve at 60 and 30 fps; SFX RMS stays >= 3 dB under the voice for all 39 sounds at voice levels -48..-14 dBFS; `enterEvents` settle is exactly 99% of the spring, peak-velocity matches the numeric maximum, `transitionProgressAt` equals the kit's `transitionProgress` (max diff 2.6e-15); number-roll ticks thin out.
- Every SFX file: 48 kHz, 24-bit, peak -3.00 dBFS (read back from the manifest); `ffprobe` confirms format on two files. Energy above 8 kHz is <= 0.65% in the files I spot-checked (no hiss band).
- Music loop: tiled twice, the step across the seam (0.00043) is smaller than the median sample step (0.00082); RMS before/after the seam 0.0316 / 0.0325.
- VO envelope: re-running the script on the written WAV reproduces the stored JSON exactly; an MP3 round-trip through ffmpeg stays within 0.7 dB in speech.
- Demo stills viewed: landscape at 2.0 s and vertical at 9.1 s (cue lanes, dropped cues, duck curve, playhead).

### Audio: NOT verified

- **Nothing has been listened to.** I cannot hear audio here. Timbre, taste, balance between families, whether `chime-success` / `soft-warn` read as gentle, whether `impact-soft` is audible on laptop speakers (centroid ~44 Hz), and whether the three variants of a family differ enough are all unjudged. The numbers above only say the files are clean, correctly levelled and not hissy.
- **No video / audio render and no Studio session.** `<Audio volume={fn}>`, `<Sequence layout="none">`, `<MusicBed loop loopVolumeCurveBehavior="extend">` and the per-frame volume callbacks are type-checked and unit-tested as pure functions, but never played through Remotion's mixer. Parallel rendering (`--concurrency > 1`) is untested; the code is pure, with module-level memoisation only.
- Whether the looped bed keeps its volume curve across the loop boundary under `loopVolumeCurveBehavior="extend"` in a real render.
- The `ducking` envelope on a real voice-over (only a synthetic one and its MP3 version were tried).
- Stills were rendered with `@sparticuz/chromium` (`--gl=swangle`) again, not Remotion's own browser.
- 30 fps was checked with one still and the node checks; no frame-accurate listening test of sub-frame cue offsets (up to half a frame).

## Camera (`src/kit/camera/`): built

| Piece | What |
| --- | --- |
| `<CameraRig>` | Pan / zoom / roll between keyframes `{t, x, y, scale, rotate, ease, response}` (seconds). Easing per segment: `'ios'` (default, `iosEase`), `'spring'` (renormalised to land exactly on the next keyframe), `'linear'`, bezier tuple or function. Zoom interpolates in log space. Children can be nodes or `(cam) => nodes`. |
| `<Tilt3D>` | `perspective()` + rotateX/rotateY, clamped to 6 deg by default, explicit `transform-origin`, optional slow sway. |
| `<DepthLayers>` / `<DepthLayer depth>` | 2.5D parallax from the rig pose and/or a slow idle drift (translation + tiny scale). Reads each child's `depth` (0 far .. 1 near). |
| `<RackFocus>` / `<RackLayer layer>` | One `filter: blur()` per layer, sprung between layers; max 10 px default, hard cap 20; no filter at all when in focus. |
| `handheld()` | Seeded value-noise shake, <= 2 px and <= 0.15 deg (hard clamps), off by default. |
| Camera motion blur | `motionBlur` on the rig, off by default; velocity-gated (default 3 px/frame, never below 1), ramps from 0, cap 14 (hard 20). |

Also: pure `cameraAt` / `sampleCamera` / `cameraScreenDelta` / `rackBlur` / `depthTransform` / `tiltAngles`, thin hook `useCameraSample`, README
with API table and render-cost note, demo `Kit-Camera-Demo` (+ `-Vertical`, `-30fps`; 10 s: pan, push-in, rack focus between two glass cards, then a
roll), 13 stills in `docs/previews/kit/camera-*.jpg`, `scripts/kit-camera-stills.mjs`, `scripts/kit-camera-audit.ts`.

### Camera: deviations and caveats (please check)

1. **Branch.** `origin/kit-ios` already existed with the earlier kit work, so I continued on it (fast-forward). Nothing was created off `video-4`.
2. **"On a spring ... iosEase default".** I read this as: default segment easing is `iosEase`, with `'spring'` as an option. If you wanted springs everywhere, flip the default in `resolveEase` (one line).
3. **`src/Root.tsx`** has one more line (`<KitCameraCompositions />`), like the earlier kit demos.
4. **Camera blur reuses `MotionBlur` from `kit/transitions`** (so camera depends on transitions inside the kit). It blurs per axis (axis-aligned smear on diagonals) and only translation, not zoom or roll.
5. **Motion move was not redone**: `src/kit/motion/` and the `src/video4/motion4.ts` re-export were already in place from the earlier session.
6. **`tsc` was run four times** (after writing the code, on the final camera commit, and twice back to back on the tree after rebasing onto the audio work on `origin/kit-ios`), not once. All clean.
7. **README example** is ~12 lines, not 10, and was not compiled on its own (the demo exercises the same API).
8. **Demo framing:** at the end of the vertical demo card A touches the top edge during the roll/drift. Cosmetic.

### Camera: verified

- `npx tsx scripts/kit-camera-audit.ts`: 36 checks pass. Keyframes land exactly on their times; every ease maps 0 to 0 and 1 to 1; the same time gives the same pose at 60 fps / 1920x1080 and 30 fps / 1080x1920; the same frame twice is identical; handheld stays within 2 px / 0.15 deg even when asked for 50 px / 9 deg, is deterministic, and moves at most 0.11 px per frame at 60 fps; blur is 0 at or below threshold, continuous above it, capped at 20; rack blur is monotonic, capped at 20, and a pull interrupted by another has no jump; `depthTransform` is the identity with no camera or idle; tilt is clamped.
- Stills viewed (16:9 contact sheet and 9:16 sheet): pan, push-in, rack mid-pull, roll; at 30 fps one still. Rack focus reads correctly (focus card sharp, other soft), no edge exposure in landscape.
- One motion-blur still at the fastest demo frame looks directional and plausible.
- No imports from `src/video2|3|4` in `src/kit/camera`; `useCurrentFrame` appears only in `hooks.ts` (and the demos); no `Math.random`; `src/motion.ts` and `src/clock.ts` untouched.

### Camera: not verified

- **No video render, no Studio session, no `--concurrency > 1` run.** Parallel safety is by construction (pure functions of `frame`).
- **Motion-blur cost is a rough single measurement** (~+4 s on a blurred still, software GL, unrelated Chromium, includes browser launch); a real render was not timed, and frames below the threshold pay nothing.
- **Real-time feel of the move** (spring timing, parallax strength, handheld at speed) is unchecked beyond single frames.
- **Glass inside a defocused layer** shows its flat fill while blurred (CSS backdrop-root rule); it looked fine in stills but I did not compare against a pixel reference or against a normal Chrome.
- **`<Tilt3D>` around glass with `backdrop-filter`** was seen in stills only; not checked in other browsers.
- **Handheld** was checked numerically, not by eye in motion; 2 px / 0.15 deg may be invisible or just visible depending on the scene.
- Zoom / roll are not part of the blur direction; not tested visually.
- Fonts in the stills are the fallback stack; the earlier kit notes about the third-party Chromium (`@sparticuz/chromium`, `--gl=swangle`) apply here too.

### Camera: left to do

- Switch video4's `SlowPush` wrappers over to `<DepthLayers idle>` and compare against current renders.
- Easing variants that add overshoot (spring with bounce) and a look-at helper (keyframe by target element instead of x/y).
- True along-the-path directional blur and zoom/roll blur.
- Unit tests in a test runner (the audit is a script).

## Deviations from the brief (please check)

1. **Shimmer API.** The brief says `(frame, shimmerAtFrame)`; the global rule says seconds only. `<Glass>` takes `frame` (a frame number) and `shimmerAt` / `shimmerDuration` in **seconds**, using `theme.canvas.fps`.
2. **Backdrop blur > 20px.** The "no blur > 20px" rule is about full-layer `filter: blur()`; the glass tiers use `backdrop-filter` at 24px (card, pill), 28px (sheet), 16px (chip), matching video 4. No layer `filter: blur()` exists in the kit apart from `enterStyle`'s per-element ≤8px blur. If you meant the rule to cover backdrop-filter too, lower `blurPx` in `glassTiers.ts` (one place).
3. **Motion move was included** although it is not in this task's numbered list; it was needed so the tokens reuse the iOS springs and so the rest of the kit does not depend on video4. `microEvent` in the video4 adapter keeps whole-frame quantisation of cadence/pulse; the kit version is pure seconds.
4. **`src/Root.tsx` was edited** (one import + `<KitDemoCompositions />`) to register the demos. Revert it if you want the kit fully out of Root; `src/kit/demo/entry.tsx` works on its own.
5. **Fonts.** Themes ship generic iOS-style stacks (`-apple-system, "SF Pro…", Inter, system-ui`). A video that loads Clash Display / Satoshi passes `createTheme({fonts: {...}})`; midnight does not hard-code them to stay video-agnostic. Weights are 600 / 700 in all themes.
6. **Process:** `tsc` was run more than once during the work (not only at the end); the last run is after the final commit.

## Transitions: deviations and caveats (please check)

1. **Branch history.** I started on a fresh local `kit-ios` and my push was rejected because `origin/kit-ios` already had the motion/tokens/Glass work. I did not force-push: the transitions were rebuilt on top of `origin/kit-ios` (my own motion move and `tokens.ts` were dropped in favour of the existing ones) and pushed as a fast-forward.
2. **API shape.** `<TransitionScene>` takes `theme` (not separate fps/width/height props); `motionBlur` defaults to off. Direction means the way the content (or wipe edge) travels. `response` defaults to 0.95 x duration; with the spring that means at 25/50/75% of the *time* the progress is about 0.49 / 0.84 / 0.96, so zoomThrough's outgoing is already invisible at the 50% still.
3. **Incoming-over-outgoing layering.** To avoid a both-half-opaque frame, blurDissolve/matchedGeometry ramp the incoming over a still-opaque outgoing. This assumes scenes paint their own background; with transparent scenes you would see the outgoing under the incoming.
4. **Directional blur is wrapped per layer, not per element inside a scene**, and only on translating layers (push, sheet, matched morph box). zoomThrough/blurDissolve use a Gaussian blur (<= 16px). No `CameraMotionBlur` is used anywhere.
5. **`src/Root.tsx`** has one more line (`<KitTransitionsCompositions />`) next to the existing kit demo.
6. **`tsc`** was run four times in total over the two attempts (an early run, a run that caught a demo prop-type error, a confirmation, and a final run on the rebuilt branch), not once at the end.

## Transitions: verified

- `node scripts/kit-audit.mjs` passes on the final code: 6 kinds x (1920x1080@60, 1080x1920@60, 1920x1080@30) x durations 0.4/0.8/1.5 s x spring/ease/short-response: progress monotonic, exactly 0 then exactly 1; outgoing opacity exactly 0 and incoming fully shown/unmasked at the end; layer blur <= 20px; no frame with both layers at ~half opacity and static. Server-render checks: only outgoing before start, both mounted mid-window, outgoing unmounted at and after the end, one morph copy per side for matchedGeometry and a single copy after it.
- Stills viewed on a contact sheet (16:9), plus the vertical sheet and matched stills earlier.

## Transitions: not verified

- No video render, no Studio session, no `--concurrency > 1` run; parallel-safety is by construction (primitives take `frame`, no clock reads, no `Math.random`).
- Real-time feel of the springs and motion blur at speed is unchecked beyond single frames. 30 fps and vertical were checked by audit and stills only.
- `matchedGeometry` registers rects during render; a memoized scene that skips re-rendering would not register. Different aspect ratios are uniformly fitted, not stretched.
- Stills again use the `@sparticuz/chromium` build (`--gl=swangle`), not Remotion's own browser.
- video4 is not switched onto the kit's `<MotionBlur>` or transitions.

## Verified (motion/tokens/glass work, from the earlier session)

- `tsc --noEmit` passes (strict) across the repo.
- Old vs new `motion4.ts`: `enter`, `leave`, `idleDrift`, `heartbeat`, `microEvent`, `travelBlur` compared over frames -5…399, four responses, three start frames: max abs diff 2.8e-14.
- No imports from `src/video2|3|4` in `src/kit`; no `useCurrentFrame` outside `kit/demo`; `src/motion.ts` and `src/clock.ts` unchanged vs `origin/video-4`.
- `createTheme` does not mutate built-ins; invalid canvas throws; `unit()` is 1 at 1920x1080 and 1080x1920; `toFrames` gives 90 @ 60 fps and 45 @ 30 fps for 1.5 s; the same on-screen speed gives fps-scaled blur length.
- Stills rendered and visually inspected: landscape (mid-shimmer + settled), vertical, 30 fps. All four tiers read correctly in all three themes.

## Not verified

- **No video render, no Studio session, no parallel render.** Only single stills. "Safe in the parallel renderer" holds by construction (pure functions of props), not by test.
- **Stills were rendered with a third-party Chromium** (`@sparticuz/chromium` 123, `--gl=swangle`) because Remotion's own Chrome download is blocked in this sandbox. Backdrop-filter and mask-composite output may differ slightly from your normal Chrome.
- **video4 itself was not rendered** (e.g. `V4-Hook-Test`); only type-checked and numerically compared at the motion layer.
- **Fonts:** the stills use the system fallback, not the project's fonts.
- **30 fps** was checked with one still (frame 75); shimmer timing at 30 fps is by calculation.
- **Light theme legibility:** semantic colours were darkened for contrast on bright glass by eye only, no contrast-ratio check. The 9:16 safe-area insets (title 10% top / 22% bottom) are my estimate of Shorts/Reels UI, not measured.
- Theme `blurPx` / shadow values scale with `unit()` (4K gives 2x); not tried.

## Left to do

- Kits not started: ambient background, morph pill, icon set (number roll now exists as `kit/text` NumberText, not yet adopted by video4); these still live in `src/video4/components` and `src/components`.
- Migrate video4 (`GlassCard`, `MorphPill`, `tokens4`) onto `<Glass>` + a `video4` theme, and confirm pixel parity.
- Unit tests for the pure functions (`createTheme`, `safeRect`, `shimmerState`, motion).
- A top-level `src/kit/README.md` index.
- Optional: a contrast checker for themes; a `compose` helper to chain `enter` with `<Glass>` without making a backdrop root.

## Text kit (src/kit/text) — built on branch kit-ios

Commits (all pushed, prefix `kit:`): RevealText + layout/width tables (task 1, with task 6 foundations because line
breaking needs them) · word-timestamp sync (2) · Emphasis (3) · NumberText (4) · Caption (5) · auto-fit + RTL (6) ·
demo/README/stills script · two fix commits from the first stills (leading zeros; odometer carry + caption sizing).

What was built:
- `<RevealText>` modes words/lines/chars; standard enter on `iosSpring` (opacity, rise 18 px default, blur 8 -> 0), configurable gap/rise/blur/scale; optional overflow `mask` so lines rise out of a clipped baseline.
- Word-timestamp sync: `timings: {text, start, end}[]` (seconds), per-word appear, `highlightActive` karaoke (active bright, rest dim, 0.12 s cross-fade), `keepSpoken`, `renderWord` hook; `wordActivity`, `activeWordIndex`, `shiftTimings`, `validateTimings`.
- `<Emphasis>` underline or soft glass highlight, draws from the start edge (right in RTL).
- `<NumberText>` tabular figures, prefix/suffix, chained rolling updates (`then`), mechanical-odometer carry, vertical directional blur on rolling digits only (gated at > 1 px/frame, cap min(blurCap, 20)). New code in the kit; `src/video4/components/NumberRoll.tsx` is untouched and not migrated.
- `<Caption>` max 2 lines, inside the title safe area, optional glass backing, pagination (`paginateCaptions`, `pageAt`), word highlight, fade-out, pill hugs the text.
- RTL (`direction` ltr/rtl/auto, logical alignment) and auto-fit (`fit` prop, `fitText`) on a precomputed width table: `scripts/kit-font-metrics.py` (fontTools) generated `fonts/inter-600.json` and `inter-700.json`. No DOM measurement at render time.
- Demo: `src/kit/demo/TextDemo.tsx` (`Kit-Text-Demo`, `-Vertical`, `-30fps`, `-RTL`), registered in `demo/entry.tsx`. README in `src/kit/text/README.md`.
- Stills: `docs/previews/kit/text-*.jpg` (landscape 60 at 0.8/3.4/5.6/7.9/9.5 s, vertical 60, landscape 30, RTL), rendered after the code was pushed and re-rendered after each fix.

Verified:
- `npx tsc --noEmit` clean (strict). It was run more than once: a first run found two errors (a `Direction` export clash with `kit/transitions`, now `TextDirection`; demo prop typing) which I fixed and re-ran.
- Pure functions run under `tsx`: `layoutText` (wraps and flags overflow), `fitText` (largest size fitting for three boxes), `wordActivity`/`activeWordIndex`/`validateTimings`, `rollValueAt` with chained segments, `columnPosition` (settled 2715 sits exactly on digits; carries only in the last tenth), `paginateCaptions`/`pageAt`, `detectDirection`/`hasConnectedScript`.
- Rule checks by grep: no imports from `src/video2|3|4`; no `useCurrentFrame`/`useVideoConfig` in `src/kit/text` (only in the demo wrapper); no `Math.random`; `src/motion.ts` and `src/clock.ts` identical to `origin/video-4`.
- Stills viewed by eye: headline reveal, word-synced sentence with the underline emphasis, number roll mid-flight and settled ($2,715 / 41.5%), caption pill, vertical layout, Hebrew RTL (right-anchored, correct bidi, underline on the right word).

Not verified:
- **No video render, no Studio session, no parallel (`--concurrency > 1`) render.** Parallel safety is by construction (pure functions of `frame`). Only single stills.
- **Stills used a third-party Chromium** (`@sparticuz/chromium`, `--gl=swangle`); Remotion's own Chrome download is blocked here. Backdrop-filter on the caption glass may differ in your Chrome.
- **Fonts:** stills render with Inter installed in this sandbox, not the project's loaded fonts. Width tables are Inter 600/700; other fonts need `scripts/kit-font-metrics.py`.
- **Width table accuracy was not measured against the browser.** No kerning/shaping is applied; 3 % slack is a guess. I did not compare predicted vs real line widths in Chrome. Hebrew/Arabic/CJK/emoji widths are rough per-script averages, so line breaks in those scripts may differ from the browser.
- **Arabic was not rendered** (Hebrew only). `mode="chars"` falling back to words for connected scripts is untested visually, as is `mode="chars"` in general (still frames only; no stills of chars mode).
- Motion feel (spring timing, stagger, mask rise, blur streaks at speed) is judged from still frames only; 30 fps checked with one still.
- Caption glass backing: while the page fades, the glass shows its un-blurred fill (documented Glass limitation); not checked on a video.
- Caption page 2 of the demo falls after the last still moment, so page switching/fade-out between pages was not seen.
- `Emphasis` `glass` variant and `RevealText` `mask` + `chars` combinations were not rendered.
- Demo copy uses `\n` line breaks and a fake VO timing generator; real alignment data (e.g. from TTS word timestamps) was not tried.

Left to do (text):
- Visual check of `chars` mode, Emphasis `glass`, masked lines in vertical, and caption page transitions.
- Measure the width table against Chrome (script that renders strings and compares `getBoundingClientRect`), then tune slack.
- Real Arabic/Hebrew tables; kerning from GPOS if line-break accuracy matters.
- Exit animation for RevealText (`exitAt`) — Caption has its own fade only.
- Migrate video4 off `NumberRoll`/`HookScene` onto `<NumberText>` and confirm parity.

## QA tools (`src/kit/qa/`, `scripts/kit_*.mjs`)

Checked first: `kit-ios` had no `src/kit/qa/` and no QA scripts (its earlier `kit_*` files are audio generators), so this
was built new. Commands: `src/kit/qa/README.md`.

| Task | Script | Fix found by running it after the push |
| --- | --- | --- |
| 1 | `kit_contact_sheet.mjs` | A blocked Remotion browser download crashed the script before any fallback. |
| 2 | `kit_motion_audit.mjs` + `Kit-Qa-Demo` (4 variants) | Progress output flooded piped logs. |
| 3 | `kit_safe_area_check.mjs` | Font boxes caused false positives on headlines (now measures glyph pixels); words were joined; live text split into many findings. |
| 4 | `kit_contrast_check.mjs` | Rolling digits counted as failures. A later real-scene run also showed clipped digit slivers. |
| 5 | `kit_render.mjs` (draft / review / final + timing report) | **Remotion 4.0.250's MP4 audio was 42.67 ms (2048 samples) late.** All profiles now mux AAC from a lossless mix. |
| 6 | `kit_loudness.mjs` | Silence printed as `-Infinity`. |

Process: one `kit:` commit per task, pushed, then rendered; problems went into separate `kit: ... fix` commits. Two
fixes are shared or late (clipped slivers + network error message after task 6). Another session pushed
`kit/dataviz` to the same branch meanwhile; these commits were rebased on top, with no force push.

### Verified

- Test card (landscape 60, vertical 60, landscape 30): motion audit reports exactly 3.00-5.50 s and ignores the 0.6 s
  hold; safe area reports exactly `EDGE LABEL` and `unsafe-box`; contrast reports exactly the two planted texts
  (2.21:1 and 1.47:1, matching a separate Python calculation). `Kit-Qa-Demo-Clean` has no findings in all three.
- Loudness: a reference tone with -21.1 dBFS peak reads -21.1 LUFS; after the suggested gain ffmpeg's `ebur128` reads
  -14.0 LUFS (loudnorm: -13.9). Silent and audio-less files are handled.
- Render profiles on `Kit-Audio-Demo`: frame count, size, fps, x264 CRF and preset effect, bt709 tags checked with
  ffprobe / the x264 header; audio of all three is at 0.00 ms against the lossless mix. Audio bitrates averaged about
  175k / 269k / 323k (AAC is variable around the 160k / 256k / 320k targets).
- `@sparticuz/chromium@123.0.1` fallback: contrast and motion audit give the same results as the Playwright shell.
- `tsc --noEmit` clean (strict), run once at the end. One later `kit: dataviz` commit from the other session (`7fa2e84`) was
  rebased in after that run, so the final tip was not type-checked again. `src/kit/qa` has no video imports, `useCurrentFrame` or
  `Math.random`; `src/motion.ts` and `src/clock.ts` match `origin/video-4`.

### Timing (this sandbox: 2 CPUs, software GL; `Kit-Audio-Demo`, 10 s)

| profile | output | total | s/frame |
| --- | --- | --- | --- |
| draft | 960x540, 30 fps, 300 frames | 29.1 s | 0.097 |
| review | 1920x1080, 60 fps, 600 frames | 46.6 s | 0.078 |
| final | 1920x1080, 60 fps, 600 frames | 81.2 s | 0.135 |

A light demo. Time your own composition (`--start/--end` for a slice); heavy scenes will be much slower.

### What the checks found in existing work (not changed)

- Text kit demo: dimmed karaoke words about 2.0:1, tertiary labels about 3.0:1, caption text about 2.9-3.2:1.
- Tokens demo: several labels outside the title-safe area. Vertical camera demo: text in the top and bottom insets.
- Transitions demo: seven 1.1-1.2 s static holds (designed holds). Text demo: still from 0.9 to 2.4 s.
- Kit audio demo mix: -25.0 LUFS (11 LU under the YouTube target).
- `V4-Hook-Test` (**with Google Fonts stubbed, so fallback fonts**): no static stretch, nothing outside title-safe;
  low contrast on `RENT` / `DAYCARE` / `LEFT/MONTH, AFTER TAX` (about 1.8-3.0:1), the red amount (about 1.6-2.2:1) and the
  amber daycare figure (about 3.3-3.6:1). Re-run with real fonts before acting on exact ratios.

### Not verified

- Remotion's own browser (its download is blocked here) and your machine (macOS / Windows). Nothing was run there.
- `src/index.ts` compositions with real fonts: Google Fonts is unreachable here; the scripts exit 2 with a message.
- Long videos (full Video 2 / 3 / 4): run time and memory of the audit and renders are untested.
- `--scale 2` (4K), `--concurrency` above the default, `--serve-url` for the render script, `--kind action`.
- DOM checks with `<OffthreadVideo>` (not supported), WebGL scenes, gradient-clipped text, SVG text, emoji, RTL
  contrast. The page protocol is Remotion-internal: re-test after any Remotion upgrade.
- "Samples low": review passes `kitRender.motionBlurSamples = 3`; the NumberRoll demo reads the value and disables its digit blur at one sample.
- Colour: decoded frames of the three profiles differ from a lossless still by 2.6-4.5 levels mean (of 255); not
  judged on a calibrated display. Loudness was checked by numbers, not listening.
- README commands: every script's `--help` ran, and most flows ran; not every example line was run verbatim.
  The 10-line TypeScript example uses placeholder frame data and was not compiled.

### Left to do

- Raise the low-contrast defaults in `kit/text` and the themes (design decision), and tidy the demo layouts.
- Have compositions read `motionBlurSamples`; wire the checks into CI; unit tests in a test runner.
- Run the checks on the full videos with real fonts.
- Register the QA card in `src/Root.tsx` if you want it in the main Studio (it is only in the kit demo entry).

## Security note

The GitHub token was used for clone and push only (the camera session cloned with it in the URL, then I reset `origin` to the plain URL; `.git/config` holds no token and nothing is committed). Please revoke it.

## T1 — Legibility, fonts, and number rolls

### Built

- T1a: contrast-safe text helpers and contrast QA fixes; details in `docs/progress/T1a-contrast.md`.
- T1b: `NumberText` supports `layout="collapse"` (default) and `layout="reserve"`; the NumberRoll demo reads the render profile's `kitRender.motionBlurSamples`.
- Review stills: `docs/previews/kit/T1b-0-usd.jpg`, `T1b-316-usd.jpg`, `T1b-2168-usd.jpg`, `T1b-93k-usd.jpg`, and `T1b-0.0-pct.jpg`.

### Verified

- `npm run kit:contrast` passes.
- NumberRoll contrast, title-safe area, and motion audit each passed before and after the task changes; reports are in `docs/progress/T1b-qa-before.txt` and `docs/progress/T1b-qa-after.txt`.
- `npx tsc --noEmit` passed at the end of T1b.

### NOT verified

- This records the completed T1a/T1b task work; see the linked task reports for their scope and visual-review notes.
