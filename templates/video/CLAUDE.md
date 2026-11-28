# __NAME__: agent guide

Video repo built on ios-motion-kit (private), added as the `kit/` git submodule (tag `__KIT_TAG__`). Composition: `__COMP__`. README.md has setup.

## Start cheaply
- Read this file, then only the files named in your task. Use grep -n and sed -n ranges; cap output (`| tail -40`).
- Do not edit `kit/`. Kit changes belong in the kit repo.

## Layout
- `data/scenes.json`: scene list (id, type, duration in seconds, type-specific fields). Edit this to change the video.
- `data/`, `data.manifest.json`: datasets and their source records (kit: `docs/ci-reuse.md`, "Data manifest").
- `docs/script.md`: the script (`script` key in video.config.json).
- `video.config.json`: paths and settings (script, fps, canvas, plus keys in `kit/docs/pipeline.md`); validate with `npm run kit:config-check`.
- `src/index.ts`, `src/Root.tsx`: Remotion entry and compositions. `public/`: your fonts and brand assets (not included).
- `.github/workflows/{qa,preview,render,shorts}.yml`: callers of the kit's reusable workflows.

## Rules
- Time is in seconds. Components are pure functions of frame; theme tokens only, no hard-coded colors.
- Kit imports come from the kit package alias (see tsconfig.json and remotion.config.ts); do not `npm install` inside `kit/`.

## The 8-step pipeline (details: `kit/docs/pipeline.md`)
1. Script: write `docs/script.md`; `npm run kit:tts-prep`
2. VO: clips into the clips dir; `npm run kit:vo-normalize`
3. Words: `npm run kit:vo-words` (optional)
4. Layout: `npm run kit:vo-layout` (`-- --check` reports only)
5. Envelope: `npm run kit:vo-envelope`
6. Scenes: edit `data/scenes.json`; review with `kit:pace-audit`, `kit:scene-stills`, `kit:contact-sheet`
7. Checks: `kit:figures-check`, `kit:chapters` + `kit:chapters-check`, `kit:dump-cues`, `kit:mix-check`
8. Normalize: `npm run render`, then `npm run kit:normalize -- out/video.mp4`

Other scripts: `npm run dev` (Studio), `typecheck`, `still`.

## CI-first
- Do not run Chromium, renders, stills or QA locally; `kit:scene-stills` and `kit:contact-sheet` render, so run them in CI.
- Push to main (no force-push) and watch: `gh run watch --exit-status`; on failure `gh run view --log-failed | tail -60`. Max 3 fix rounds, then report.
- Review CI artifacts yourself; do not view images.
- CI needs the `KIT_TOKEN` secret (kit: `docs/ci-reuse.md`, "Private kit setup").

## Reusable workflows (live in the kit: `kit/.github/workflows/`)
- `reusable-preview.yml`: low-res MP4, contact sheet, QA artifacts.
- `reusable-render.yml`: final render in pieces, soundtrack, loudnorm.
- `reusable-shorts.yml`: vertical compositions matrix.
- `reusable-qa.yml`: contrast, safe area, motion, layout lint, loudness gate.
- Inputs and details: `kit/docs/ci-reuse.md`.
