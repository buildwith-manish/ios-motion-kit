# Repo size rules

This repo is a submodule in every video repo, so every clone pays for what is committed. `scripts/kit_size_guard.mjs` (run in CI) enforces these:

- No tracked file over 1 MB, except the two allow-listed files in the script.
- `docs/previews/` holds small JPGs only (about 960 px wide, quality about 80), at most 15 MB in total. No PNG, MP4, MOV, WEBM or WAV there.
- 4K stills, videos and other big outputs are CI artifacts or GitHub Release assets. Never commit them.
- Visual baselines (`tests/visual/baselines/`) stay small (480 px).
- Never force-push or rewrite history without checking with the owner; everyone must re-clone afterwards.
