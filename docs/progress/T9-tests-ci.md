# T9 — Tests, visual regression, and CI

## Built

- Added Vitest pure-function coverage for motion, tokens/glass, transitions, text rolls, data-viz rankings, camera targeting, audio cue resolution, timing parsing, UI motion, and scene timelines.
- Added four fixed-frame visual cases and an explicit baseline update command, pixel comparison, and actual/diff image output.
- Added a pull-request workflow for TypeScript, unit tests, source/contrast checks, representative contrast/safe-area/motion QA, visual regression, browser caching, and artifact upload.
- Documented local test and baseline-refresh commands in the repository and QA READMEs.

## Remaining

- Generate and commit the initial visual baselines during the final verification pass.
- Run the deferred typecheck, unit tests, QA checks, and visual comparison; fix any issues introduced by this task.
