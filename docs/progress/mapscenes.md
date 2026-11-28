# mapscenes progress (task: JSON map scenes; US-only; work on main; CI does the heavy checks)

- [x] A. scene types choropleth / regionHighlight / flyToCity, validation, regionsFromRows + regionsFromCsv, unit tests
  - code: src/kit/scenes/{regionData,mapSceneValidation,mapTemplates}.ts(x), types.ts, sequence.ts, SceneSequence.tsx
  - tests: tests/kit/mapScenes.test.ts (17 pass locally); kit-main-ci green on cced62a
- [x] B. tileGrid scene type (US state tile grid, DC included) + unit tests
  - code: src/kit/map/{tileGridLayout.ts,TileGridMap.tsx}, TileGridScene in scenes/mapTemplates.tsx; tests appended to tests/kit/mapScenes.test.ts (21 pass); CI green on fcf7477
- [x] C. demo composition, docs (how-to-build-a-video.md, scenes/README.md), CI stills + landscape/portrait render, tag map-scenes-v1

Notes: no gh CLI here; watch CI with the GitHub API (curl). Local runs: vitest on one file only.
Not verifiable locally: renders, stills, baked-data scenes, tsc. City centres in BAKED_CITIES are downtown points (check pins in CI stills).

  - C code: scenes/{mapScenesDemoData.ts,MapScenesDemo.tsx}, scripts/map_scenes_stills.ts, .github/workflows/map-scenes.yml, docs; QA matrix (kit-qa) covers new comps via entry.tsx. CI green on 4dd235c (Map scenes run 46139793662); tagged map-scenes-v1. Logs/artifacts not downloadable from the agent sandbox: read timings in the run log.
