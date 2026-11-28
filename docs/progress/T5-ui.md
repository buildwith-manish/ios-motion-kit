# T5 — UI Kit

## Built

- Added frame- and seconds-driven UI primitives: Pill, Chip, Badge, Button, Toggle, Segmented, ListGroup/ListRow, AlertCard, Widget, Sheet, and Tooltip.
- Added a landscape/vertical dashboard plus a 30 fps variant, standalone entry point, API README, and shared kit exports.
- Added `scripts/kit_no_device_chrome.mjs` and documented it in the QA README.

## Verification

- `npx tsc --noEmit` passed; `npm run test:unit` passed all 16 tests.
- Contrast and safe-area checks passed for all three UI variants at 2, 4.5, 7.5, and 8.5 seconds.
- Motion audit sampled 20 points per variant at 2 fps and 0.1 scale; no static stretch over 3 seconds was found.
- Visual regression baseline `ui-frame-180.png` matches with zero differing pixels.
- QA fixes: moved the tooltip into the dashboard content flow, excluded the intentionally dimmed modal background from contrast detection, and corrected the primary button text color.
- Follow-up: placed the Sheet on the full composition stage, applied safe insets once, and kept its text within title-safe bounds; fixed ListGroup rows whose stagger begins after the group end.

## Not done

- No full-resolution render, full-motion playback review, or cross-browser comparison.
- Motion-audit wall time is a low-resolution sampled QA measurement, not a production-render benchmark.
