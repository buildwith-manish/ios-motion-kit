# mapscenes progress (task: JSON map scenes; US-only; work on main; CI does the heavy checks)

- [~] A. scene types choropleth / regionHighlight / flyToCity, validation, regionsFromRows + regionsFromCsv, unit tests
  - code: src/kit/scenes/{regionData,mapSceneValidation,mapTemplates}.ts(x), types.ts, sequence.ts, SceneSequence.tsx
  - tests: tests/kit/mapScenes.test.ts (17 pass locally); waiting for kit-main-ci (typecheck + unit)
- [ ] B. tileGrid scene type (US state tile grid, DC included) + unit tests
- [ ] C. demo composition, docs (how-to-build-a-video.md, scenes/README.md), CI stills + landscape/portrait render, tag map-scenes-v1

Notes: no gh CLI here; watch CI with the GitHub API (curl). Local runs: vitest on one file only.
Not verifiable locally: renders, stills, baked-data scenes, tsc. City centres in BAKED_CITIES are downtown points (check pins in CI stills).
