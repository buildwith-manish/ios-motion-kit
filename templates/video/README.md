# __NAME__

A video built with the [ios-motion-kit](__KIT_URL__) (private; added as the `kit/` submodule).

## Setup
1. `git submodule add __KIT_URL__ kit` then `git submodule update --init --recursive`
2. `npm install`
3. `npm run dev` (Remotion Studio, composition `__COMP__`)

CI needs the private-kit setup once: see `kit/docs/ci-reuse.md`, "Private kit setup" (repo Access setting, a read-only fine-grained token, the `KIT_TOKEN` secret).
No fonts or brand assets are included: put your own in `public/`.

## The 8-step flow (details: `kit/docs/pipeline.md`)
1. Script: write `docs/script.md`; `npm run kit:tts-prep` spells numbers out for a TTS voice.
2. VO: record or generate clips; `npm run kit:vo-normalize` levels them.
3. Words: `npm run kit:vo-words` (optional word times for cued beats).
4. Layout: `npm run kit:vo-layout` builds the shot timeline.
5. Envelope: `npm run kit:vo-envelope` makes the music-ducking curve.
6. Scenes: edit `data/scenes.json`; review with `kit:pace-audit`, `kit:scene-stills`, `kit:contact-sheet`.
7. Checks: `kit:figures-check`, `kit:chapters-check`, `kit:dump-cues`, `kit:mix-check`.
8. Normalize: render (`npm run render`), then `npm run kit:normalize -- out/video.mp4`.

Edit `video.config.json` for paths and settings; `npm run kit:config-check` validates it.
