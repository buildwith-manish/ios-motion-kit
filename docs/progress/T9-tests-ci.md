# T9 — Tests, visual regression, and CI

## Built

- Added Vitest pure-function coverage for motion, tokens/glass, transitions, text rolls, data-viz rankings, camera targeting, audio cue resolution, timing parsing, UI motion, and scene timelines.
- Added four fixed-frame visual cases, an explicit baseline update command, pixel comparison, and actual/diff image output.
- Added a pull-request workflow for TypeScript, unit tests, source/contrast checks, sampled contrast/safe-area/motion QA, visual regression, browser caching, and artifact upload.
- Documented local test and baseline-refresh commands in the repository and QA READMEs.

## Verified

- `npx tsc --noEmit` passed and `npm run test:unit` passed all 11 tests.
- Refreshed all four visual baselines; the follow-up comparison reported zero differing pixels for each.
- Sampled UI and scene contrast/safe-area checks passed. Motion audits found no static stretches over 3 seconds across the UI variants or scene demo.

## Remaining

- The GitHub Actions workflow will run when the branch is opened as a pull request; it cannot be dispatched before the workflow exists on the default branch.
