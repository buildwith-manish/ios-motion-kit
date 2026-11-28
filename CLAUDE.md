# ios-motion-kit: agent guide

Reusable, video-agnostic iOS-style motion kit for Remotion 4.0.250 / React 18.3.1 / TypeScript strict (glass, springs, text, charts, transitions, camera, audio, QA). Used as a git submodule (`kit/` or `src/kit-vendor/`) in video repos, so every committed byte is paid by every clone. Docs: README.md, docs/*.md.

## Start cheaply
1. Read this file, then docs/progress/<TASK>.md (checklist) if one exists. Do not explore; grep -n and sed -n ranges.
2. Work on main (`git pull`), additive changes, never force-push.

## Commands (npm scripts)
| Command | What | Where |
|---|---|---|
| `npx vitest run <file>` | one unit test file | local |
| `npm run test:unit` | all Vitest pure-function tests (tests/kit, tests/fixtures) | local ok, CI too |
| `npm run typecheck` (= build, lint) | `tsc --noEmit` | CI (slow; do not run locally) |
| `npm run kit:sizeguard` | size rules (see below) | local ok, CI |
| `npm run kit:contrast` | contrast tokens check | local ok, CI |
| `npm run kit:data-check` / `kit:data-manifest` / `kit:fetch-data` | data manifest checks / manifest writer / download release data | local ok (fetch needs network) |
| `npm run kit:layout-lint` | layout lint rules | CI |
| `npm run dev` | Remotion Studio, port 3000 | human only |
| `npm run test:visual` / `test:visual:update` | fixed-frame visual regression vs tests/visual/baselines | CI only (Chromium) |
| `node scripts/kit_contrast_check.mjs`, `kit_safe_area_check.mjs`, `kit_motion_audit.mjs` | per-composition QA (`--comp --entry --times`) | CI only (Chromium) |
| `npm run kit:new-video -- <dir> --name <n>` | scaffold a video repo from templates/video | local ok (no network) |
| `node scripts/kit_render.mjs --preset <preview\|final-1080\|final-4k>` | render with render-presets.json (also workflow input `preset`; `kit_preset_env.mjs` feeds it) | CI only (Chromium) |
| `node scripts/kit_glass_perf.mjs` | ms/frame for no glass, card, liquid (Kit-Liquid-Perf-*); CI job `Glass perf`, `[qa]` | CI only (Chromium) |
| `node scripts/kit_banding_check.mjs` | banding vs presets and Finish dither (Kit-Banding-Gradient); report in out/banding | CI only, `[qa]` (Chromium + ffmpeg) |
| `node scripts/kit_font_still.mjs` | fails if a demo frame uses a fallback font; rules in scripts/kit_font_check.mjs; fonts/licenses in docs/fonts.md | CI only, `[qa]` (Chromium) |
| `npm run kit:init` | scripts/kit_init.mjs | see script |
| `npm run kit:audio` / `kit:sfx-report` / `kit:shrink-previews` | music / SFX report / shrink previews | needs python3, numpy, scipy / bash |
| `npm run kit:tts-prep, vo-normalize, vo-words, vo-layout, vo-envelope, pace-audit, config-check, figures-check, chapters, chapters-check, dump-cues, mix-check, normalize, contact-sheet, scene-stills` | the 8-step video pipeline (docs/pipeline.md) | tools run in video repos; contact-sheet and scene-stills need Chromium: CI only |

## Directory map
- `src/kit/index.ts`: re-exports every module below.
- `motion`: iOS springs and easings; `choreo.ts` choreography presets + velocity-keeping springs. `tokens`: themes (midnight/light/mono), canvases, contrast engine. `glass`: `Glass` primitive (tiers card/pill/chip/sheet + opt-in `liquid`, `glass/liquid.ts`).
- `text`: RevealText, Emphasis, NumberText, Caption. `dataviz`: SpringBar, Ring, Ticker, LineDraw, Delta, Callout. `charts`: scales, marks, Chart.
- `transitions`: TransitionScene. `camera`: CameraRig, Tilt3D, DepthLayers, RackFocus. `timing`: word-timing parsers and timeline builder.
- `audio`: cues, CueTrack, MusicBed, ducking; `families.ts` lists SFX families, `sfx-manifest.json` is generated.
- `ui`: Pill, Chip, Button, Toggle, ListGroup, Sheet, etc. `scenes`: JSON scene templates + SceneSequence (map scenes in `mapTemplates.tsx`).
- `map`: map components (docs/kit-map-progress.md). `data`: data manifest helpers. `qa`: safe-area, contrast, motion, loudness checks.
- `background`, `finish`, `icons`, `production`: exported from index.ts; see each folder. `demo`: demo compositions and entry.tsx.
- `scripts/`: `kit-*.mjs` / `kit_*.mjs` stills, audits, QA, data; `map_*` map bake/verify; `sfx_*`; `new-video.mjs`. `scripts/pipeline/`: 8-step pipeline tools + `video.config.schema.json`, `config.defaults.json`.
- `templates/video/`: scaffold copied by new-video.mjs (all files; placeholders __NAME__ __SLUG__ __COMP__ __KIT_TAG__ __KIT_URL__).
- `docs/`: ci-reuse.md, pipeline.md, how-to-build-a-video.md, repo-rules.md, progress/ (task checklists), previews/ (small JPGs).
- `tests/kit` unit tests, `tests/visual` baselines (480 px, in git).
- `.github/workflows/`: `kit-main-ci.yml` (push gate), `kit-pr.yml`, `kit-qa.yml`, `reusable-{preview,render,shorts,qa}.yml` (called by video repos), `map-*.yml`, `sfx-*.yml`, `kit-data-release.yml`, `typecheck.yml`.

## Rules
- Time is in seconds in every public API; frames only where a prop is explicitly `frame`.
- Components are pure functions of frame (deterministic, safe for parallel render); no wall clock, no unseeded randomness.
- Theme tokens only (`useTheme`/`createTheme`); no hard-coded colors (map mask black/white and grain are the documented exceptions).
- API changes are additive and backward compatible; export new things through the module index.
- Size (docs/repo-rules.md, enforced by `scripts/kit_size_guard.mjs`): 1 MB per tracked file; docs/previews JPG only, max 960 px wide, 5 MB total; baked map data and the music loop live in Release assets, never in git; no Git LFS.
- Do not loosen QA thresholds; fix the cause. Releases are never overwritten.
- Add or rename a command or directory: update this file (one line) in the same push.
- Tags: one annotated tag per feature, `<feature>-v1` (existing: pipeline-v1, reuse-v1, sfx-system-v1, v0.1.0).

## CI-first workflow
- No local Chromium, renders, stills, visual or QA scripts, full tsc. Push to main and let kit-main-ci run.
- `fast` job (typecheck + unit) always runs. Heavy jobs (QA matrix, scaffold, visual, reusable self-tests) run only if the head commit message contains `[qa]` or on manual dispatch.
- After each push: `gh run watch --exit-status`; on failure `gh run view --log-failed | tail -60`. Max 3 fix rounds per chunk, then report.
- Review CI artifacts (retention 7-14 days) instead of viewing images locally.
- Checkpoint progress in docs/progress/<TASK>.md; finish with `git tag -a <TASK>-v1 -m ... && git push origin <TASK>-v1`.

## Add a component
1. Create it in `src/kit/<module>/`; props take `frame` or seconds, colors/type/springs from the theme.
2. Export from that module's `index.ts` (src/kit/index.ts already re-exports the module).
3. Add a pure-function test in `tests/kit/`.
4. Add it to the module's demo composition and README table.
5. If it is a new demo composition: register it and add a matrix entry in `kit-main-ci.yml` and `kit-pr.yml`; push with `[qa]`.

## Add a scene type
1. Add the interface to the scene union in `src/kit/scenes/types.ts` (map types: `mapTemplates.tsx`, `mapSceneValidation.ts`).
2. Add the template in `src/kit/scenes/templates.tsx` and wire it in `SceneSequence.tsx`.
3. Timings are seconds from scene start; transitions overlap adjacent scenes.
4. Add it to `SceneDemo.tsx` (or `mapScenesDemoData.ts`) and `src/kit/scenes/README.md`; cover in `tests/kit/pure.test.ts` or `mapScenes.test.ts`.
5. Push with `[qa]` (scenes suite).

## Add an SFX family
1. Generate it in `scripts/kit_make_sfx.py` (writes public/kit/sfx, manifest.json, src/kit/audio/sfx-manifest.json); wavs are 24-bit, peak -3 dBFS.
2. Add the name to `SFX_FAMILIES` in `src/kit/audio/families.ts` and a default level in `FAMILY_DEFAULTS`.
3. Per-family thresholds: `scripts/sfx_report_thresholds.json`; the report runs in the sfx workflows.
4. Document it in `src/kit/audio/README.md`; keep the 120 ms identical-file rule in mind (same family + variant).
5. Keep files under the 1 MB limit.

## Known pitfalls (from docs/progress)
- Remotion `<Audio>` has no pan prop: pan picks pre-rendered `@L`/`@R`/centre files (kit-progress.md).
- No identical SFX within 120 ms means same file (family + variant), not same family.
- SFX levels in the manifest are estimates (LUFS is an unweighted estimate); nobody has listened to the audio.
- Glass takes `frame` plus shimmer seconds; the "seconds only" rule has this one frame prop.
- Do not `npm install` inside the submodule (second copy of react/remotion); the video repo supplies them.
- Chromium missing locally is expected; CI pins `@sparticuz/chromium`. `KIT_CHROME` overrides the QA browser lookup.
- Scene `endCard`, `stat`, `hook` etc. durations are absolute seconds; total length = sum minus transition overlaps.
