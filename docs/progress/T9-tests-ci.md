# T9 — Tests, visual regression, and CI

## Built

- Added Vitest pure-function coverage for motion, tokens/glass, transitions, text rolls, data-viz rankings, camera targeting, audio cue resolution, timing parsing, UI motion, and scene timelines.
- Added four fixed-frame visual cases, an explicit baseline update command, pixel comparison, and actual/diff image output.
- Added a pull-request workflow for TypeScript, unit tests, source/contrast checks, sampled contrast/safe-area/motion QA, visual regression, browser caching, and artifact upload.
- Documented local test and baseline-refresh commands in the repository and QA READMEs.

## Verified

- `npx tsc --noEmit` passed and `npm run test:unit` passed all 16 tests.
- Refreshed all four visual baselines; the follow-up comparison reported zero differing pixels for each.
- Sampled UI and scene contrast/safe-area checks passed. Motion audits found no static stretches over 3 seconds across the UI variants or scene demo.
- GitHub Actions run `46121236232` passed the type/unit, visual-regression, and tokens/transitions/UI/scenes QA jobs on the branch after syncing with `main`.
- Corrected tokens QA sample points to stay within its four-second composition; transition-scene labels are ignored by safe-area QA only while the scene is moving.
- Review follow-up adds regression coverage for CSS named background colors, delayed ListGroup rows, mixed cue ordering, invalid spring responses/tiny bounce, and camera zoom at a screen-space anchor. Also fixed the Sheet's duplicated safe inset and made CI motion findings fail the QA job.

## Remaining

- No outstanding T9 implementation or verification items.
