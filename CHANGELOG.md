# Changelog

Newest first. One section per tag; features that were never tagged are listed under their commit range. "Migrating" = what a video repo that uses this kit as a submodule must do. Bump the kit in a video repo with:
`git -C kit fetch --tags && git -C kit checkout <tag> && git add kit && git commit -m "kit <tag>"` (then `npm ci --prefix kit` if kit/package-lock.json changed).

## v0.2.0 (release)
Everything below since v0.1.0, plus the one-command scene review. **Migrating:** checkout `v0.2.0`; read the notes of the sections below that you use. Breaking: see `kit-production-port-v1` and `export-quality-v1`; otherwise none.
- New: `npm run kit:review -- --comp <id> [--times 1,3,5] [--portrait] [--loudness]` writes `dist/review/<comp>/` with stills, a contact sheet and `review.md` merging contrast, safe-area, motion audit, layout lint (and loudness). `reusable-preview.yml` gets an opt-in `review` input (default false) that uploads that folder. Contact sheet needs ffmpeg.

## liquid-glass-v1
- `<Glass tier="liquid">`: opt-in glass tier for hero cards (light-angle specular rim, inner highlight and shadow, chroma-shifted edge refraction, pure `tintFor(theme, position)` adaptive tint). Existing tiers unchanged.
- Kit-Liquid-Demo, QA suite `liquid`, CI job `Glass perf` (`scripts/kit_glass_perf.mjs`): liquid 1.06x card per still, 1.44x for the glass part alone.
- Migrating: none (additive). New props `lightAngle`, `position`; new type `GlassTierProp`.

## Choreography (no tag; commits de6fcc8, 9c20b03)
- `motion/choreo.ts` presets, `springWithVelocity`/`retarget`, opt-in `choreo` on stat/ranking scenes; `data-kit-role` attributes and a max-simultaneous layout-lint rule.
- Migrating: none (opt-in).

## Typography (no tag; commits 2ee7bf8, ef3d9dc, 6775f0c)
- Type scale and `numberSize`, `useKitFonts` gate, font check CI (`scripts/kit_font_still.mjs`), docs/fonts.md; scaffold copies kit fonts into `public/kit/fonts`.
- Migrating: existing video repos should copy the kit fonts to `public/kit/fonts` (or re-run the scaffold step) so the font gate finds them; no API removals.

## export-quality-v1
- Seeded, banding-safe Finish dither, `render-presets.json` with `kit_render.mjs --preset <preview|final-1080|final-4k>` (also a `preset` input on the reusable render workflow), banding check script and CI job, final-4k threshold enforced, docs/export-quality.md.
- Migrating: **breaking for pixels only**: Finish output changes because the dither is now seeded, so regenerate any visual baselines. Reusable render accepts `preset`; new script `kit_banding_check.mjs`.

## Chart emphasis and claude-md (no tags; commits b73a61a, 521fb44, fc2a665)
- Charts: emphasis system, `DirectLabel`, `CompareMarker`; scene type `chartHeadline` with validation and title-safe layout; CLAUDE.md for the kit and the video template (scaffold asserts it).
- Migrating: none. Video repos get a CLAUDE.md from the scaffold; copy it by hand to existing repos.

## kit-production-port-v1 (same commit as reuse-v1)
- Production components (chapter card, countdown rail, source footer, disclaimer, lower third, platform end card), scenes and demo; brand-chime SFX family.
- Migrating: **breaking:** `kit/production` `safeRect` is now an inset; custom layouts that used it as a rectangle must be adjusted. Rail, footer and lower third are pinned with it.

## reuse-v1
- Reusable workflows (`reusable-preview`, `-render`, `-shorts`, `-qa`) for video repos, `kit:init`, `kit:new-video` scaffold (`templates/video`), data manifest (`kit:data-check`, `kit:data-manifest`), layout lint (`kit:layout-lint`), `KIT_TOKEN` for fetching kit data.
- Migrating: add the kit as a submodule (`git submodule add https://github.com/buildwith-manish/ios-motion-kit.git kit`), call the workflows with `secrets: inherit` and a fine-grained `KIT_TOKEN` (Contents: read) as in docs/ci-reuse.md. Breaking: none.

## pipeline-v1
- Eight-step video pipeline: `video.config.json` schema, VO layout/words/envelope/normalize, pace audit, TTS prep, figures, chapters, mix check, final normalize, contact sheet, scene stills, cue dump (docs/pipeline.md).
- Migrating: new npm scripts `kit:vo-layout`, `kit:vo-words`, `kit:vo-envelope`, `kit:vo-normalize`, `kit:pace-audit`, `kit:tts-prep`, `kit:config-check`, `kit:figures-check`, `kit:chapters`, `kit:chapters-check`, `kit:mix-check`, `kit:normalize`, `kit:contact-sheet`, `kit:scene-stills`, `kit:dump-cues`. Needs python3 (+ numpy) and ffmpeg. Breaking: none.

## sfx-system-v1
- SFX retuned to D major pentatonic, `valueToNoteIndex`/`pitchedCue`, analysis report (`kit:sfx-report`), determinism check in CI, regenerated WAVs.
- Migrating: SFX files change sound (regenerated), so re-check audio mixes. New script `kit:sfx-report` (python3). Breaking: none in the API.

## map-scenes-v1
- Map scene types `choropleth`, `regionHighlight`, `flyToCity`, `tileGrid` (11x8 US tile grid, DC), validation and region data helpers, data-only example video, map-scenes workflow.
- Migrating: none (additive scene types; baked map data comes from the data release, see data-v2).

## charts-v1
- `charts/`: scales, stacking, `Chart` frame, Line/Area/Bar/Point/Rule/Sector marks, waterfall, candlestick, slope, lollipop recipes, demos, QA matrix entries.
- Migrating: none (new module).

## format-v1
- `formatNumber` presets plus quarter/monthYear, wired into `NumberText`, dataviz and scenes; `kit-main-ci` workflow; format demo.
- Migrating: none. New scripts `kit:data-manifest`, `kit:audio`, `kit:shrink-previews`.

## data-v2 and data-v1 (data releases)
- Large generated files (baked map data, music loop) moved out of git into Release assets with a manifest and fetch script; v2 covers all baked map data; repo size guard (1 MB per file, JPG-only previews).
- Migrating: run `npm run kit:fetch-data` (needs network; `KIT_TOKEN` for a private kit) after checkout; `kit:contrast`, `kit:sizeguard`, `test:unit`, `test:visual` scripts exist from here. Breaking: generated data and music are no longer tracked in git.

## v0.1.0
- First tagged state: iOS-style tokens, glass, springs, text, dataviz, transitions, camera, audio, QA tooling, UI components, scene composition, map.
