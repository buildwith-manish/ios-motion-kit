# Repo size rules

This repo is a submodule in every video repo, so every clone pays for what is committed. `scripts/kit_size_guard.mjs` (run in CI) enforces the first three.

| Thing | Where it goes |
|---|---|
| Review stills (`docs/previews/`) | JPG only, at most 960 px wide (quality about 80), 5 MB in total. `npm run kit:shrink-previews` converts. |
| Baked map data, music loop | Release assets listed in `data-manifest.json`; `npm run kit:fetch-data`. Never committed. |
| Any other file | At most 1 MB. |
| 4K stills, videos | CI artifacts (14 days), or Release assets for the ones to keep. |
| Visual baselines (`tests/visual/baselines/`) | In git, 480 px. |

- Do not use Git LFS: its free bandwidth is small and a submodule used by many repos would use it up.
- Releases are never overwritten. Changed data gets a new tag (`node scripts/kit_data_manifest.mjs --release <tag>`, then
  upload with `bash scripts/kit_data_publish.sh` before removing the local files), so older commits keep working.
- Never force-push or rewrite history without checking with the owner; everyone must re-clone afterwards.
